"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildWOPayload, validateWOPayload, type PedidoWOInput } from "@/lib/worldoffice/mapping";
import { WOValidationError } from "@/lib/worldoffice/errors";
import { sincronizarPedidoWO } from "@/lib/pedidos/sync";
import { enviarNotificacionPedido } from "@/lib/notificaciones/email";
import { interpretarConsulta } from "@/lib/agente/interpretar";
import { embedQuery } from "@/lib/agente/embeddings";

const WO_MODE = (process.env.WO_MODE === "live" ? "live" : "mock") as "mock" | "live";

export interface ResultadoBusqueda {
  id: string;
  codigo_interno: string;
  descripcion: string;
  precio_lista: number;
  iva_pct: number;
  stock: number;
  unidad_medida: string;
}

// Capa base de búsqueda (sin IA): RPC determinista buscar_productos.
export async function buscarProductos(q: string): Promise<ResultadoBusqueda[]> {
  const termino = (q ?? "").trim();
  if (termino.length < 1) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("buscar_productos", { q: termino });
  if (error) return [];
  return (data ?? []) as ResultadoBusqueda[];
}

export interface SugerenciasResultado {
  interpretado: string;
  candidatos: ResultadoBusqueda[];
}

// Agente de búsqueda: reinterpreta la consulta y devuelve candidatos. SOLO SUGIERE.
// Si N8N_WEBHOOK_AGENTE_BUSQUEDA está configurado, delega al flujo n8n (LLM+vector);
// si no, usa el intérprete determinista in-app + buscar_productos.
export async function sugerenciasAgente(query: string): Promise<SugerenciasResultado> {
  const n8nUrl = process.env.N8N_WEBHOOK_AGENTE_BUSQUEDA;
  if (n8nUrl) {
    try {
      const res = await fetch(n8nUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = (await res.json()) as { candidatos?: ResultadoBusqueda[] };
      return { interpretado: query, candidatos: data.candidatos ?? [] };
    } catch {
      // cae al intérprete in-app
    }
  }
  const supabase = await createClient();

  // Capa semántica: si hay key de embeddings, busca por SIGNIFICADO (vectorial).
  const vec = await embedQuery(query);
  if (vec) {
    const { data } = await supabase.rpc("buscar_semantica", {
      query_embedding: vec,
      match_count: 10,
    });
    if (data && data.length > 0) {
      return {
        interpretado: `búsqueda semántica de ${query.trim()}`,
        candidatos: data as ResultadoBusqueda[],
      };
    }
  }

  // Respaldo léxico: intérprete por reglas + buscar_productos.
  const interpretado = interpretarConsulta(query);
  if (!interpretado) return { interpretado: "", candidatos: [] };
  const { data } = await supabase.rpc("buscar_productos", { q: interpretado });
  return { interpretado, candidatos: (data ?? []) as ResultadoBusqueda[] };
}

export interface ItemInput {
  productoId: string;
  cantidad: number;
}

export interface ConfirmarInput {
  clienteId: string;
  descuentoPct: number;
  items: ItemInput[];
}

export interface ConfirmarResultado {
  ok: boolean;
  error?: string;
  pedidoId?: string;
  numero?: string;
  numeroWo?: string;
  estado?: string;
}

// Confirma un pedido: crea cotización + pedido + items con SNAPSHOTS, reserva
// consecutivo atómico, construye el payload WO y dispara la sincronización
// (mock en concurso). 100% determinista.
export async function confirmarPedido(
  input: ConfirmarInput
): Promise<ConfirmarResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión expirada." };

  if (!input.clienteId || input.items.length === 0)
    return { ok: false, error: "Selecciona cliente y al menos un producto." };

  // 1) Cargar datos confiables del servidor (nunca confiar en precios del cliente).
  const ids = input.items.map((i) => i.productoId);
  const { data: productos } = await supabase
    .from("productos")
    .select(
      "id, descripcion, codigo_interno, codigo_contable, wo_id_inventario, wo_id_unidad, wo_id_impuesto, precio_lista"
    )
    .in("id", ids);
  if (!productos || productos.length === 0)
    return { ok: false, error: "Productos no encontrados." };

  const { data: empresa } = await supabase
    .from("empresa")
    .select(
      "prefijo_pedido, forma_pago_default, moneda, bodega_default, centro_costo_default, wo_id_empresa, documento_tipo_pedido"
    )
    .single();
  const { data: cliente } = await supabase
    .from("clientes")
    .select("wo_id_tercero, wo_id_direccion")
    .eq("id", input.clienteId)
    .single();
  if (!empresa || !cliente) return { ok: false, error: "Configuración incompleta." };

  const desc = Math.max(0, Math.min(100, input.descuentoPct || 0));

  // 2) Armar líneas con snapshots inmutables + totales.
  const lineas = input.items.map((it) => {
    const p = productos.find((x) => x.id === it.productoId)!;
    const cantidad = Math.max(1, Math.floor(it.cantidad));
    const valor = Number(p.precio_lista);
    const totalLinea = Math.round(cantidad * valor * (1 - desc / 100));
    return { it, p, cantidad, valor, totalLinea };
  });
  const subtotal = lineas.reduce((s, l) => s + l.cantidad * l.valor, 0);
  const total = lineas.reduce((s, l) => s + l.totalLinea, 0);
  if (!(total > 0))
    return { ok: false, error: "El total del pedido debe ser mayor a cero." };

  const prefijo = empresa.prefijo_pedido as string;

  // 3) Construir payload WO (mismo mapeo que el camino crítico). El `numero` va
  //    como placeholder: la función atómica le pone el consecutivo real.
  const woInput: PedidoWOInput = {
    empresa: {
      woIdEmpresa: empresa.wo_id_empresa ?? null,
      documentoTipoPedido: empresa.documento_tipo_pedido ?? null,
      formaPago: empresa.forma_pago_default,
      moneda: empresa.moneda,
      bodegaDefault: empresa.bodega_default ?? null,
      centroCostoDefault: empresa.centro_costo_default ?? null,
    },
    cliente: {
      woIdTercero: cliente.wo_id_tercero ?? null,
      woIdDireccion: cliente.wo_id_direccion ?? null,
      descuentoPct: desc,
    },
    prefijo,
    numero: "",
    fecha: new Date().toISOString().slice(0, 10),
    renglones: lineas.map((l) => ({
      woIdInventario: l.p.wo_id_inventario ?? null,
      woIdUnidad: l.p.wo_id_unidad ?? null,
      woIdImpuesto: l.p.wo_id_impuesto ?? null,
      codigoContable: l.p.codigo_contable,
      cantidad: l.cantidad,
      valorUnitario: l.valor,
      descuentoPct: desc,
    })),
  };
  const payload = buildWOPayload(woInput, WO_MODE);

  // Defensa en profundidad: validar el payload server-side antes de persistir
  // (el adapter vuelve a validar antes del POST a WO). El `numero` real lo pone
  // la RPC atómica; validamos con un placeholder para no bloquear por el
  // consecutivo aún no asignado.
  try {
    validateWOPayload({ ...payload, numero: "PENDIENTE" });
  } catch (e) {
    if (e instanceof WOValidationError)
      return { ok: false, error: `Payload inválido (${e.code}): ${e.message}` };
    throw e;
  }

  // Snapshots inmutables de cada línea para la función atómica.
  const itemsSnapshot = lineas.map((l) => ({
    producto_id: l.p.id,
    descripcion: l.p.descripcion,
    codigo_interno: l.p.codigo_interno,
    codigo_contable: l.p.codigo_contable,
    wo_id_inventario: l.p.wo_id_inventario ?? "",
    cantidad: l.cantidad,
    valor_unitario: l.valor,
    total_linea: l.totalLinea,
  }));

  // 4) Creación ATÓMICA: consecutivo + cotización + items + pedido + items en
  //    UNA transacción (RPC crear_pedido_atomico). Si algo falla, el rollback
  //    revierte también el consecutivo → no quedan huecos en la numeración. El
  //    numero real y la idempotency_key se derivan dentro de la función. Un
  //    reintento cubre fallos transitorios (p. ej. 503) sin riesgo de duplicar.
  let creado: { pedido_id: string; consecutivo: number } | null = null;
  for (let intento = 0; intento < 2 && !creado; intento++) {
    const { data, error } = await supabase.rpc("crear_pedido_atomico", {
      p_cliente: input.clienteId,
      p_descuento: desc,
      p_subtotal: subtotal,
      p_total: total,
      p_wo_payload: payload,
      p_items: itemsSnapshot,
    });
    if (!error && data) creado = data as { pedido_id: string; consecutivo: number };
  }
  if (!creado)
    return { ok: false, error: "No se pudo crear el pedido. Vuelve a intentar." };

  const pedidoId = creado.pedido_id;
  const numero = String(creado.consecutivo);

  // 6) Camino crítico. Si n8n está configurado, delega allá (diseño del spec:
  //    el pedido nuevo dispara el flujo crearPedido en n8n). Si no, in-app.
  const n8nUrl = process.env.N8N_WEBHOOK_CREAR_PEDIDO;
  if (n8nUrl) {
    await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido_id: pedidoId }),
    }).catch(() => undefined);
    revalidatePath("/vendedor");
    return { ok: true, pedidoId: pedidoId, numero: `${prefijo}-${numero}`, estado: "confirmado" };
  }

  const sync = await sincronizarPedidoWO(pedidoId);
  await enviarNotificacionPedido(pedidoId).catch(() => undefined); // best-effort

  revalidatePath("/vendedor");
  return {
    ok: true,
    pedidoId: pedidoId,
    numero: `${prefijo}-${numero}`,
    numeroWo: sync.numero,
    estado: sync.estado,
  };
}

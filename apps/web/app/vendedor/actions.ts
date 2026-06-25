"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  buildWOPayload,
  idempotencyKey,
  type PedidoWOInput,
} from "@/lib/worldoffice/mapping";
import { sincronizarPedidoWO } from "@/lib/pedidos/sync";
import { enviarNotificacionPedido } from "@/lib/notificaciones/email";
import { interpretarConsulta } from "@/lib/agente/interpretar";

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
  const interpretado = interpretarConsulta(query);
  if (!interpretado) return { interpretado: "", candidatos: [] };
  const supabase = await createClient();
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

  // 3) Consecutivo atómico (sostiene la idempotencia).
  const { data: consecutivo, error: errCons } = await supabase.rpc("siguiente_consecutivo");
  if (errCons || consecutivo == null)
    return { ok: false, error: "No se pudo reservar el consecutivo." };
  const prefijo = empresa.prefijo_pedido as string;
  const numero = String(consecutivo);

  // 4) Construir payload WO (mismo mapeo que el camino crítico) + idempotency_key.
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
    numero,
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
  const idemKey = idempotencyKey(payload);

  // 5) Persistir cotización + pedido + items (snapshots).
  const { data: coti, error: errCoti } = await supabase
    .from("cotizaciones")
    .insert({
      vendedor_id: user.id,
      cliente_id: input.clienteId,
      estado: "convertida",
      descuento_pct: desc,
      subtotal,
      total,
    })
    .select("id")
    .single();
  if (errCoti || !coti) return { ok: false, error: "No se pudo crear la cotización." };

  await supabase.from("cotizacion_items").insert(
    lineas.map((l) => ({
      cotizacion_id: coti.id,
      producto_id: l.p.id,
      descripcion_snapshot: l.p.descripcion,
      codigo_interno_snapshot: l.p.codigo_interno,
      codigo_contable_snapshot: l.p.codigo_contable,
      wo_id_inventario_snapshot: l.p.wo_id_inventario ?? null,
      cantidad: l.cantidad,
      valor_unitario: l.valor,
      descuento_pct: desc,
      total_linea: l.totalLinea,
    }))
  );

  const { data: pedido, error: errPed } = await supabase
    .from("pedidos")
    .insert({
      cotizacion_id: coti.id,
      vendedor_id: user.id,
      cliente_id: input.clienteId,
      prefijo,
      consecutivo,
      estado: "confirmado",
      idempotency_key: idemKey,
      wo_payload: payload,
      subtotal,
      total,
    })
    .select("id")
    .single();
  if (errPed || !pedido) return { ok: false, error: "No se pudo crear el pedido." };

  await supabase.from("pedido_items").insert(
    lineas.map((l) => ({
      pedido_id: pedido.id,
      producto_id: l.p.id,
      descripcion_snapshot: l.p.descripcion,
      codigo_interno_snapshot: l.p.codigo_interno,
      codigo_contable_snapshot: l.p.codigo_contable,
      wo_id_inventario_snapshot: l.p.wo_id_inventario ?? null,
      cantidad: l.cantidad,
      valor_unitario: l.valor,
      descuento_pct: desc,
      total_linea: l.totalLinea,
    }))
  );

  // 6) Camino crítico. Si n8n está configurado, delega allá (diseño del spec:
  //    el pedido nuevo dispara el flujo crearPedido en n8n). Si no, in-app.
  const n8nUrl = process.env.N8N_WEBHOOK_CREAR_PEDIDO;
  if (n8nUrl) {
    await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedido_id: pedido.id }),
    }).catch(() => undefined);
    revalidatePath("/vendedor");
    return { ok: true, pedidoId: pedido.id, numero: `${prefijo}-${numero}`, estado: "confirmado" };
  }

  const sync = await sincronizarPedidoWO(pedido.id);
  await enviarNotificacionPedido(pedido.id).catch(() => undefined); // best-effort

  revalidatePath("/vendedor");
  return {
    ok: true,
    pedidoId: pedido.id,
    numero: `${prefijo}-${numero}`,
    numeroWo: sync.numero,
    estado: sync.estado,
  };
}

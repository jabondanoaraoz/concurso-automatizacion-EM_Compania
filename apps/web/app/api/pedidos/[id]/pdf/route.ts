// Genera el PDF de un pedido con marca E.M. La lectura usa el cliente de sesión
// (RLS): solo el vendedor dueño, contable o admin pueden descargarlo.
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { documentoPedido, type DatosDocumento } from "@/lib/documentos/pedido-pdf";

const ESTADO: Record<string, string> = {
  confirmado: "Confirmado",
  sincronizado_wo: "Sincronizado WO",
  pendiente_sync: "Pendiente sync",
  facturado: "Facturado",
  error: "Error",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: pedido } = await supabase
    .from("pedidos")
    .select(
      "prefijo, consecutivo, estado, numero_wo, subtotal, total, created_at, cliente:clientes(nombre, nit), vendedor:usuarios(nombre), pedido_items(codigo_interno_snapshot, descripcion_snapshot, cantidad, valor_unitario, descuento_pct, total_linea)"
    )
    .eq("id", id)
    .single();

  if (!pedido) return new Response("Pedido no encontrado.", { status: 404 });

  const { data: empresa } = await supabase.from("empresa").select("nombre").single();

  const p = pedido as unknown as {
    prefijo: string;
    consecutivo: number;
    estado: string;
    numero_wo: string | null;
    subtotal: number;
    total: number;
    created_at: string;
    cliente: { nombre: string; nit: string | null } | null;
    vendedor: { nombre: string } | null;
    pedido_items: {
      codigo_interno_snapshot: string;
      descripcion_snapshot: string;
      cantidad: number;
      valor_unitario: number;
      descuento_pct: number;
      total_linea: number;
    }[];
  };

  const datos: DatosDocumento = {
    empresaNombre: empresa?.nombre ?? "E.M. Compañía S.A.S",
    tipo: "Pedido",
    numero: `${p.prefijo}-${p.consecutivo}`,
    fecha: p.created_at.slice(0, 10),
    estado: ESTADO[p.estado] ?? p.estado,
    numeroWo: p.numero_wo,
    clienteNombre: p.cliente?.nombre ?? "—",
    clienteNit: p.cliente?.nit ?? null,
    vendedorNombre: p.vendedor?.nombre ?? "—",
    lineas: p.pedido_items.map((i) => ({
      codigo: i.codigo_interno_snapshot,
      descripcion: i.descripcion_snapshot,
      cantidad: i.cantidad,
      valorUnitario: Number(i.valor_unitario),
      descuentoPct: Number(i.descuento_pct),
      totalLinea: Number(i.total_linea),
    })),
    subtotal: Number(p.subtotal),
    total: Number(p.total),
  };

  const buffer = await renderToBuffer(documentoPedido(datos));

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${datos.numero}.pdf"`,
    },
  });
}

// ============================================================================
// Notificación de pedido nuevo (sección 12 del Build Spec).
// construirCorreoPedido: contenido determinista (reutilizable por n8n en Fase 2.4).
// enviarNotificacionPedido: envía vía Composio Gmail. En concurso el destinatario
// es el correo de Joaquín; en producción → correo del área contable de E.M.
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

// CONCURSO: destinatario = correo de Joaquín. PROD: cambiar a contabilidad de E.M.
const DESTINO = process.env.NOTIFICACION_EMAIL ?? "joabon2799@gmail.com";
const URL_PANEL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export interface LineaCorreo {
  descripcion: string;
  cantidad: number;
  total_linea: number;
}
export interface DatosCorreoPedido {
  prefijo: string;
  consecutivo: number;
  clienteNombre: string;
  vendedorNombre: string;
  total: number;
  numeroWo: string | null;
  lineas: LineaCorreo[];
}
export interface CorreoPedido {
  to: string;
  subject: string;
  html: string;
}

export function construirCorreoPedido(d: DatosCorreoPedido): CorreoPedido {
  const numero = `${d.prefijo}-${d.consecutivo}`;
  const filas = d.lineas
    .map(
      (l) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #DADCE0;">${l.descripcion}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #DADCE0;text-align:center;">${l.cantidad}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #DADCE0;text-align:right;">${cop.format(l.total_linea)}</td>
      </tr>`
    )
    .join("");

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1D1E20;">
    <div style="display:flex;align-items:center;gap:10px;padding:16px 0;border-bottom:3px solid #CC3527;">
      <div style="width:28px;height:28px;border-radius:6px;background:#CC3527;"></div>
      <strong style="font-size:18px;">EM-Pedidos</strong>
    </div>
    <h2 style="margin:20px 0 4px;">Nuevo pedido ${numero}</h2>
    <p style="color:#5F6368;margin:0 0 16px;">
      Cliente: <strong>${d.clienteNombre}</strong> · Vendedor: ${d.vendedorNombre}
      ${d.numeroWo ? ` · Número WO: <strong>${d.numeroWo}</strong>` : ""}
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background:#E8EAEF;text-align:left;">
          <th style="padding:6px 8px;">Producto</th>
          <th style="padding:6px 8px;text-align:center;">Cant.</th>
          <th style="padding:6px 8px;text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
    <p style="text-align:right;font-size:16px;margin:14px 0;">
      Total del pedido: <strong>${cop.format(d.total)}</strong>
    </p>
    <a href="${URL_PANEL}/contable"
       style="display:inline-block;background:#CC3527;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;">
      Ver en el panel contable
    </a>
    <p style="color:#9AA0A6;font-size:12px;margin-top:24px;">
      Concurso Aztec · modo demostración. En producción este correo llega al área contable de E.M.
    </p>
  </div>`;

  return { to: DESTINO, subject: `Nuevo pedido ${numero} — ${d.clienteNombre}`, html };
}

// Carga el pedido y dispara el correo. Best-effort: nunca rompe el flujo del pedido.
export async function enviarNotificacionPedido(
  pedidoId: string
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data: pedido } = await admin
    .from("pedidos")
    .select(
      "prefijo, consecutivo, total, numero_wo, vendedor:usuarios(nombre), cliente:clientes(nombre), pedido_items(descripcion_snapshot, cantidad, total_linea)"
    )
    .eq("id", pedidoId)
    .single();
  if (!pedido) return { ok: false, error: "Pedido no encontrado." };

  const p = pedido as unknown as {
    prefijo: string;
    consecutivo: number;
    total: number;
    numero_wo: string | null;
    vendedor: { nombre: string } | null;
    cliente: { nombre: string } | null;
    pedido_items: { descripcion_snapshot: string; cantidad: number; total_linea: number }[];
  };

  const correo = construirCorreoPedido({
    prefijo: p.prefijo,
    consecutivo: p.consecutivo,
    clienteNombre: p.cliente?.nombre ?? "—",
    vendedorNombre: p.vendedor?.nombre ?? "—",
    total: Number(p.total),
    numeroWo: p.numero_wo,
    lineas: p.pedido_items.map((i) => ({
      descripcion: i.descripcion_snapshot,
      cantidad: i.cantidad,
      total_linea: Number(i.total_linea),
    })),
  });

  // Envío vía Composio Gmail. Requiere COMPOSIO_API_KEY. Si no está, se omite
  // (en Fase 2.4 el envío autónomo lo opera n8n vía Composio).
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) return { ok: false, skipped: true };

  try {
    const res = await fetch(
      "https://backend.composio.dev/api/v3/tools/execute/GMAIL_SEND_EMAIL",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify({
          user_id: process.env.COMPOSIO_USER_ID ?? "default",
          arguments: {
            recipient_email: correo.to,
            subject: correo.subject,
            body: correo.html,
            is_html: true,
          },
        }),
      }
    );
    if (!res.ok) return { ok: false, error: `Composio HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error" };
  }
}

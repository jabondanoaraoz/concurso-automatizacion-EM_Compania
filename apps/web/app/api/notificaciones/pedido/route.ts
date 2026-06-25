// Endpoint de notificación para n8n (flujo crearPedido / notificacionContable).
// Reusa el composer de la app (cero divergencia). Protegido por secreto.

import { NextResponse } from "next/server";
import { enviarNotificacionPedido } from "@/lib/notificaciones/email";

export async function POST(req: Request) {
  const secreto = process.env.N8N_SHARED_SECRET;
  if (secreto && req.headers.get("x-n8n-secret") !== secreto) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  let body: { pedido_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }
  if (!body.pedido_id) {
    return NextResponse.json({ ok: false, error: "Falta pedido_id." }, { status: 400 });
  }
  const r = await enviarNotificacionPedido(body.pedido_id);
  return NextResponse.json(r);
}

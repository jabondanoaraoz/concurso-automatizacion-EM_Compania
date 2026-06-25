// Devuelve el correo del pedido YA COMPUESTO (to/subject/html) sin enviarlo.
// Lo consume n8n para enviar por SMTP (Gmail). Protegido por secreto compartido.

import { NextResponse } from "next/server";
import { componerCorreoPedido } from "@/lib/notificaciones/email";

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
  const correo = await componerCorreoPedido(body.pedido_id);
  if (!correo) {
    return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
  }
  return NextResponse.json(correo); // { to, subject, html }
}

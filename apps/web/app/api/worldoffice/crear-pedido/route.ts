// HTTP wrapper del WorldOfficeAdapter. Único punto WO expuesto a n8n.
// n8n (flujo crearPedido) hace POST aquí con el wo_payload; este endpoint
// invoca getAdapter().crearPedido (mock|live) y devuelve el WOResult.
// Protegido por secreto compartido (header x-n8n-secret).

import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/worldoffice/adapter";
import type { WOPedidoPayload } from "@/lib/worldoffice/types";

export async function POST(req: Request) {
  // Fail-closed: sin secreto configurado, el endpoint no opera (evita quedar
  // abierto en un deploy mal configurado). El camino in-app no usa este endpoint.
  const secreto = process.env.N8N_SHARED_SECRET;
  if (!secreto) {
    return NextResponse.json(
      { ok: false, error: "Endpoint no configurado (falta N8N_SHARED_SECRET)." },
      { status: 503 }
    );
  }
  if (req.headers.get("x-n8n-secret") !== secreto) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  let body: { payload?: WOPedidoPayload };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }
  if (!body.payload) {
    return NextResponse.json({ ok: false, error: "Falta payload." }, { status: 400 });
  }

  const adapter = getAdapter();
  const result = await adapter.crearPedido(body.payload);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}

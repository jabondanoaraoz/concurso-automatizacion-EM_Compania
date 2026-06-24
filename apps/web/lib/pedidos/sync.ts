// ============================================================================
// Sincronización determinista de un pedido con World Office (sin IA).
// Reusable: la llama el cotizador (Fase 1) y la llamará n8n vía HTTP (Fase 2).
// Lee el payload ya congelado del pedido, invoca el adapter (mock|live) y
// actualiza estado + sync_logs. Usa el cliente admin (operación de sistema).
// ============================================================================

import { createAdminClient } from "@/lib/supabase/admin";
import { getAdapter } from "@/lib/worldoffice/adapter";
import type { WOPedidoPayload } from "@/lib/worldoffice/types";

export interface SyncResult {
  ok: boolean;
  estado: "sincronizado_wo" | "pendiente_sync";
  numero?: string;
  errorCode?: string;
  moreInfo?: string;
}

export async function sincronizarPedidoWO(pedidoId: string): Promise<SyncResult> {
  const admin = createAdminClient();

  const { data: pedido, error } = await admin
    .from("pedidos")
    .select("id, wo_payload")
    .eq("id", pedidoId)
    .single();

  if (error || !pedido?.wo_payload) {
    return { ok: false, estado: "pendiente_sync", errorCode: "PAYLOAD_NO_DISPONIBLE" };
  }

  const payload = pedido.wo_payload as WOPedidoPayload;
  const adapter = getAdapter();
  const result = await adapter.crearPedido(payload);

  // Auditoría: cada intento queda en sync_logs.
  await admin.from("sync_logs").insert({
    pedido_id: pedidoId,
    intento: 1,
    request: payload,
    response: result.raw ?? { errorCode: result.errorCode, moreInfo: result.moreInfo },
    status: result.ok ? "ok" : "error",
    error_code: result.ok ? null : result.errorCode,
    error_more_info: result.ok ? null : result.moreInfo,
  });

  if (result.ok) {
    await admin
      .from("pedidos")
      .update({
        estado: "sincronizado_wo",
        numero_wo: result.numero,
        wo_response: result.raw ?? {},
        synced_at: new Date().toISOString(),
      })
      .eq("id", pedidoId);
    return { ok: true, estado: "sincronizado_wo", numero: result.numero };
  }

  await admin
    .from("pedidos")
    .update({
      estado: "pendiente_sync",
      wo_response: { errorCode: result.errorCode, moreInfo: result.moreInfo },
    })
    .eq("id", pedidoId);
  return {
    ok: false,
    estado: "pendiente_sync",
    errorCode: result.errorCode,
    moreInfo: result.moreInfo,
  };
}

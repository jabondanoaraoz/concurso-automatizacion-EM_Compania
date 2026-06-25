"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { WOPedidoPayload } from "@/lib/worldoffice/types";

export interface PedidoRow {
  id: string;
  prefijo: string;
  consecutivo: number;
  estado: string;
  numero_wo: string | null;
  subtotal: number;
  total: number;
  created_at: string;
  wo_payload: WOPedidoPayload | null;
  vendedor: { nombre: string } | null;
  cliente: { nombre: string } | null;
}

const SELECT =
  "id, prefijo, consecutivo, estado, numero_wo, subtotal, total, created_at, wo_payload, vendedor:usuarios(nombre), cliente:clientes(nombre)";

// Lista de pedidos para contabilidad (RLS: contable/admin ven todo).
export async function listarPedidos(vendedorId?: string): Promise<PedidoRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("pedidos")
    .select(SELECT)
    .order("created_at", { ascending: false })
    .limit(100);
  if (vendedorId) q = q.eq("vendedor_id", vendedorId);
  const { data } = await q;
  return (data ?? []) as unknown as PedidoRow[];
}

// Marca un pedido como facturado (un clic). RLS permite a contable cambiar estado.
export async function marcarFacturado(
  pedidoId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("pedidos")
    .update({ estado: "facturado" })
    .eq("id", pedidoId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/contable");
  return { ok: true };
}

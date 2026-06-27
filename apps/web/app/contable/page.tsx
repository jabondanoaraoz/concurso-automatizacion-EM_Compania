import { createClient } from "@/lib/supabase/server";
import { listarPedidos } from "./actions";
import { PanelContable } from "./panel-contable";

// Página autenticada por rol: nunca cachear el shell (evita servir HTML obsoleto).
export const dynamic = "force-dynamic";

export default async function ContableHome() {
  const supabase = await createClient();
  const pedidos = await listarPedidos();
  const { data: vendedores } = await supabase
    .from("usuarios")
    .select("id, nombre")
    .eq("rol", "vendedor")
    .order("nombre");

  return <PanelContable initialPedidos={pedidos} vendedores={vendedores ?? []} />;
}

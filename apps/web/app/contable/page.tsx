import { createClient } from "@/lib/supabase/server";
import { listarPedidos } from "./actions";
import { PanelContable } from "./panel-contable";

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

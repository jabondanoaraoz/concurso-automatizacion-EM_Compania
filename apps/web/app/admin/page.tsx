import { createClient } from "@/lib/supabase/server";
import { listarCatalogo } from "./actions";
import {
  AdminPanel,
  type UsuarioRow,
  type ClienteRow,
  type EmpresaCfg,
} from "./admin-panel";

// Página autenticada por rol: nunca cachear el shell (evita servir HTML obsoleto).
export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const supabase = await createClient();

  const [{ data: usuarios }, { data: empresa }, { data: clientes }, catalogo] =
    await Promise.all([
      supabase.from("usuarios").select("id, nombre, email, rol, activo").order("rol"),
      supabase
        .from("empresa")
        .select("prefijo_pedido, forma_pago_default, moneda, bodega_default, centro_costo_default")
        .single(),
      supabase.from("clientes").select("id, nombre, nit, descuento_pct").order("nombre"),
      listarCatalogo(""),
    ]);

  return (
    <AdminPanel
      usuarios={(usuarios ?? []) as UsuarioRow[]}
      empresa={empresa as EmpresaCfg}
      clientes={(clientes ?? []) as ClienteRow[]}
      catalogo={catalogo}
    />
  );
}

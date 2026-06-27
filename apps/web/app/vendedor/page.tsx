import { createClient } from "@/lib/supabase/server";
import { Cotizador, type ClienteOpcion } from "./cotizador";

// Página autenticada por rol: nunca cachear el shell (evita servir HTML obsoleto).
export const dynamic = "force-dynamic";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const ESTADO_LABEL: Record<string, string> = {
  confirmado: "Confirmado",
  sincronizado_wo: "Sincronizado WO",
  pendiente_sync: "Pendiente sync",
  facturado: "Facturado",
  error: "Error",
};

export default async function VendedorHome() {
  const supabase = await createClient();

  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, nombre, descuento_pct")
    .eq("activo", true)
    .order("nombre");

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id, prefijo, consecutivo, estado, total, numero_wo, created_at")
    .order("created_at", { ascending: false })
    .limit(15);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-title text-2xl font-semibold">Cotizar</h1>
        <p className="mt-1 text-ink-2">
          Busca por código o descripción, aplica el descuento del cliente y confirma el pedido.
        </p>
      </div>

      <Cotizador clientes={(clientes ?? []) as ClienteOpcion[]} />

      <div>
        <h2 className="font-title text-lg font-semibold">Mis pedidos</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-bg-2 text-left text-ink-2">
              <tr>
                <th className="px-4 py-2 font-medium">Pedido</th>
                <th className="px-4 py-2 font-medium">Estado</th>
                <th className="px-4 py-2 font-medium">Número WO</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(pedidos ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-ink-3">
                    Aún no has confirmado pedidos.
                  </td>
                </tr>
              ) : (
                (pedidos ?? []).map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 font-medium">
                      {p.prefijo}-{p.consecutivo}
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-bg-2 px-2 py-0.5 text-xs">
                        {ESTADO_LABEL[p.estado] ?? p.estado}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-ink-2">{p.numero_wo ?? "—"}</td>
                    <td className="px-4 py-2 text-right">{cop.format(Number(p.total))}</td>
                    <td className="px-4 py-2 text-right">
                      <a
                        href={`/api/pedidos/${p.id}/pdf`}
                        target="_blank"
                        className="text-accent hover:underline"
                      >
                        PDF
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

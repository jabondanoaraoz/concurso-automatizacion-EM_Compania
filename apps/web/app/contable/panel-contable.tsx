"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { listarPedidos, marcarFacturado, type PedidoRow } from "./actions";

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

function descargar(nombre: string, contenido: string, tipo: string) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

function csvDeRenglones(p: PedidoRow): string {
  const head = [
    "idInventario",
    "unidadMedida",
    "cantidad",
    "valorUnitario",
    "porcentajeDescuento",
    "idBodega",
    "idCentroCosto",
    "idImpuesto",
  ];
  const filas = (p.wo_payload?.renglones ?? []).map((r) =>
    [
      r.idInventario,
      r.unidadMedida,
      r.cantidad,
      r.valorUnitario,
      r.porcentajeDescuento,
      r.idBodega,
      r.idCentroCosto,
      r.idImpuesto,
    ].join(",")
  );
  return [head.join(","), ...filas].join("\n");
}

export function PanelContable({
  initialPedidos,
  vendedores,
}: {
  initialPedidos: PedidoRow[];
  vendedores: { id: string; nombre: string }[];
}) {
  const [pedidos, setPedidos] = useState<PedidoRow[]>(initialPedidos);
  const [filtro, setFiltro] = useState("");
  const [sel, setSel] = useState<PedidoRow | null>(null);
  const [, startRefrescar] = useTransition();
  const [facturando, startFacturar] = useTransition();

  const refrescar = useCallback(
    (vendedorId: string) =>
      startRefrescar(async () => setPedidos(await listarPedidos(vendedorId || undefined))),
    []
  );

  // Realtime: cualquier cambio en pedidos refresca la lista (con el filtro actual).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("pedidos-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos" },
        () => refrescar(filtro)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [filtro, refrescar]);

  function onFiltro(v: string) {
    setFiltro(v);
    refrescar(v);
  }

  function facturar(p: PedidoRow) {
    startFacturar(async () => {
      await marcarFacturado(p.id);
      refrescar(filtro);
      setSel(null);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-title text-2xl font-semibold">Pedidos</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-2">Vendedor:</span>
          <select
            value={filtro}
            onChange={(e) => onFiltro(e.target.value)}
            className="rounded-md border border-border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-focus"
          >
            <option value="">Todos</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-bg-2 text-left text-ink-2">
            <tr>
              <th className="px-4 py-2 font-medium">Pedido</th>
              <th className="px-4 py-2 font-medium">Vendedor</th>
              <th className="px-4 py-2 font-medium">Cliente</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 text-right font-medium">Total</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pedidos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-ink-3">
                  No hay pedidos.
                </td>
              </tr>
            ) : (
              pedidos.map((p) => (
                <tr key={p.id} className="hover:bg-bg-2/50">
                  <td className="px-4 py-2 font-medium">
                    {p.prefijo}-{p.consecutivo}
                  </td>
                  <td className="px-4 py-2 text-ink-2">{p.vendedor?.nombre ?? "—"}</td>
                  <td className="px-4 py-2 text-ink-2">{p.cliente?.nombre ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-bg-2 px-2 py-0.5 text-xs">
                      {ESTADO_LABEL[p.estado] ?? p.estado}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">{cop.format(Number(p.total))}</td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setSel(p)}>
                      Ver
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {sel && (
        <div className="rounded-xl border border-border bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-title text-lg font-semibold">
                Pedido {sel.prefijo}-{sel.consecutivo}
              </h2>
              <p className="text-sm text-ink-2">
                {sel.vendedor?.nombre} · {sel.cliente?.nombre} ·{" "}
                {ESTADO_LABEL[sel.estado] ?? sel.estado}
                {sel.numero_wo ? ` · WO ${sel.numero_wo}` : ""}
              </p>
            </div>
            <button
              onClick={() => setSel(null)}
              className="text-ink-3 hover:text-accent"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                descargar(
                  `${sel.prefijo}-${sel.consecutivo}-payload.json`,
                  JSON.stringify(sel.wo_payload ?? {}, null, 2),
                  "application/json"
                )
              }
            >
              Descargar payload JSON
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                descargar(
                  `${sel.prefijo}-${sel.consecutivo}-estructura.csv`,
                  csvDeRenglones(sel),
                  "text/csv"
                )
              }
            >
              Descargar estructura CSV
            </Button>
            {sel.estado !== "facturado" && (
              <Button size="sm" disabled={facturando} onClick={() => facturar(sel)}>
                {facturando ? "Facturando…" : "Marcar como facturado"}
              </Button>
            )}
          </div>

          <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-bg-2 p-4 text-xs">
            {JSON.stringify(sel.wo_payload ?? {}, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

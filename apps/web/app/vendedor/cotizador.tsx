"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  buscarProductos,
  confirmarPedido,
  sugerenciasAgente,
  type ResultadoBusqueda,
  type ConfirmarResultado,
  type SugerenciasResultado,
} from "./actions";

export interface ClienteOpcion {
  id: string;
  nombre: string;
  descuento_pct: number;
}

interface LineaCarrito {
  producto: ResultadoBusqueda;
  cantidad: number;
}

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function Cotizador({ clientes }: { clientes: ClienteOpcion[] }) {
  const [clienteId, setClienteId] = useState("");
  const [descuento, setDescuento] = useState(0);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [resultado, setResultado] = useState<ConfirmarResultado | null>(null);
  const [sug, setSug] = useState<SugerenciasResultado | null>(null);
  const [buscando, startBuscar] = useTransition();
  const [pensando, startAgente] = useTransition();
  const [confirmando, startConfirmar] = useTransition();

  function asistente() {
    if (!query.trim()) return;
    startAgente(async () => setSug(await sugerenciasAgente(query)));
  }

  function onCliente(id: string) {
    setClienteId(id);
    const c = clientes.find((x) => x.id === id);
    setDescuento(c ? Number(c.descuento_pct) : 0);
  }

  function onBuscar(q: string) {
    setQuery(q);
    startBuscar(async () => setResultados(await buscarProductos(q)));
  }

  function agregar(p: ResultadoBusqueda) {
    setCarrito((prev) => {
      const ya = prev.find((l) => l.producto.id === p.id);
      if (ya)
        return prev.map((l) =>
          l.producto.id === p.id ? { ...l, cantidad: l.cantidad + 1 } : l
        );
      return [...prev, { producto: p, cantidad: 1 }];
    });
  }

  function setCantidad(id: string, cantidad: number) {
    setCarrito((prev) =>
      prev.map((l) => (l.producto.id === id ? { ...l, cantidad: Math.max(1, cantidad) } : l))
    );
  }

  function quitar(id: string) {
    setCarrito((prev) => prev.filter((l) => l.producto.id !== id));
  }

  const subtotal = carrito.reduce((s, l) => s + l.cantidad * Number(l.producto.precio_lista), 0);
  const total = Math.round(subtotal * (1 - descuento / 100));

  function confirmar() {
    setResultado(null);
    startConfirmar(async () => {
      const r = await confirmarPedido({
        clienteId,
        descuentoPct: descuento,
        items: carrito.map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad })),
      });
      setResultado(r);
      if (r.ok) {
        setCarrito([]);
        setQuery("");
        setResultados([]);
      }
    });
  }

  const puedeConfirmar = clienteId && carrito.length > 0 && !confirmando;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Columna izquierda: cliente + buscador + resultados */}
      <section className="space-y-4">
        <div className="rounded-xl border border-border bg-white p-4">
          <label className="mb-1 block text-sm text-ink-2">Cliente</label>
          <select
            value={clienteId}
            onChange={(e) => onCliente(e.target.value)}
            className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus"
          >
            <option value="">Selecciona un cliente…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} (desc. {Number(c.descuento_pct)}%)
              </option>
            ))}
          </select>

          <label className="mb-1 mt-3 block text-sm text-ink-2">Descuento aplicado (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={descuento}
            onChange={(e) => setDescuento(Number(e.target.value))}
            className="w-32 rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus"
          />
        </div>

        <div className="rounded-xl border border-border bg-white p-4">
          <label className="mb-1 block text-sm text-ink-2">
            Buscar producto (código o descripción)
          </label>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => onBuscar(e.target.value)}
              placeholder='Ej: 0100012  ·  "sello 7/8 res corto"  ·  "cap 35 uf"'
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus"
            />
            <Button variant="outline" onClick={asistente} disabled={pensando || !query.trim()}>
              {pensando ? "…" : "Asistente"}
            </Button>
          </div>
          <div className="mt-3 max-h-80 divide-y divide-border overflow-auto">
            {buscando && <p className="py-2 text-sm text-ink-3">Buscando…</p>}
            {!buscando && query && resultados.length === 0 && (
              <p className="py-2 text-sm text-ink-3">Sin resultados.</p>
            )}
            {resultados.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.descripcion}</p>
                  <p className="text-xs text-ink-3">
                    {p.codigo_interno} · {cop.format(Number(p.precio_lista))} · stock {p.stock}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => agregar(p)}>
                  Agregar
                </Button>
              </div>
            ))}
          </div>
        </div>

        {sug && (
          <div className="rounded-xl border border-accent/40 bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-accent">Sugerencias del asistente</h3>
              <button onClick={() => setSug(null)} className="text-ink-3 hover:text-accent" aria-label="Cerrar">
                ✕
              </button>
            </div>
            {sug.interpretado && (
              <p className="mt-1 text-xs text-ink-3">
                Interpreté tu consulta como: <span className="text-ink-2">“{sug.interpretado}”</span>
              </p>
            )}
            <div className="mt-2 max-h-72 divide-y divide-border overflow-auto">
              {sug.candidatos.length === 0 ? (
                <p className="py-2 text-sm text-ink-3">Sin sugerencias.</p>
              ) : (
                sug.candidatos.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.descripcion}</p>
                      <p className="text-xs text-ink-3">
                        {p.codigo_interno} · {cop.format(Number(p.precio_lista))} · stock {p.stock}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => agregar(p)}>
                      Agregar
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </section>

      {/* Columna derecha: carrito + totales + confirmar */}
      <section className="space-y-4">
        <div className="rounded-xl border border-border bg-white p-4">
          <h2 className="font-title text-lg font-semibold">Cotización</h2>
          {carrito.length === 0 ? (
            <p className="mt-2 text-sm text-ink-3">Agrega productos desde el buscador.</p>
          ) : (
            <div className="mt-3 divide-y divide-border">
              {carrito.map((l) => (
                <div key={l.producto.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.producto.descripcion}</p>
                    <p className="text-xs text-ink-3">
                      {l.producto.codigo_interno} · {cop.format(Number(l.producto.precio_lista))}
                    </p>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={l.cantidad}
                    onChange={(e) => setCantidad(l.producto.id, Number(e.target.value))}
                    className="w-16 rounded-md border border-border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-focus"
                  />
                  <span className="w-28 text-right text-sm">
                    {cop.format(l.cantidad * Number(l.producto.precio_lista))}
                  </span>
                  <button
                    onClick={() => quitar(l.producto.id)}
                    className="text-ink-3 hover:text-accent"
                    aria-label="Quitar"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between text-ink-2">
              <span>Subtotal</span>
              <span>{cop.format(subtotal)}</span>
            </div>
            <div className="flex justify-between text-ink-2">
              <span>Descuento ({descuento}%)</span>
              <span>− {cop.format(subtotal - total)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>{cop.format(total)}</span>
            </div>
          </div>

          <Button onClick={confirmar} disabled={!puedeConfirmar} className="mt-4 w-full">
            {confirmando ? "Confirmando…" : "Confirmar pedido"}
          </Button>
        </div>

        {resultado && (
          <div
            className={`rounded-xl border p-4 text-sm ${
              resultado.ok ? "border-border bg-white" : "border-accent bg-white"
            }`}
          >
            {resultado.ok ? (
              <>
                <p className="font-medium">Pedido {resultado.numero} confirmado.</p>
                <p className="mt-1 text-ink-2">
                  Estado WO: <strong>{resultado.estado}</strong>
                  {resultado.numeroWo ? ` · número WO ${resultado.numeroWo}` : ""}
                </p>
              </>
            ) : (
              <p className="text-accent">{resultado.error}</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

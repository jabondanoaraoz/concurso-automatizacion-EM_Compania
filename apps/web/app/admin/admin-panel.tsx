"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  crearUsuario,
  eliminarUsuario,
  guardarEmpresa,
  crearCliente,
  guardarDescuentoCliente,
  listarCatalogo,
  guardarProducto,
  crearProducto,
  type ProductoAdmin,
} from "./actions";

export interface UsuarioRow {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
}
export interface ClienteRow {
  id: string;
  nombre: string;
  nit: string | null;
  descuento_pct: number;
}
export interface EmpresaCfg {
  prefijo_pedido: string;
  forma_pago_default: string;
  moneda: string;
  bodega_default: string | null;
  centro_costo_default: string | null;
}

const input =
  "w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus";
const card = "rounded-xl border border-border bg-white p-5";

type Tab = "usuarios" | "empresa" | "clientes" | "catalogo";

export function AdminPanel({
  usuarios,
  empresa,
  clientes,
  catalogo,
}: {
  usuarios: UsuarioRow[];
  empresa: EmpresaCfg;
  clientes: ClienteRow[];
  catalogo: ProductoAdmin[];
}) {
  const [tab, setTab] = useState<Tab>("usuarios");
  const tabs: [Tab, string][] = [
    ["usuarios", "Usuarios"],
    ["empresa", "Empresa"],
    ["clientes", "Clientes"],
    ["catalogo", "Catálogo"],
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-title text-2xl font-semibold">Administración</h1>
      <div className="flex gap-1 border-b border-border">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === k
                ? "border-b-2 border-accent text-accent"
                : "text-ink-2 hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "usuarios" && <TabUsuarios usuarios={usuarios} />}
      {tab === "empresa" && <TabEmpresa empresa={empresa} />}
      {tab === "clientes" && <TabClientes clientes={clientes} />}
      {tab === "catalogo" && <TabCatalogo inicial={catalogo} />}
    </div>
  );
}

function Aviso({ msg }: { msg: { ok: boolean; texto: string } | null }) {
  if (!msg) return null;
  return (
    <p className={`text-sm ${msg.ok ? "text-ink-2" : "text-accent"}`}>{msg.texto}</p>
  );
}

// ---- Usuarios ----
function TabUsuarios({ usuarios }: { usuarios: UsuarioRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    rol: "vendedor" as "vendedor" | "contable",
    password: "",
  });

  function crear() {
    start(async () => {
      const r = await crearUsuario(form);
      setMsg({ ok: r.ok, texto: r.ok ? "Usuario creado." : r.error! });
      if (r.ok) {
        setForm({ nombre: "", email: "", rol: "vendedor", password: "" });
        router.refresh();
      }
    });
  }
  function eliminar(id: string) {
    start(async () => {
      const r = await eliminarUsuario(id);
      setMsg({ ok: r.ok, texto: r.ok ? "Usuario eliminado." : r.error! });
      if (r.ok) router.refresh();
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className={card}>
        <h2 className="font-title text-lg font-semibold">Usuarios</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-ink-2">
            <tr>
              <th className="py-1 font-medium">Nombre</th>
              <th className="py-1 font-medium">Rol</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td className="py-2">
                  <div>{u.nombre}</div>
                  <div className="text-xs text-ink-3">{u.email}</div>
                </td>
                <td className="py-2 capitalize">{u.rol}</td>
                <td className="py-2 text-right">
                  {u.rol !== "administrador" && (
                    <button
                      disabled={pending}
                      onClick={() => eliminar(u.id)}
                      className="text-ink-3 hover:text-accent"
                    >
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={card}>
        <h2 className="font-title text-lg font-semibold">Crear usuario</h2>
        <div className="mt-3 space-y-3">
          <input
            className={input}
            placeholder="Nombre"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
          <input
            className={input}
            placeholder="Correo"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <select
            className={input}
            value={form.rol}
            onChange={(e) => setForm({ ...form, rol: e.target.value as "vendedor" | "contable" })}
          >
            <option value="vendedor">Vendedor</option>
            <option value="contable">Contable</option>
          </select>
          <input
            className={input}
            placeholder="Contraseña (mín. 8)"
            type="text"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <Button onClick={crear} disabled={pending} className="w-full">
            {pending ? "Creando…" : "Crear usuario"}
          </Button>
          <Aviso msg={msg} />
        </div>
      </div>
    </div>
  );
}

// ---- Empresa ----
function TabEmpresa({ empresa }: { empresa: EmpresaCfg }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [f, setF] = useState({
    prefijo_pedido: empresa.prefijo_pedido,
    forma_pago_default: empresa.forma_pago_default,
    moneda: empresa.moneda,
    bodega_default: empresa.bodega_default ?? "",
    centro_costo_default: empresa.centro_costo_default ?? "",
  });

  function guardar() {
    start(async () => {
      const r = await guardarEmpresa(f);
      setMsg({ ok: r.ok, texto: r.ok ? "Configuración guardada." : r.error! });
    });
  }

  const campos: [keyof typeof f, string][] = [
    ["prefijo_pedido", "Prefijo de pedido"],
    ["forma_pago_default", "Forma de pago"],
    ["moneda", "Moneda"],
    ["bodega_default", "Bodega (wo_id, go-live)"],
    ["centro_costo_default", "Centro de costo (wo_id, go-live)"],
  ];

  return (
    <div className={`${card} max-w-lg`}>
      <h2 className="font-title text-lg font-semibold">Parámetros de empresa</h2>
      <div className="mt-3 space-y-3">
        {campos.map(([k, label]) => (
          <div key={k}>
            <label className="mb-1 block text-sm text-ink-2">{label}</label>
            <input
              className={input}
              value={f[k]}
              onChange={(e) => setF({ ...f, [k]: e.target.value })}
            />
          </div>
        ))}
        <Button onClick={guardar} disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        <Aviso msg={msg} />
      </div>
    </div>
  );
}

// ---- Clientes ----
function TabClientes({ clientes }: { clientes: ClienteRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [desc, setDesc] = useState<Record<string, number>>(
    Object.fromEntries(clientes.map((c) => [c.id, Number(c.descuento_pct)]))
  );
  const [nuevo, setNuevo] = useState({ nombre: "", nit: "", descuento_pct: 0 });

  function guardar(id: string) {
    start(async () => {
      const r = await guardarDescuentoCliente(id, desc[id]);
      setMsg({ ok: r.ok, texto: r.ok ? "Descuento actualizado." : r.error! });
    });
  }
  function crear() {
    start(async () => {
      const r = await crearCliente(nuevo);
      setMsg({ ok: r.ok, texto: r.ok ? "Cliente creado." : r.error! });
      if (r.ok) {
        setNuevo({ nombre: "", nit: "", descuento_pct: 0 });
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className={card}>
        <h2 className="font-title text-lg font-semibold">Descuentos por cliente</h2>
        <table className="mt-3 w-full text-sm">
          <tbody className="divide-y divide-border">
            {clientes.map((c) => (
              <tr key={c.id}>
                <td className="py-2">
                  <div>{c.nombre}</div>
                  <div className="text-xs text-ink-3">{c.nit ?? "—"}</div>
                </td>
                <td className="py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    className="w-20 rounded-md border border-border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-focus"
                    value={desc[c.id]}
                    onChange={(e) => setDesc({ ...desc, [c.id]: Number(e.target.value) })}
                  />
                  <span className="ml-1 text-ink-3">%</span>
                </td>
                <td className="py-2 text-right">
                  <button
                    disabled={pending}
                    onClick={() => guardar(c.id)}
                    className="text-sm text-accent hover:underline"
                  >
                    Guardar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={card}>
        <h2 className="font-title text-lg font-semibold">Crear cliente</h2>
        <div className="mt-3 space-y-3">
          <input
            className={input}
            placeholder="Nombre"
            value={nuevo.nombre}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
          />
          <input
            className={input}
            placeholder="NIT"
            value={nuevo.nit}
            onChange={(e) => setNuevo({ ...nuevo, nit: e.target.value })}
          />
          <div>
            <label className="mb-1 block text-sm text-ink-2">Descuento (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              className={input}
              value={nuevo.descuento_pct}
              onChange={(e) => setNuevo({ ...nuevo, descuento_pct: Number(e.target.value) })}
            />
          </div>
          <Button onClick={crear} disabled={pending} className="w-full">
            {pending ? "Creando…" : "Crear cliente"}
          </Button>
          <Aviso msg={msg} />
        </div>
      </div>
    </div>
  );
}

// ---- Catálogo ----
function TabCatalogo({ inicial }: { inicial: ProductoAdmin[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [lista, setLista] = useState<ProductoAdmin[]>(inicial);
  const [q, setQ] = useState("");
  const [nuevo, setNuevo] = useState({
    codigo_interno: "",
    descripcion: "",
    familia: "sello_mecanico" as "sello_mecanico" | "capacitor" | "refrigeracion",
    precio_lista: 0,
    stock: 0,
  });

  function buscar(v: string) {
    setQ(v);
    start(async () => setLista(await listarCatalogo(v)));
  }
  function set(id: string, patch: Partial<ProductoAdmin>) {
    setLista((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function guardar(p: ProductoAdmin) {
    start(async () => {
      const r = await guardarProducto(p.id, {
        precio_lista: p.precio_lista,
        stock: p.stock,
        activo: p.activo,
      });
      setMsg({ ok: r.ok, texto: r.ok ? `${p.codigo_interno} actualizado.` : r.error! });
    });
  }
  function crear() {
    start(async () => {
      const r = await crearProducto(nuevo);
      setMsg({ ok: r.ok, texto: r.ok ? "Producto creado." : r.error! });
      if (r.ok) {
        setNuevo({ codigo_interno: "", descripcion: "", familia: "sello_mecanico", precio_lista: 0, stock: 0 });
        setLista(await listarCatalogo(q));
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-title text-lg font-semibold">Catálogo</h2>
          <input
            className="w-72 rounded-md border border-border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-focus"
            placeholder="Buscar por código o descripción"
            value={q}
            onChange={(e) => buscar(e.target.value)}
          />
        </div>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-ink-2">
            <tr>
              <th className="py-1 font-medium">Código</th>
              <th className="py-1 font-medium">Descripción</th>
              <th className="py-1 font-medium">Precio</th>
              <th className="py-1 font-medium">Stock</th>
              <th className="py-1 font-medium">Activo</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lista.map((p) => (
              <tr key={p.id}>
                <td className="py-2 font-medium">{p.codigo_interno}</td>
                <td className="max-w-xs truncate py-2 text-ink-2">{p.descripcion}</td>
                <td className="py-2">
                  <input
                    type="number"
                    className="w-24 rounded-md border border-border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-focus"
                    value={p.precio_lista}
                    onChange={(e) => set(p.id, { precio_lista: Number(e.target.value) })}
                  />
                </td>
                <td className="py-2">
                  <input
                    type="number"
                    className="w-16 rounded-md border border-border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-focus"
                    value={p.stock}
                    onChange={(e) => set(p.id, { stock: Number(e.target.value) })}
                  />
                </td>
                <td className="py-2">
                  <input
                    type="checkbox"
                    checked={p.activo}
                    onChange={(e) => set(p.id, { activo: e.target.checked })}
                  />
                </td>
                <td className="py-2 text-right">
                  <button
                    disabled={pending}
                    onClick={() => guardar(p)}
                    className="text-sm text-accent hover:underline"
                  >
                    Guardar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Aviso msg={msg} />
      </div>

      <div className={card}>
        <h2 className="font-title text-lg font-semibold">Crear producto</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            className={input}
            placeholder="Código interno (ej. 0100200)"
            value={nuevo.codigo_interno}
            onChange={(e) => setNuevo({ ...nuevo, codigo_interno: e.target.value })}
          />
          <select
            className={input}
            value={nuevo.familia}
            onChange={(e) =>
              setNuevo({ ...nuevo, familia: e.target.value as typeof nuevo.familia })
            }
          >
            <option value="sello_mecanico">Sello mecánico</option>
            <option value="capacitor">Capacitor</option>
            <option value="refrigeracion">Refrigeración</option>
          </select>
          <input
            className={`${input} sm:col-span-2`}
            placeholder="Descripción"
            value={nuevo.descripcion}
            onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })}
          />
          <input
            className={input}
            type="number"
            placeholder="Precio lista"
            value={nuevo.precio_lista}
            onChange={(e) => setNuevo({ ...nuevo, precio_lista: Number(e.target.value) })}
          />
          <input
            className={input}
            type="number"
            placeholder="Stock"
            value={nuevo.stock}
            onChange={(e) => setNuevo({ ...nuevo, stock: Number(e.target.value) })}
          />
          <Button onClick={crear} disabled={pending} className="sm:col-span-2">
            {pending ? "Creando…" : "Crear producto"}
          </Button>
        </div>
      </div>
    </div>
  );
}

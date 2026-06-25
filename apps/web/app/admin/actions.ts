"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";

type R = { ok: boolean; error?: string };

async function soyAdmin(): Promise<boolean> {
  const s = await getSessionUser();
  return s?.perfil.rol === "administrador";
}

// ---------------------------------------------------------------------------
// Usuarios (crear/eliminar vendedores y contables) — requiere admin client.
// ---------------------------------------------------------------------------
export async function crearUsuario(input: {
  nombre: string;
  email: string;
  rol: "vendedor" | "contable";
  password: string;
}): Promise<R> {
  if (!(await soyAdmin())) return { ok: false, error: "No autorizado." };
  if (!input.nombre || !input.email || !input.password)
    return { ok: false, error: "Completa nombre, correo y contraseña." };
  if (input.password.length < 8)
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });
  if (error || !data.user) return { ok: false, error: error?.message ?? "No se pudo crear." };

  const { error: e2 } = await admin
    .from("usuarios")
    .insert({ id: data.user.id, nombre: input.nombre, email: input.email, rol: input.rol });
  if (e2) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, error: e2.message };
  }
  revalidatePath("/admin");
  return { ok: true };
}

export async function eliminarUsuario(id: string): Promise<R> {
  if (!(await soyAdmin())) return { ok: false, error: "No autorizado." };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id); // cascada borra fila en usuarios
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Configuración de empresa — RLS admin write (user client).
// ---------------------------------------------------------------------------
export async function guardarEmpresa(input: {
  prefijo_pedido: string;
  forma_pago_default: string;
  moneda: string;
  bodega_default: string;
  centro_costo_default: string;
}): Promise<R> {
  const supabase = await createClient();
  const { data: emp } = await supabase.from("empresa").select("id").single();
  if (!emp) return { ok: false, error: "Configuración no encontrada." };
  const { error } = await supabase
    .from("empresa")
    .update({
      prefijo_pedido: input.prefijo_pedido,
      forma_pago_default: input.forma_pago_default,
      moneda: input.moneda,
      bodega_default: input.bodega_default || null,
      centro_costo_default: input.centro_costo_default || null,
    })
    .eq("id", emp.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Clientes (descuento por cliente) — RLS admin write.
// ---------------------------------------------------------------------------
export async function guardarDescuentoCliente(id: string, descuento: number): Promise<R> {
  const supabase = await createClient();
  const d = Math.max(0, Math.min(100, descuento));
  const { error } = await supabase.from("clientes").update({ descuento_pct: d }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

export async function crearCliente(input: {
  nombre: string;
  nit: string;
  descuento_pct: number;
}): Promise<R> {
  const supabase = await createClient();
  if (!input.nombre) return { ok: false, error: "El nombre es obligatorio." };
  const { error } = await supabase.from("clientes").insert({
    nombre: input.nombre,
    nit: input.nit || null,
    descuento_pct: Math.max(0, Math.min(100, input.descuento_pct || 0)),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Catálogo — RLS admin write; lectura ve activos e inactivos.
// ---------------------------------------------------------------------------
export interface ProductoAdmin {
  id: string;
  codigo_interno: string;
  descripcion: string;
  familia: string;
  precio_lista: number;
  stock: number;
  activo: boolean;
}

export async function listarCatalogo(q: string): Promise<ProductoAdmin[]> {
  const supabase = await createClient();
  let query = supabase
    .from("productos")
    .select("id, codigo_interno, descripcion, familia, precio_lista, stock, activo")
    .order("codigo_interno")
    .limit(50);
  const t = (q ?? "").trim();
  if (t) query = query.or(`codigo_interno.ilike.%${t}%,descripcion.ilike.%${t}%`);
  const { data } = await query;
  return (data ?? []) as ProductoAdmin[];
}

export async function guardarProducto(
  id: string,
  input: { precio_lista: number; stock: number; activo: boolean }
): Promise<R> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("productos")
    .update({
      precio_lista: Math.max(0, input.precio_lista),
      stock: Math.max(0, Math.floor(input.stock)),
      activo: input.activo,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

export async function crearProducto(input: {
  codigo_interno: string;
  descripcion: string;
  familia: "sello_mecanico" | "capacitor" | "refrigeracion";
  precio_lista: number;
  stock: number;
}): Promise<R> {
  const supabase = await createClient();
  if (!input.codigo_interno || !input.descripcion)
    return { ok: false, error: "Código y descripción son obligatorios." };
  const { error } = await supabase.from("productos").insert({
    codigo_interno: input.codigo_interno,
    descripcion: input.descripcion,
    familia: input.familia,
    precio_lista: Math.max(0, input.precio_lista),
    stock: Math.max(0, Math.floor(input.stock)),
    codigo_contable: input.codigo_interno, // muestra: el código contable espeja al interno
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  return { ok: true };
}

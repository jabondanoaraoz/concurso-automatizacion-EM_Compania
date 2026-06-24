import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Rol = "vendedor" | "contable" | "administrador";

export interface Perfil {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
}

// Devuelve el usuario autenticado + su perfil (rol), o null si no hay sesión.
export async function getSessionUser(): Promise<{ perfil: Perfil } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("id, nombre, email, rol, activo")
    .eq("id", user.id)
    .single();

  if (!perfil || !perfil.activo) return null;
  return { perfil: perfil as Perfil };
}

// Ruta del panel según el rol.
export function rutaPorRol(rol: Rol): string {
  switch (rol) {
    case "vendedor":
      return "/vendedor";
    case "contable":
      return "/contable";
    case "administrador":
      return "/admin";
  }
}

// Guard para layouts de panel: exige sesión + rol esperado, o redirige.
export async function requireRol(rol: Rol): Promise<Perfil> {
  const sesion = await getSessionUser();
  if (!sesion) redirect("/login");
  if (sesion.perfil.rol !== rol) redirect(rutaPorRol(sesion.perfil.rol));
  return sesion.perfil;
}

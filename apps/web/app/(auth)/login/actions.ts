"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rutaPorRol, type Rol } from "@/lib/auth";

export interface LoginState {
  error?: string;
}

export async function iniciarSesion(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Ingresa correo y contraseña." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "Credenciales inválidas." };

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("rol, activo")
    .eq("id", data.user.id)
    .single();

  if (!perfil || !perfil.activo) {
    await supabase.auth.signOut();
    return { error: "Usuario sin perfil activo. Contacta al administrador." };
  }

  redirect(rutaPorRol(perfil.rol as Rol));
}

import { redirect } from "next/navigation";
import { getSessionUser, rutaPorRol } from "@/lib/auth";
import { LoginForm } from "./login-form";

// Si ya hay sesión activa, no mostrar el formulario: llevar al panel del rol.
export default async function LoginPage() {
  const sesion = await getSessionUser();
  if (sesion) redirect(rutaPorRol(sesion.perfil.rol));
  return <LoginForm />;
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, rutaPorRol } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const sesion = await getSessionUser();
  if (sesion) redirect(rutaPorRol(sesion.perfil.rol));

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-accent" aria-hidden />
        <h1 className="text-3xl font-semibold tracking-tight">EM-Pedidos</h1>
      </div>
      <p className="text-ink-2">
        Plataforma de cotización y pedidos para E.M. Compañía S.A.S, integrada a
        World Office Cloud. Acceso interno por rol: vendedor, contable y administrador.
      </p>
      <div className="flex gap-3">
        <Link href="/login">
          <Button>Ingresar</Button>
        </Link>
      </div>
      <p className="text-xs text-ink-3">
        Concurso Aztec · modo demostración (World Office en mock).
      </p>
    </main>
  );
}

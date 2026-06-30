import Link from "next/link";
import { cerrarSesion } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { Perfil } from "@/lib/auth";

const ETIQUETA_ROL: Record<Perfil["rol"], string> = {
  vendedor: "Vendedor",
  contable: "Contable",
  administrador: "Administrador",
};

// Marco común de los 3 paneles: encabezado con marca E.M., usuario y logout.
export function PanelShell({
  perfil,
  children,
}: {
  perfil: Perfil;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-md bg-accent" aria-hidden />
            <span className="font-title text-lg font-semibold">EM-Pedidos</span>
            <span className="rounded-full bg-bg-2 px-2 py-0.5 text-xs text-ink-2">
              {ETIQUETA_ROL[perfil.rol]}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/ayuda" className="text-sm text-ink-2 hover:text-accent">
              Ayuda
            </Link>
            <span className="text-sm text-ink-2">{perfil.nombre}</span>
            <form action={cerrarSesion}>
              <Button variant="outline" size="sm" type="submit">
                Salir
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

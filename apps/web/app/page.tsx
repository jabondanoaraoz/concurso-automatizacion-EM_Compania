import { Button } from "@/components/ui/button";

// Landing temporal (verifica tokens + fuentes). Será reemplazada por el
// login y el ruteo por rol en la tarea 1.4.
export default function Home() {
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
        <Button>Ingresar</Button>
        <Button variant="outline">Conocer más</Button>
      </div>
      <p className="text-xs text-ink-3">
        Concurso Aztec · modo demostración (World Office en mock).
      </p>
    </main>
  );
}

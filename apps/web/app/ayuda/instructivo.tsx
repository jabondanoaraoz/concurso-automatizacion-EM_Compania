"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import type { Rol } from "@/lib/auth";

export interface DocInstructivo {
  key: string;
  titulo: string;
  contenido: string;
}

const ETIQUETA: Record<Rol, string> = {
  vendedor: "Vendedor",
  contable: "Contable",
  administrador: "Administrador",
};

// Instructivo en la app: pestañas por documento + descarga a PDF (impresión del
// navegador sobre una vista limpia) + atajo a la sección del rol del usuario.
export function Instructivo({
  docs,
  rol,
  rutaPanel,
}: {
  docs: DocInstructivo[];
  rol: Rol;
  rutaPanel: string;
}) {
  const [activo, setActivo] = useState(docs[0]?.key ?? "");
  const cuerpoRef = useRef<HTMLDivElement>(null);
  const doc = docs.find((d) => d.key === activo) ?? docs[0];

  // Lleva el foco a la sección "Si eres <rol>" del manual de onboarding.
  function irAMiSeccion() {
    const cont = cuerpoRef.current;
    if (!cont) return;
    const etiqueta = ETIQUETA[rol].toLowerCase();
    const titulo = Array.from(cont.querySelectorAll("h2, h3")).find((el) =>
      el.textContent?.toLowerCase().includes(etiqueta)
    );
    titulo?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {docs.map((d) => (
            <button
              key={d.key}
              onClick={() => setActivo(d.key)}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                d.key === activo
                  ? "bg-accent text-white"
                  : "border border-border bg-white text-ink-2 hover:border-accent/40"
              }`}
            >
              {d.titulo}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          Descargar PDF
        </Button>
      </div>

      {activo === "onboarding" && (
        <div className="no-print mb-4 rounded-md border border-accent/40 bg-white px-4 py-2 text-sm text-ink-2">
          Estás viendo como <strong>{ETIQUETA[rol]}</strong>.{" "}
          <button onClick={irAMiSeccion} className="text-accent underline">
            Ir a mi sección
          </button>
        </div>
      )}

      <article
        ref={cuerpoRef}
        className="instructivo rounded-xl border border-border bg-white p-6"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc?.contenido ?? ""}</ReactMarkdown>
      </article>

      <div className="no-print mt-4">
        <Link href={rutaPanel} className="text-sm text-accent underline">
          ← Volver a mi panel
        </Link>
      </div>
    </div>
  );
}

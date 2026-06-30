import { redirect } from "next/navigation";
import { getSessionUser, rutaPorRol } from "@/lib/auth";
import { PanelShell } from "@/components/panel-shell";
import { INSTRUCTIVO } from "@/content/instructivo.generated";
import { Instructivo, type DocInstructivo } from "./instructivo";

export const dynamic = "force-dynamic";

// Sección de ayuda dentro de la app. El manual de onboarding lo ven los tres
// roles; la documentación técnica de World Office, solo el administrador.
export default async function AyudaPage() {
  const sesion = await getSessionUser();
  if (!sesion) redirect("/login");
  const { perfil } = sesion;

  const docs: DocInstructivo[] = [
    { key: "onboarding", titulo: "Manual de uso", contenido: INSTRUCTIVO.onboarding },
  ];
  if (perfil.rol === "administrador") {
    docs.push({
      key: "worldoffice",
      titulo: "Integración World Office (técnico)",
      contenido: INSTRUCTIVO.worldoffice,
    });
  }

  return (
    <PanelShell perfil={perfil}>
      <div className="mb-6">
        <h1 className="font-title text-2xl font-semibold">Ayuda / Instructivo</h1>
        <p className="text-sm text-ink-2">
          Guía de uso de la plataforma. Puedes descargar cada documento en PDF.
        </p>
      </div>
      <Instructivo docs={docs} rol={perfil.rol} rutaPanel={rutaPorRol(perfil.rol)} />
    </PanelShell>
  );
}

import { requireRol } from "@/lib/auth";
import { PanelShell } from "@/components/panel-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await requireRol("administrador");
  return <PanelShell perfil={perfil}>{children}</PanelShell>;
}

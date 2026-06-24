import { requireRol } from "@/lib/auth";
import { PanelShell } from "@/components/panel-shell";

export default async function ContableLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await requireRol("contable");
  return <PanelShell perfil={perfil}>{children}</PanelShell>;
}

import { requireRol } from "@/lib/auth";
import { PanelShell } from "@/components/panel-shell";

export default async function VendedorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await requireRol("vendedor");
  return <PanelShell perfil={perfil}>{children}</PanelShell>;
}

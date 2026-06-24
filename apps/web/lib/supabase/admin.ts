import { createClient } from "@supabase/supabase-js";

// Cliente con service_role: SOLO servidor. Bypassa RLS. Úsalo únicamente para
// operaciones administrativas (crear usuarios, tareas de backoffice). NUNCA en
// componentes de cliente ni expongas la key al navegador.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

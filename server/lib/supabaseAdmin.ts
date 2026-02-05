import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export type PublicLeadRow = {
  id?: string;
  created_at?: string;
  company_name: string;
  website_url: string;
  contact_email: string;
  status: string;
  screenshot_url?: string | null;
  prestige_score?: number | null;
  meta?: Record<string, unknown> | null;
};

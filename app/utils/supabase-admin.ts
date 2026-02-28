/**
 * Server-side Supabase admin client.
 * Uses placeholder values during build when env vars are missing (e.g. CI).
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-role-key-for-build";

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

import { createClient as createSupabaseClient } from "@supabase/supabase-js"

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL! // e.g. https://xyz.supabase.co
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // SERVER-ONLY key (never expose to browser)
  if (!url || !serviceKey) {
    throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  })
}

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

/**
 * A client that acts AS THE CALLING USER — every query goes through Row
 * Level Security exactly as if the browser had made it directly. Use this
 * for all machine/conversation/diagnosis/repair/case_precedent reads and
 * writes so a bug here can never leak one user's data to another.
 */
export function createUserClient(authHeader: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
}

/**
 * Service-role client — bypasses RLS entirely. Only use for the shared,
 * non-per-user tables (`common_issues_cache`) where the whole point is that
 * no single user owns the row. Never use this client for a user-owned table.
 */
export function createServiceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

export async function getAuthedUser(userClient: SupabaseClient) {
  const { data, error } = await userClient.auth.getUser()
  if (error || !data.user) return null
  return data.user
}

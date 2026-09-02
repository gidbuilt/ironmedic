import { supabase } from './supabase'

export function hashContainsRecovery(hash: string): boolean {
  return hash.includes('type=recovery')
}

export function isRecoveryAuthType(type: string | null, hash: string): boolean {
  return type === 'recovery' || hashContainsRecovery(hash)
}

/** Parse implicit-flow tokens from the URL hash and store the session. */
export async function establishSessionFromHash(hash: string): Promise<boolean> {
  if (!hash.includes('access_token')) return false
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  if (!access_token || !refresh_token) return false
  const { error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) throw error
  return true
}

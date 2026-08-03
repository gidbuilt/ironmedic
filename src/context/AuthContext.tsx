import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  /** True when the current session is a silent guest (no email). */
  isAnonymous: boolean
  isSubscribed: boolean
  /** Set when anonymous bootstrap failed (e.g. provider disabled in Supabase). */
  authError: string | null
  refreshProfile: () => Promise<void>
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  /** Convert a guest session into a permanent email account (keeps data). */
  upgradeGuestAccount: (email: string, password: string) => Promise<{ error: string | null }>
  signInAnonymously: () => Promise<{ error: string | null }>
  resetPasswordForEmail: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null)
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, is_subscribed, stripe_customer_id, created_at')
      .eq('id', userId)
      .maybeSingle()
    setProfile((data as Profile | null) ?? null)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function ensureSession() {
      setAuthError(null)
      const { data } = await supabase.auth.getSession()
      if (cancelled) return

      if (data.session) {
        setSession(data.session)
        await loadProfile(data.session.user.id)
        if (!cancelled) setLoading(false)
        return
      }

      const { data: anon, error } = await supabase.auth.signInAnonymously()
      if (cancelled) return

      if (error || !anon.session) {
        console.error('[auth] anonymous sign-in failed', error)
        setSession(null)
        setProfile(null)
        setAuthError(
          error?.message ??
            'Guest access is not enabled. In Supabase: Authentication → Providers → Anonymous → Enable.',
        )
        setLoading(false)
        return
      }

      setSession(anon.session)
      await loadProfile(anon.session.user.id)
      if (!cancelled) setLoading(false)
    }

    void ensureSession()

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      void loadProfile(nextSession?.user?.id)
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [loadProfile])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isAnonymous: Boolean(session?.user?.is_anonymous),
      isSubscribed: Boolean(profile?.is_subscribed),
      authError,
      async refreshProfile() {
        await loadProfile(session?.user?.id)
      },
      async signInWithPassword(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error?.message ?? null }
      },
      async signUp(email, password) {
        const { error } = await supabase.auth.signUp({ email, password })
        return { error: error?.message ?? null }
      },
      async upgradeGuestAccount(email, password) {
        const { error } = await supabase.auth.updateUser({ email, password })
        if (error) return { error: error.message }
        // Refresh session so is_anonymous clears after conversion.
        const { data } = await supabase.auth.getSession()
        setSession(data.session)
        await loadProfile(data.session?.user?.id)
        return { error: null }
      },
      async signInAnonymously() {
        const { data, error } = await supabase.auth.signInAnonymously()
        if (error || !data.session) {
          const message = error?.message ?? 'Could not start a guest session.'
          setAuthError(message)
          return { error: message }
        }
        setSession(data.session)
        await loadProfile(data.session.user.id)
        setAuthError(null)
        return { error: null }
      },
      async resetPasswordForEmail(email) {
        const redirectTo = `${window.location.origin}/reset-password`
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
        return { error: error?.message ?? null }
      },
      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password })
        return { error: error?.message ?? null }
      },
      async signOut() {
        await supabase.auth.signOut()
        const { data: anon, error } = await supabase.auth.signInAnonymously()
        if (error || !anon.session) {
          setAuthError(error?.message ?? 'Could not start a guest session.')
          setSession(null)
          setProfile(null)
          return
        }
        setSession(anon.session)
        await loadProfile(anon.session.user.id)
        setAuthError(null)
      },
    }),
    [session, profile, loading, authError, loadProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

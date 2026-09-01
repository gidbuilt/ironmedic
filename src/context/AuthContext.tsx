import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { withAuthTimeout } from '../lib/authTimeout'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { isTransientNetworkError } from '../lib/networkError'
import { initNativeAppLifecycle } from '../lib/nativeAppLifecycle'
import type { Profile } from '../types/database'
import { isPaidTier, normalizeSubscriptionTier, type SubscriptionTier } from '../lib/subscription'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  /** True when the current session is a silent guest (no email). */
  isAnonymous: boolean
  isSubscribed: boolean
  subscriptionTier: SubscriptionTier
  isPremium: boolean
  /** Set when anonymous bootstrap failed (e.g. provider disabled in Supabase). */
  authError: string | null
  refreshProfile: () => Promise<void>
  /** Soft recover after screen lock / background — does not wipe session on network blips. */
  recoverSession: () => Promise<void>
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>
  /** Convert a guest session into a permanent email account (keeps data). */
  upgradeGuestAccount: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>
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
      .select('id, is_subscribed, subscription_tier, stripe_customer_id, created_at')
      .eq('id', userId)
      .maybeSingle()
    setProfile((data as Profile | null) ?? null)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function ensureSession() {
      setAuthError(null)

      if (!isSupabaseConfigured) {
        setSession(null)
        setProfile(null)
        setAuthError('App is missing Supabase configuration. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
        setLoading(false)
        return
      }

      try {
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
      } catch (err) {
        console.error('[auth] bootstrap failed', err)
        if (!cancelled) {
          setSession(null)
          setProfile(null)
          const raw = err instanceof Error ? err.message : 'Could not start a session.'
          setAuthError(
            isTransientNetworkError(err)
              ? 'Connection issue. Check your network and try again.'
              : raw,
          )
          setLoading(false)
        }
      }
    }

    void ensureSession()

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Ignore null flashes from flaky network while a session is already live.
      if (!nextSession) return
      setSession(nextSession)
      void loadProfile(nextSession.user.id)
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [loadProfile])

  const recoverSession = useCallback(async () => {
    if (!isSupabaseConfigured) return
    try {
      const { data: refreshed } = await supabase.auth.refreshSession()
      if (refreshed.session) {
        setSession(refreshed.session)
        await loadProfile(refreshed.session.user.id)
        setAuthError(null)
        return
      }
      const { data: existing } = await supabase.auth.getSession()
      if (existing.session) {
        setSession(existing.session)
        await loadProfile(existing.session.user.id)
        setAuthError(null)
        return
      }
      const { data: anon, error } = await supabase.auth.signInAnonymously()
      if (anon.session) {
        setSession(anon.session)
        await loadProfile(anon.session.user.id)
        setAuthError(null)
        return
      }
      if (error && !isTransientNetworkError(error)) {
        setAuthError(error.message)
      }
    } catch (err) {
      // Keep whatever session we have; transient offline while locked is fine.
      if (!isTransientNetworkError(err)) {
        console.error('[auth] recoverSession failed', err)
      }
    }
  }, [loadProfile])

  useEffect(() => {
    void initNativeAppLifecycle(() => recoverSession())
  }, [recoverSession])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isAnonymous: Boolean(session?.user?.is_anonymous),
      isSubscribed: isPaidTier(normalizeSubscriptionTier(profile?.subscription_tier)),
      subscriptionTier: normalizeSubscriptionTier(profile?.subscription_tier),
      isPremium: normalizeSubscriptionTier(profile?.subscription_tier) === 'premium',
      authError,
      async refreshProfile() {
        await loadProfile(session?.user?.id)
      },
      recoverSession,
      async signInWithPassword(email, password) {
        try {
          const { error } = await withAuthTimeout(
            supabase.auth.signInWithPassword({ email: email.trim(), password }),
          )
          return { error: error?.message ?? null }
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Could not sign in.' }
        }
      },
      async signUp(email, password) {
        try {
          const { data, error } = await withAuthTimeout(
            supabase.auth.signUp({
              email: email.trim(),
              password,
              options: { emailRedirectTo: `${window.location.origin}/login` },
            }),
          )
          if (error) return { error: error.message, needsEmailConfirmation: false }
          if (data.session) {
            setSession(data.session)
            try {
              await loadProfile(data.session.user.id)
            } catch (profileErr) {
              console.warn('[auth] profile refresh after signUp failed', profileErr)
            }
          }
          return { error: null, needsEmailConfirmation: !data.session }
        } catch (err) {
          return {
            error: err instanceof Error ? err.message : 'Could not create account.',
            needsEmailConfirmation: false,
          }
        }
      },
      async upgradeGuestAccount(email, password) {
        try {
          const { error } = await withAuthTimeout(
            supabase.auth.updateUser({ email: email.trim(), password }),
          )
          if (error) return { error: error.message, needsEmailConfirmation: false }
          const { data: sessionData } = await withAuthTimeout(supabase.auth.getSession())
          if (sessionData.session) {
            setSession(sessionData.session)
            try {
              await loadProfile(sessionData.session.user.id)
            } catch (profileErr) {
              console.warn('[auth] profile refresh after upgrade failed', profileErr)
            }
          }
          const needsEmailConfirmation = Boolean(
            sessionData.session?.user.email && !sessionData.session.user.email_confirmed_at,
          )
          return { error: null, needsEmailConfirmation }
        } catch (err) {
          return {
            error: err instanceof Error ? err.message : 'Could not save account.',
            needsEmailConfirmation: false,
          }
        }
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
    [session, profile, loading, authError, loadProfile, recoverSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

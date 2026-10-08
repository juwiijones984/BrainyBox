import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react'
import type { User } from 'firebase/auth'
import { FIREBASE_CONFIGURED, MISSING_FIREBASE_ENV } from '@/lib/firebase/config'
import { fetchAdminClaim, fetchProfile, signOut as fbSignOut, watchAuth } from '@/lib/firebase/auth'
import type { Profile } from '@/data/types'

// ── Auth state ─────────────────────────────────────────────────────────────
//
// The previous login screen never looked at the credentials it was given. It
// set a role from whichever button was pressed and navigated on, so "secure
// role-based access" was really a client-side label over an app anyone could
// reach by picking a different button.
//
// The role is now read from the signed-in user's Firestore profile and enforced
// by `firestore.rules`. Two consequences the UI has to handle:
//   - Authentication is asynchronous, so there is a genuine loading state
//     between "no user yet" and "we know who this is".
//   - A signed-in user with no profile document has no role, and must be sent
//     to registration rather than guessed at.

export type AuthStatus = 'unconfigured' | 'loading' | 'signed-out' | 'signed-in'

export interface AuthState {
  status: AuthStatus
  user: User | null
  profile: Profile | null
  /**
   * Whether the signed-in account holds the operator `admin` claim.
   *
   * This is a capability read from the ID token, deliberately separate from
   * `profile.role`. `firestore.rules` gates operator writes on the same claim, so
   * the UI and the rules agree on one source rather than two that can drift.
   *
   * It is false while `status` is anything other than 'signed-in', so a revoked
   * claim takes effect on the next load instead of lingering.
   */
  isAdmin: boolean
  /** Variables the operator still has to set, when `status` is 'unconfigured'. */
  missingEnv: readonly string[]
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

/** Mirrors the `status` ternary: is there a live session at all? */
const statusSignedIn = (user: User | null, resolved: boolean): boolean =>
  FIREBASE_CONFIGURED && resolved && user !== null

export function AuthStoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  // `false` until the first auth callback has fired. Without this the app would
  // briefly render the signed-out state on every refresh and flash the login
  // screen at an already-signed-in learner.
  const [resolved, setResolved] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!FIREBASE_CONFIGURED) {
      setResolved(true)
      return
    }

    let cancelled = false
    let unsubscribe = () => {}

    unsubscribe = watchAuth(
      nextUser => {
        if (cancelled) return
        setUser(nextUser)
        // A sign-out must not leave the previous profile in memory, or the next
        // learner to sign in on a shared device would briefly see it.
        setProfile(null)
        // Same reasoning for the claim: the next account must never inherit the
        // previous one's operator powers.
        setIsAdmin(false)
        setResolved(true)
      },
      error => {
        if (cancelled) return
        setAuthError(error.message)
        setResolved(true)
      },
    )

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  // The profile is a second read, and it is what carries the role. A missing
  // document is meaningful: the account exists but has not chosen a role yet.
  useEffect(() => {
    if (!user) return
    let cancelled = false

    fetchProfile(user.uid)
      .then(next => { if (!cancelled) setProfile(next) })
      .catch(error => { if (!cancelled) setAuthError(error.message) })

    return () => { cancelled = true }
  }, [user])

  // The operator claim, read from the token rather than from Firestore. Kept in
  // its own effect so a failed claim read cannot block the profile from loading:
  // an unprivileged account must still reach its own portal.
  useEffect(() => {
    if (!user) return
    let cancelled = false

    fetchAdminClaim(user)
      .then(next => { if (!cancelled) setIsAdmin(next) })
      .catch(() => { if (!cancelled) setIsAdmin(false) })

    return () => { cancelled = true }
  }, [user])

  const signOut = useCallback(async () => {
    await fbSignOut()
    setProfile(null)
    setIsAdmin(false)
  }, [])

  const value = useMemo<AuthState>(() => ({
    status: !FIREBASE_CONFIGURED
      ? 'unconfigured'
      : !resolved
        ? 'loading'
        : user
          ? 'signed-in'
          : 'signed-out',
    user,
    profile,
    // Never true unless the session is genuinely signed in, so a stale claim
    // cannot outlive the account that carried it.
    isAdmin: statusSignedIn(user, resolved) && isAdmin,
    missingEnv: MISSING_FIREBASE_ENV,
    signOut,
  }), [user, profile, resolved, authError, isAdmin, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const store = useContext(AuthContext)
  if (!store) throw new Error('useAuth must be used inside <AuthStoreProvider>.')
  return store
}

/** The signed-in profile, or null. Throws if used outside the provider. */
export const useProfile = (): Profile | null => useAuth().profile

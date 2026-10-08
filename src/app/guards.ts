import { createElement, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { UserRole } from '@/data/types'
import { useAuth } from '@/store/AuthStore'

// ── Route guards ────────────────────────────────────────────────────────────
//
// These are a user-experience layer, not a security boundary. Their job is to
// stop a signed-in learner from landing on a teacher page and seeing an empty
// roster because their uid owns no classes. The actual boundary is
// `firestore.rules`: even with these guards removed, the teacher portal's reads
// would be rejected server-side, and a client that skipped the guard entirely
// would get permission-denied rather than data.
//
// What the guards do buy: an honest explanation instead of a permission error
// mid-page, and no flashing of the wrong portal during a session change.

/** Where a role belongs. The single mapping both guards and sign-in use. */
export const ROLE_HOME: Record<UserRole, string> = {
  learner: '/learner',
  parent: '/parent',
  teacher: '/teacher',
}

export default function RequireRole({ role, children }: { role: UserRole; children?: ReactNode }) {
  const { status, profile } = useAuth()
  const location = useLocation()

  if (status === 'loading') return createElement(FullPageWait)
  // Not configured is not a loading state, it is a permanent one until someone
  // adds the Firebase keys — and the instructions for that live on the login
  // page. Holding here would leave a deep link spinning on "Checking your
  // session…" forever, with no indication of what is actually wrong.
  if (status === 'unconfigured') return createElement(Navigate, { to: '/', replace: true })
  // No user: send to the entry page, remembering where they were headed so
  // signing in returns them there instead of dropping them on a dashboard.
  if (status === 'signed-out') {
    return createElement(Navigate, { to: '/', replace: true, state: { from: location.pathname } })
  }
  // Signed in but with no profile document: there is no role to check against,
  // and inventing one would be exactly the bug these guards replace.
  if (!profile) return createElement(Navigate, { to: '/', replace: true })

  if (profile.role !== role) {
    return createElement(Navigate, { to: ROLE_HOME[profile.role] ?? '/learner', replace: true })
  }

  return createElement('div', { style: { display: 'contents' } }, children)
}

/**
 * Gate the operator portal on the `admin` claim.
 *
 * Deliberately not `RequireRole`. Admin is a capability on the ID token, not a
 * value of `UserRole`, so an operator is simultaneously a learner, a parent or a
 * teacher. If admin were a role, granting it would overwrite the account's
 * portal and — because the `users` update allowlist does not include `role` —
 * it would need a rule change to grant at all. As a claim it costs nothing and
 * leaves `UserRole` three values wide.
 *
 * This is a UX guard, not a boundary: `firestore.rules` re-checks the same claim
 * on every read and write, so skipping this guard gets permission-denied rather
 * than data. A non-admin who lands on `/admin` is sent to their own portal
 * rather than shown an error, and the redirect target is `ROLE_HOME`, which
 * `Entry` resolves the same way — so the two cannot ping-pong.
 */
export function RequireAdmin({ children }: { children?: ReactNode }) {
  const { status, profile, isAdmin } = useAuth()
  const location = useLocation()

  if (status === 'loading') return createElement(FullPageWait)
  if (status === 'unconfigured') return createElement(Navigate, { to: '/', replace: true })
  if (status === 'signed-out') {
    return createElement(Navigate, { to: '/', replace: true, state: { from: location.pathname } })
  }

  // A signed-in account with no profile still cannot be an operator, and sending
  // it to `/` lets `Entry` route it to registration.
  if (!isAdmin) {
    return createElement(
      Navigate,
      { to: (profile && ROLE_HOME[profile.role]) || '/', replace: true },
    )
  }

  return createElement('div', { style: { display: 'contents' } }, children)
}

/**
 * A full-page hold while Firebase decides who the user is.
 *
 * This is a real state, not decoration: `onAuthStateChanged` is asynchronous,
 * so on every refresh there is a moment where the answer is unknown. Rendering
 * the login screen during it would sign out a learner visually every reload.
 */
export function FullPageWait({ label = 'Checking your session…' }: { label?: string }) {
  return createElement(
    'div',
    { className: 'min-h-dvh bg-canvas flex items-center justify-center px-5' },
    createElement(
      'div',
      { className: 'text-center' },
      createElement('div', {
        className: 'w-8 h-8 rounded-lg bg-blue/15 border border-blue/20 mx-auto mb-4 animate-pulse',
        'aria-hidden': 'true',
      }),
      createElement(
        'p',
        { className: 'text-ink-60 text-xs font-display', role: 'status' },
        label,
      ),
    ),
  )
}

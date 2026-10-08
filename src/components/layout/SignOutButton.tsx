import { useState } from 'react'
import { useAuth } from '@/store/AuthStore'

// ── Sign Out ────────────────────────────────────────────────────────────────
//
// One component for all three portals. The learner portal already had a sign-out
// button, buried two taps deep on the profile page; the parent and teacher
// portals had none at all, which made it impossible to end a session on a
// shared device or a school tablet without clearing cookies by hand.
//
// `signOut` is a network round-trip, so the button latches to a pending state.
// Without it a double-tap fires two `signOut()` calls, and the second one
// rejects against an already-signed-out client — which surfaces as a red error
// toast after the user has already left the page.

const LABELS = {
  block: 'Sign out',
  compact: 'Sign out',
} as const

export function SignOutButton({
  variant = 'block',
  className = '',
}: {
  variant?: 'block' | 'compact'
  className?: string
}) {
  const { signOut } = useAuth()
  const [pending, setPending] = useState(false)

  const onClick = () => {
    if (pending) return
    setPending(true)
    // Success unmounts this button, so only the failure path needs to unlatch.
    void signOut().catch(() => setPending(false))
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-label={LABELS.compact}
        className={`flex items-center gap-1.5 font-display font-semibold text-xs min-h-[40px] px-2 shrink-0 rounded-lg text-ink-70 transition-colors active:bg-tint-press active:text-ink-80 disabled:opacity-50 ${className}`}
      >
        <span className="text-sm leading-none" aria-hidden="true">↪</span>
        {/* The learner header is already carrying a streak chip and an avatar, so
            below `sm` the glyph alone stands in for the label. `aria-label` keeps
            the accessible name intact either way. */}
        <span className="hidden sm:inline">{LABELS.compact}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`w-full rounded-xl bg-tint-strong border border-line-hover text-ink font-display font-semibold py-3.5 text-sm min-h-[48px] active:bg-tint-press transition-colors disabled:opacity-50 ${className}`}
    >
      {pending ? 'Signing out…' : LABELS.block}
    </button>
  )
}

export default SignOutButton
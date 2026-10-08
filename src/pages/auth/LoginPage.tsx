import logo from '@/assets/logo.png'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import type { User } from 'firebase/auth'
import { createProfile, sendReset, signIn, signUp } from '@/lib/firebase/auth'
import { useAuth } from '@/store/AuthStore'
import { ROLE_OPTIONS, SELF_REGISTERABLE_ROLES, isSelfRegisterable } from '@/lib/roles'
import type { UserRole } from '@/data/types'

// ── Why this is a real form ────────────────────────────────────────────────
//
// The previous version asked for a role and an email and password, then
// ignored all three: `handleSignIn` called `navigate(role.route)`. Anyone could
// reach the teacher or parent portal by typing anything in the box, and the
// "Demo mode — press Sign In to continue" line said so outright.
//
// Registration lets a person declare learner, parent, or teacher. The chosen role is
// stored on `users/{uid}.role`, which `firestore.rules` reads to authorise every read
// and write, so who may set it is a security decision rather than a form detail —
// see `SELF_REGISTERABLE_ROLES` in `@/lib/roles` for what that permits and what it
// deliberately does not.
//
// Declaring a role grants no access by itself. The enrolment and guardianship records
// that carry every cross-account read are operator-written, so a new parent or teacher
// lands in their portal and finds it empty until an administrator links them to a
// child or a class. That is why the picker can be honest about the choice without
// weakening anything.
//
// `admin` is not on offer here and must never be: it is a custom claim on the ID
// token, which only the Admin SDK can mint. A `role` value cannot confer it.

const ROLES = ROLE_OPTIONS

type Mode = 'signin' | 'register'
type Notice = { tone: 'ok' | 'error'; text: string } | null

const GRADES = [10, 11, 12]

/**
 * The role a person declares at signup.
 *
 * The options are filtered through `isSelfRegisterable` rather than hard-coded, so
 * this cannot drift from `SELF_REGISTERABLE_ROLES` — the allowlist that
 * `firestore.rules` enforces independently. Adding a role to only one of the two is
 * the failure worth guarding against: the form would offer a choice the rules reject,
 * and the account would be created but the profile write denied.
 *
 * The submitted value is also checked back against the allowlist in the parent
 * components, so tampering with component state produces a validation error instead
 * of a request the rules will reject.
 */
function RolePicker({
  value,
  onChange,
}: {
  value: UserRole
  onChange: (role: UserRole) => void
}) {
  const offered = ROLES.filter(r => isSelfRegisterable(r.id))

  return (
    <div role="radiogroup" aria-label="Account type">
      <p className="text-[#526779] text-[11px] font-display font-bold uppercase tracking-[0.12em] mb-2">
        Account type
      </p>
      <div className="space-y-2.5">
        {offered.map(role => {
          const active = role.id === value
          return (
            <button
              key={role.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(role.id)}
              className="w-full text-left rounded-2xl px-4 py-3.5 border-2 transition-all min-h-[58px] shadow-sm"
              style={{
                background: active ? 'linear-gradient(135deg, rgba(2,145,211,0.12), rgba(2,127,196,0.06))' : '#FFFFFF',
                borderColor: active ? '#027FC4' : '#E2EAF0',
                boxShadow: active ? '0 5px 16px rgba(2,127,196,0.10)' : '0 2px 8px rgba(5,31,46,0.03)',
              }}
            >
              <span className="flex items-center gap-2">
                <span className="text-lg" aria-hidden="true">{role.icon}</span>
                <span
                  className="font-display font-bold text-sm"
                  style={{ color: active ? '#014E8C' : '#526779' }}
                >
                  {role.label}
                </span>
              </span>
              <span className="block text-[#718394] text-xs font-display mt-1.5 leading-relaxed">
                {role.desc}
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-ink-60 text-xs font-display mt-1.5 leading-relaxed">
        A statement of intent, not a key. A parent sees nothing until a school links
        their child to them, and a teacher sees nothing until they are given a class —
        an administrator does both.
      </p>
    </div>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { status, user, signOut } = useAuth()

  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [role, setRole] = useState<UserRole>(SELF_REGISTERABLE_ROLES[0])
  const [grade, setGrade] = useState<number | null>(10)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState<Notice>(null)
  const [busy, setBusy] = useState(false)

  const isRegister = mode === 'register'
  // Only a learner is in a grade. Asking a parent or teacher for one would store a
  // number that means nothing, and `firestore.rules` now requires it to be null for
  // those roles — so the field has to disappear, not just be ignored.
  const needsGrade = isRegister && role === 'learner'

  if (status === 'unconfigured') {
    return <Unconfigured />
  }

  // Signed in, but with no profile document: the credential works and the role
  // does not exist yet. This is normally a registration that failed between
  // creating the auth user and writing `users/{uid}` — a dropped connection, a
  // rules denial — and it used to dead-end, because the only way forward was to
  // sign in to an account already signed in. The rules already allow an account
  // to create its own profile, so the missing step is just the form.
  if (status === 'signed-in' && user) {
    return <CompleteProfile user={user} onSignOut={signOut} />
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    setNotice(null)
    setBusy(true)

    try {
      if (isRegister) {
        if (password.length < 6) {
          setNotice({ tone: 'error', text: 'Use a password of at least 6 characters.' })
          setBusy(false)
          return
        }
        // Re-checked against the allowlist rather than trusted, because this is
        // component state and a browser console can set it to anything. The rules
        // would reject an unlisted role anyway; catching it here means the person
        // sees why instead of a bare permission-denied.
        if (!isSelfRegisterable(role)) {
          setNotice({ tone: 'error', text: 'That account type cannot be selected here.' })
          setBusy(false)
          return
        }
        await signUp({
          email,
          password,
          name,
          role,
          grade: role === 'learner' ? grade : null,
        })
        setNotice({ tone: 'ok', text: 'Account created.' })
      } else {
        await signIn(email, password)
      }
      // The role that decides where to go is read from the profile, so a
      // signed-in learner who once picked "teacher" still lands in /learner.
      navigate('/')
    } catch (err) {
      setNotice({ tone: 'error', text: authErrorMessage(err) })
      setBusy(false)
    }
  }

  const reset = async () => {
    if (!email.trim()) {
      setNotice({ tone: 'error', text: 'Enter your email address first.' })
      return
    }
    try {
      await sendReset(email)
      setNotice({ tone: 'ok', text: 'If that address has an account, a reset link is on its way.' })
    } catch (err) {
      setNotice({ tone: 'error', text: authErrorMessage(err) })
    }
  }

  return (
    <div className="auth-stage min-h-dvh flex items-center justify-center p-3 sm:p-6">
      <main className="grid w-full max-w-6xl overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_28px_90px_rgba(3,43,91,0.18)] lg:min-h-[720px] lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="auth-visual relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-14">
          <div className="absolute -right-24 top-20 h-96 w-96 rounded-full border border-white/10" aria-hidden="true" />
          <div className="absolute -right-10 top-36 h-72 w-72 rounded-full border border-white/10" aria-hidden="true" />
          <div className="relative flex items-center gap-3">
            <img src={logo} alt="" className="h-14 w-14 rounded-xl bg-white p-1 object-contain" />
            <span>
              <span className="block font-display text-xl font-extrabold leading-none">BrainyBox</span>
              <span className="mt-1 block text-[10px] text-white/65">Smart learning made easy</span>
            </span>
          </div>
          <div className="relative max-w-xl py-12">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-sky-200">Welcome to BrainyBox</p>
            <h2 className="font-display text-4xl font-extrabold leading-[1.08] xl:text-5xl">
              Smarter learning.<br />
              <span className="text-[#FFB21A]">Brighter future.</span>
            </h2>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/80">
              Your personal learning companion for CAPS Mathematics. Build confidence with focused lessons, purposeful practice, and progress you can see.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {['Personalised practice', 'Progress tracking', 'Grade 10–12 CAPS'].map(item => (
                <span key={item} className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold text-white/90">{item}</span>
              ))}
            </div>
          </div>
          <div className="relative flex items-center justify-between border-t border-white/20 pt-5 text-xs text-white/65">
            <span>Learn at your pace. Grow with confidence.</span>
            <span className="font-mono-data">01 / 03</span>
          </div>
        </aside>

        <section className="flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-10 lg:px-12 xl:px-16">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src={logo} alt="" className="h-14 w-14 rounded-xl bg-white p-1 object-contain shadow-sm" />
            <div>
              <h1 className="font-display text-xl font-extrabold leading-none tracking-tight text-[#014E8C]">BrainyBox</h1>
              <p className="mt-1 text-xs text-[#647789]">Grade 10–12 · CAPS Mathematics</p>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md">
          <div className="mb-7">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue">{isRegister ? 'Start learning' : 'Your learning space'}</p>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
            <p className="mt-2 text-sm text-ink-70">{isRegister ? 'Set up your account to make your next step count.' : 'Sign in to continue where you left off.'}</p>
          </div>
        <div className="flex gap-1.5 p-1.5 rounded-2xl bg-[#EAF2F8] mb-6 border border-[#DCE8F0]" role="tablist">
          {(['signin', 'register'] as const).map(option => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={mode === option}
              onClick={() => { setMode(option); setNotice(null) }}
              className="flex-1 rounded-xl py-3 text-sm font-display font-bold transition-all min-h-[46px]"
              style={{
                background: mode === option ? 'linear-gradient(135deg, #078FE5, #0755C8)' : 'transparent',
                color: mode === option ? '#FFFFFF' : '#526779',
                boxShadow: mode === option ? '0 6px 14px rgba(1,78,140,0.18)' : 'none',
              }}
            >
              {option === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-5">
          {isRegister && (
            <>
              <div>
                <label htmlFor="name" className="text-[#526779] text-[11px] font-display font-bold uppercase tracking-[0.12em] block mb-2">
                  Your name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoComplete="name"
                  placeholder="Thandi Mokoena"
                  className={INPUT}
                />
              </div>

<RolePicker value={role} onChange={setRole} />

          {needsGrade && (
                <div>
                  <label htmlFor="grade" className="text-[#526779] text-[11px] font-display font-bold uppercase tracking-[0.12em] block mb-2">
                    Grade
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {GRADES.map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGrade(g)}
                        aria-pressed={grade === g}
                        className="rounded-xl py-3.5 font-display font-bold text-sm transition-all min-h-[50px] border-2"
                        style={{
                          background: grade === g ? '#E8F5FC' : '#FFFFFF',
                          borderColor: grade === g ? '#027FC4' : '#E2EAF0',
                          color: grade === g ? '#014E8C' : '#526779',
                          boxShadow: grade === g ? '0 4px 12px rgba(2,127,196,0.10)' : 'none',
                        }}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <label htmlFor="email" className="text-[#526779] text-[11px] font-display font-bold uppercase tracking-[0.12em] block mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="your@email.com"
              className={INPUT}
            />
          </div>

          <div>
            <label htmlFor="password" className="text-[#526779] text-[11px] font-display font-bold uppercase tracking-[0.12em] block mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              className={INPUT}
            />
            {isRegister && (
              <p className="text-ink-60 text-xs font-display mt-1">At least 6 characters.</p>
            )}
          </div>

          {notice && (
            <p
              role="alert"
              className={`rounded-2xl p-4 text-sm leading-relaxed border ${
                notice.tone === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {notice.text}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-[#078FE5] to-[#0755C8] hover:from-[#057AC7] hover:to-[#0648AA] disabled:opacity-40 text-white font-display font-bold py-4 shadow-lg shadow-blue-800/20 transition-all min-h-[52px]"
          >
            {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </button>

          {!isRegister && (
            <button
              type="button"
              onClick={() => void reset()}
              className="w-full text-[#014E8C] hover:text-[#027FC4] text-sm font-display font-semibold transition-colors min-h-[44px]"
            >
              Forgot password?
            </button>
          )}
        </form>

        <p className="text-center text-[#718394] text-xs font-display mt-6">
          CAPS-aligned · Grade 10–12 · South Africa
        </p>
          </div>
        </section>
      </main>
    </div>
  )
}

const INPUT =
  'w-full rounded-xl bg-white border border-[#DCE6EE] px-4 py-3.5 text-[#102F46] placeholder:text-[#9AAAB7] text-sm font-display focus:outline-none focus:border-[#027FC4] focus:ring-4 focus:ring-[#027FC4]/10 transition-all min-h-[50px] shadow-sm'

/**
 * The account exists but has no profile, so it has no role and no portal.
 *
 * Rather than sending the person back to a sign-in form for an account they are
 * already inside, this asks for the fields registration would have stored. It is
 * the same `createProfile` call, and `firestore.rules` permits it: an account
 * may create its own profile, and may not alter anyone else's or promote itself
 * afterwards.
 *
 * The role choices are the same `SELF_REGISTERABLE_ROLES` the register form
 * offers, for the same reason this path allows them: it is reachable by anyone
 * holding a valid credential with no profile, and a declared role still confers
 * no access, because the enrolment and guardianship records that carry access
 * are operator-written. An account created out of band can therefore declare
 * itself a teacher and still see an empty portal, exactly as one that registered
 * normally would.
 */
function CompleteProfile({ user, onSignOut }: { user: User; onSignOut: () => Promise<void> }) {
  const [name, setName] = useState(user.displayName ?? '')
  const [role, setRole] = useState<UserRole>(SELF_REGISTERABLE_ROLES[0])
  const [grade, setGrade] = useState<number | null>(10)
  const [notice, setNotice] = useState<Notice>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setNotice(null)
    try {
      if (!isSelfRegisterable(role)) {
        setNotice({ tone: 'error', text: 'That account type cannot be selected here.' })
        setBusy(false)
        return
      }
      await createProfile(
        user.uid,
        user.email ?? '',
        name,
        role,
        role === 'learner' ? grade : null,
      )
      // `AuthStore` re-reads the profile on its own; the listener fires and the
      // entry route redirects to the right portal. Navigating here too would
      // race that read and land on the same page again.
      setNotice({ tone: 'ok', text: 'Profile saved. Taking you to your portal…' })
    } catch (err) {
      setNotice({ tone: 'error', text: authErrorMessage(err) })
      setBusy(false)
    }
  }

  return (
    <div className="auth-stage min-h-screen flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-lg space-y-5 bg-white rounded-2xl border border-line-hover shadow-[0_24px_70px_rgba(5,31,46,0.10)] p-7 sm:p-10">
        <div>
          <h1 className="font-display font-extrabold text-[#014E8C] text-2xl tracking-tight">Finish setting up</h1>
          <p className="text-[#647789] text-sm font-display mt-2 leading-relaxed">
            You are signed in as <span className="text-[#014E8C]">{user.email}</span>, but this
            account has no profile yet, so there is no role to load a portal from. Choose one to
            continue.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label htmlFor="setup-name" className="text-[#526779] text-[11px] font-display font-bold uppercase tracking-[0.12em] block mb-2">
              Your name
            </label>
            <input
              id="setup-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoComplete="name"
              placeholder="Thandi Mokoena"
              className={INPUT}
            />
          </div>

          <RolePicker value={role} onChange={setRole} />

          {role === 'learner' && (
            <div>
              <label htmlFor="setup-grade" className="text-[#526779] text-[11px] font-display font-bold uppercase tracking-[0.12em] block mb-2">
                Grade
              </label>
              <div className="grid grid-cols-3 gap-2">
                {GRADES.map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGrade(g)}
                    aria-pressed={grade === g}
                    className="rounded-xl py-3.5 font-display font-bold text-sm transition-all min-h-[50px] border-2"
                    style={{
                      background: grade === g ? 'rgba(2,127,196,0.15)' : '#FFFFFF',
                      borderColor: grade === g ? 'rgba(2,127,196,0.5)' : '#E6EAEB',
                      color: grade === g ? '#fff' : 'rgba(5,31,46,0.55)',
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          {notice && (
            <p
              role="alert"
              className={`rounded-2xl p-4 text-sm leading-relaxed border ${
                notice.tone === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {notice.text}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || notice?.tone === 'ok'}
            className="w-full rounded-xl bg-gradient-to-r from-[#027FC4] to-[#014E8C] hover:from-[#016BA8] hover:to-[#003D70] disabled:opacity-40 text-white font-display font-bold py-4 shadow-lg shadow-blue-900/15 transition-all min-h-[52px]"
          >
            {busy ? 'Please wait…' : 'Continue'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => void onSignOut()}
          className="w-full text-center text-[#718394] hover:text-[#014E8C] text-sm font-display transition-colors min-h-[44px]"
        >
          Sign in with a different account
        </button>
      </div>
    </div>
  )
}

/**
 * Turn a Firebase auth error into something a person can act on.
 *
 * The raw messages are English-only and often opaque ("auth/invalid-credential"),
 * so the codes that a user can actually do something about are translated and
 * the rest is logged rather than shown.
 */
function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? ''

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password do not match an account.'
    case 'auth/email-already-in-use':
      return 'An account already exists for that email. Try signing in instead.'
    case 'auth/invalid-email':
      return 'That does not look like a valid email address.'
    case 'auth/weak-password':
      return 'Use a password of at least 6 characters.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.'
    case 'auth/network-request-failed':
      return 'Network problem. Check your connection and try again.'
    case 'auth/requires-recent-login':
      return 'Sign in again to confirm this change.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

/**
 * Shown when Firebase is not configured.
 *
 * The app is Firestore-only by design, so without configuration there is
 * nothing it can honestly show — not a demo learner, not sample progress. This
 * names the exact variables instead of failing with a blank screen.
 */
function Unconfigured() {
  const missing = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_APP_ID',
  ]

  return (
    <div className="auth-stage min-h-screen flex flex-col items-center justify-center px-5">
      <div className="w-full max-w-md space-y-5">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="h-12 w-12 rounded-lg bg-white object-contain" />
          <h1 className="font-display font-extrabold text-[#014E8C] text-2xl tracking-tight">BrainyBox</h1>
        </div>
        <div className="rounded-2xl border border-[#FAD7A5] bg-[#FFF8ED] p-5">
          <p className="text-[#C76A00] font-display font-bold text-sm">Firebase is not configured</p>
          <p className="text-ink-70 text-xs mt-2 leading-relaxed">
            This app stores everything in Firestore, so it needs a Firebase project to run.
            There is no offline mode and no sample data — a progress figure that did not come
            from a real attempt would be a made-up one.
          </p>
          <p className="text-ink-70 text-xs mt-4 font-mono-data">Copy <code className="text-[#014E8C]">.env.example</code> to <code className="text-[#014E8C]">.env</code> and set:</p>
          <ul className="mt-2 space-y-1">
            {missing.map(key => (
              <li key={key} className="text-ink-70 text-xs font-mono-data">• {key}</li>
            ))}
          </ul>
        </div>
        <Link to="/" className="block text-center text-[#014E8C] hover:text-[#027FC4] text-sm font-display font-semibold min-h-[44px] py-3">
          Back
        </Link>
      </div>
    </div>
  )
}

import { NavLink, Outlet, useNavigate } from 'react-router'
import logo from '@/assets/logo.png'
import { SUBJECTS } from '@/data'
import { useAppStore } from '@/store/AppStore'
import { useAuth } from '@/store/AuthStore'
import { SubjectChip } from '@/components/ui'
import { SignOutButton } from '@/components/layout/SignOutButton'

const NAV = [
  { to: '/learner',            label: 'Home',   glyph: '⌂', end: true },
  { to: '/learner/revision',   label: 'Revision', glyph: '↻', end: false },
  { to: '/learner/practice',   label: 'Practise', glyph: '◉', end: false },
  { to: '/learner/tests',      label: 'Tests',  glyph: '⏱', end: false },
  { to: '/learner/library',    label: 'Library', glyph: '▤', end: false },
  { to: '/learner/profile',    label: 'Profile', glyph: '☺', end: false },
]

export default function LearnerShell() {
  const navigate = useNavigate()
  const { activeSubjectId, setActiveSubject } = useAppStore()
  const { profile } = useAuth()

  return (
    <div className="min-h-dvh bg-canvas flex flex-col">
      {/* Top bar — sticky, clears the notch */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-xl safe-t">
        <div className="safe-x border-b border-line bg-white">
          <div className="mx-auto w-full max-w-lg px-4 h-16 flex items-center justify-between sm:max-w-2xl lg:max-w-5xl">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-2.5 pressable min-h-[44px] -ml-1 px-1"
            >
              <img src={logo} alt="" className="w-11 h-11 rounded-xl bg-white object-contain flex-shrink-0" />
              <span className="font-display font-extrabold text-ink tracking-tight">BrainyBox</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 bg-orange/5 border border-orange/10 rounded-full px-2.5 min-h-[32px]">
                <span className="text-xs" aria-hidden="true">🔥</span>
                <span className="font-mono-data text-xs text-ember font-semibold">
                  {profile?.streak ?? 0}
                </span>
              </span>
              <button
                type="button"
                onClick={() => navigate('/learner/profile')}
                className="w-9 h-9 rounded-full bg-gradient-to-br from-sky to-blue flex items-center justify-center pressable"
                aria-label="Open profile"
              >
                <span className="font-display font-bold text-ink text-xs">{profile?.avatar ?? '?'}</span>
              </button>
              {/* Signing out used to require two taps through the profile page.
                  On a shared family tablet that is the difference between ending
                  a session and handing the next learner the previous one's
                  progress. */}
              <SignOutButton variant="compact" />
            </div>
          </div>
        </div>

        {/* Subject switcher — swipeable on touch */}
        <nav className="safe-x border-b border-line bg-white" aria-label="Choose subject">
          <div className="scroll-x gap-2 mx-auto w-full max-w-lg px-4 py-2.5 sm:max-w-2xl lg:max-w-5xl">
            {SUBJECTS.map(subject => (
              <SubjectChip
                key={subject.id}
                subjectId={subject.id}
                selected={subject.id === activeSubjectId}
                onClick={() => setActiveSubject(subject.id)}
              />
            ))}
          </div>
        </nav>
      </header>

      {/* Page content — bottom padding clears the fixed tab bar */}
      <main className="flex-1 mx-auto w-full max-w-lg px-4 pt-7 pb-32 sm:max-w-2xl sm:px-8 lg:max-w-5xl">
        <Outlet />
      </main>

      {/* Bottom tab bar — fixed, clears the home indicator */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-line bg-white/95 backdrop-blur-xl safe-b shadow-[0_-8px_24px_rgba(5,31,46,0.06)]"
        aria-label="Main navigation"
      >
        <div className="mx-auto w-full max-w-lg px-2 sm:max-w-2xl lg:max-w-4xl">
          <div className="grid grid-cols-5">
            {NAV.map(({ to, label, glyph, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className="flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 transition-colors duration-150 touch-manipulation"
                style={({ isActive }) => ({ color: isActive ? '#027FC4' : 'rgba(5,31,46,0.55)' })}
              >
                {({ isActive }) => (
                  <>
                    <span className="text-lg leading-none" aria-hidden="true">{glyph}</span>
                    <span className="text-[10px] font-medium tracking-wide font-display">{label}</span>
                    <span
                      className="h-0.5 rounded-full transition-all duration-200"
                      style={{ width: isActive ? 16 : 0, background: '#027FC4' }}
                    />
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </div>
  )
}

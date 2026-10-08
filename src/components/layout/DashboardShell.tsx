import { NavLink, Outlet, useNavigate } from 'react-router'
import logo from '@/assets/logo.png'
import { SignOutButton } from '@/components/layout/SignOutButton'
import { useAuth } from '@/store/AuthStore'

export interface PortalLink {
  to: string
  label: string
  end?: boolean
}

/**
 * Which portal the shell is chrome for.
 *
 * `parent` and `teacher` are values of `UserRole`. `admin` is *not* — it is the
 * operator claim, and an operator may hold any of the other two roles at the
 * same time. It is a member of this union only because the admin portal reuses
 * this shell for its header and sign-out.
 */
export type PortalRole = 'parent' | 'teacher' | 'admin'

const LINKS: Record<PortalRole, { title: string; links: PortalLink[] }> = {
  admin: {
    title: 'Admin Portal',
    links: [
      { to: '/admin',         label: 'Overview', end: true },
      { to: '/admin/people',  label: 'People' },
      { to: '/admin/classes', label: 'Classes' },
      { to: '/admin/links',   label: 'Links' },
    ],
  },
  teacher: {
    title: 'Teacher Portal',
    links: [
      { to: '/teacher',          label: 'Overview', end: true },
      { to: '/teacher/library',  label: 'Library' },
      { to: '/teacher/upload',   label: 'Upload' },
      { to: '/teacher/builder',  label: 'Builder' },
    ],
  },
  parent: {
    title: 'Parent Portal',
    links: [
      { to: '/parent',           label: 'Overview', end: true },
      { to: '/parent/children',  label: 'Children' },
    ],
  },
}

export default function DashboardShell({ role }: { role: PortalRole }) {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const { title, links } = LINKS[role]
  // An operator is also a learner, parent or teacher, so its own portal's link is
  // offered alongside the operator one rather than hidden behind a redirect.
  const showAdminLink = isAdmin && role !== 'admin'
  const items = showAdminLink ? [...links, { to: '/admin', label: 'Admin' }] : links

  return (
    <div className="min-h-dvh bg-canvas flex flex-col">
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-xl safe-t">
        <div className="safe-x border-b border-line">
          <div className="mx-auto w-full max-w-5xl px-4 h-16 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="flex items-center gap-2.5 pressable min-h-[44px] -ml-1 px-1 min-w-0"
            >
              <img src={logo} alt="" className="w-10 h-10 rounded-lg bg-white object-contain flex-shrink-0" />
              <span className="min-w-0">
                <span className="font-display font-extrabold text-ink tracking-tight">BrainyBox</span>
                <span className="ml-2 text-xs text-ink-60 font-display">{title}</span>
              </span>
            </button>
            {/* This used to be a "Switch" button pointing at `/`, which `Entry`
                resolved straight back to this same portal — so it looked
                functional and did nothing. Both portals previously had no way to
                end a session at all. */}
            <SignOutButton variant="compact" />
          </div>
        </div>

        {/* Portal nav — swipeable on narrow phones */}
        <div className="safe-x border-b border-line">
          <div className="scroll-x mx-auto w-full max-w-5xl px-4 py-2.5">
            {items.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `px-3.5 min-h-[38px] inline-flex items-center rounded-full text-xs font-display font-semibold whitespace-nowrap transition-colors duration-150 touch-manipulation ${
                    isActive ? 'text-navy' : 'text-ink-70'
                  }`
                }
                style={({ isActive }) => ({
                  background: isActive ? 'rgba(2,127,196,0.2)' : 'transparent',
                  // Orange, so the operator link is distinguishable from ordinary
                  // portal navigation at a glance. Not colour alone: it is the
                  // last item and keeps its text label.
                  color: to === '/admin' && !isActive ? 'rgba(240,107,13,0.85)' : undefined,
                })}
              >
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 pt-8 pb-12 sm:px-8">
        <Outlet />
      </main>
    </div>
  )
}

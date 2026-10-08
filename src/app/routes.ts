import { Suspense, createElement, lazy } from 'react'
import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate, useLocation } from 'react-router'
import LoginPage from '@/pages/auth/LoginPage'
import LearnerShell from '@/components/layout/LearnerShell'
import DashboardShell from '@/components/layout/DashboardShell'
import RequireRole, { FullPageWait, RequireAdmin, ROLE_HOME } from './guards'
import { useAuth } from '@/store/AuthStore'

/**
 * Load a page only when its route is opened.
 *
 * Every portal page used to be imported eagerly, so a learner paid for the teacher
 * quiz builder, the operator console and the whole curriculum dataset in the first
 * bundle. Splitting on the portal boundary keeps the initial download to the shell
 * plus the page being opened, and each portal's code arrives only for the people who
 * use it.
 *
 * `FullPageWait` is reused as the fallback so a chunk fetch does not flash a blank
 * screen or a layout that has not yet learned the shell's dimensions.
 */
const lazyPage = (load: () => Promise<{ default: ComponentType }>) => {
  const Page = lazy(load)
  const LazyRoute = () => createElement(Suspense, { fallback: createElement(FullPageWait) },
    createElement(Page))
  return LazyRoute
}

const ParentLayout  = () => createElement(DashboardShell, { role: 'parent'  as const })
const TeacherLayout = () => createElement(DashboardShell, { role: 'teacher' as const })
const AdminLayout   = () => createElement(DashboardShell, { role: 'admin'   as const })

// Each portal's parent route renders the shell wrapped in its role guard. The
// shell's own `<Outlet />` is what renders the children below, so the guard has
// to sit *outside* the shell: a guard placed in a child route would let the
// header and navigation render for a role that is not allowed in.
const learnerRoot = () =>
  createElement(RequireRole, { role: 'learner' as const }, createElement(LearnerShell))

const parentRoot = () =>
  createElement(RequireRole, { role: 'parent' as const }, createElement(ParentLayout))

const teacherRoot = () =>
  createElement(RequireRole, { role: 'teacher' as const }, createElement(TeacherLayout))

// The operator portal is gated on the `admin` claim rather than a role, so it uses
// `RequireAdmin` and gets the same chrome. The guard sits outside the shell for
// the same reason as the others: the shell renders the `<Outlet />`, and mounting
// it for a non-operator would flash the wrong chrome before bouncing.
const adminRoot = () =>
  createElement(RequireAdmin, {}, createElement(AdminLayout))

const DashboardPage        = lazyPage(() => import('@/pages/learner/DashboardPage'))
const PracticePage         = lazyPage(() => import('@/pages/learner/PracticePage'))
const SkillPracticePage    = lazyPage(() => import('@/pages/learner/SkillPracticePage'))
const TestsPage            = lazyPage(() => import('@/pages/learner/TestsPage'))
const TestRunnerPage       = lazyPage(() => import('@/pages/learner/TestRunnerPage'))
const MarksMapPage         = lazyPage(() => import('@/pages/learner/MarksMapPage'))
const ProgrammePage        = lazyPage(() => import('@/pages/learner/ProgrammePage'))
const DiagnosticPage       = lazyPage(() => import('@/pages/learner/DiagnosticPage'))
const LessonPage           = lazyPage(() => import('@/pages/learner/LessonPage'))
const LessonIndexPage      = lazyPage(() => import('@/pages/learner/LessonIndexPage'))
const RevisionPage         = lazyPage(() => import('@/pages/learner/RevisionPage'))
const LibraryPage          = lazyPage(() => import('@/pages/learner/LibraryPage'))
const ProfilePage          = lazyPage(() => import('@/pages/learner/ProfilePage'))
const ParentDashboard      = lazyPage(() => import('@/pages/parent/ParentDashboard'))
const ParentChildrenPage   = lazyPage(() => import('@/pages/parent/ParentChildrenPage'))
const TeacherDashboard     = lazyPage(() => import('@/pages/teacher/TeacherDashboard'))
const TeacherLibraryPage   = lazyPage(() => import('@/pages/teacher/TeacherLibraryPage'))
const UploadPage           = lazyPage(() => import('@/pages/teacher/UploadPage'))
const QuizBuilderPage      = lazyPage(() => import('@/pages/teacher/QuizBuilderPage'))
const AdminOverviewPage    = lazyPage(() => import('@/pages/admin/AdminOverviewPage'))
const AdminPeoplePage      = lazyPage(() => import('@/pages/admin/AdminPeoplePage'))
const AdminClassesPage     = lazyPage(() => import('@/pages/admin/AdminClassesPage'))
const AdminLinksPage       = lazyPage(() => import('@/pages/admin/AdminLinksPage'))

export const router = createBrowserRouter([
  // Entry point. Signed in already, or not configured, and either way this
  // decides the only sensible destination instead of leaving a signed-in user
  // staring at a sign-in form they have already passed.
  { path: '/', Component: Entry },

  // Learner Platform
  {
    path: '/learner',
    Component: learnerRoot,
    children: [
      { index: true,                        Component: DashboardPage },
      { path: 'practice',                   Component: PracticePage },
      { path: 'practice/session/:skillId',  Component: SkillPracticePage },
      { path: 'tests',                      Component: TestsPage },
      { path: 'tests/:quizId',              Component: TestRunnerPage },
      { path: 'marks-map',                  Component: MarksMapPage },
      { path: 'programme',                  Component: ProgrammePage },
      { path: 'diagnostic',                 Component: DiagnosticPage },
      { path: 'lessons',                    Component: LessonIndexPage },
      { path: 'lessons/:module',            Component: LessonPage },
      { path: 'lessons/:module/skill/:skill', Component: LessonPage },
      { path: 'revision',                   Component: RevisionPage },
      { path: 'library',                    Component: LibraryPage },
      { path: 'profile',                    Component: ProfilePage },
    ],
  },

  // Parent Portal
  {
    path: '/parent',
    Component: parentRoot,
    children: [
      { index: true,        Component: ParentDashboard },
      { path: 'children',   Component: ParentChildrenPage },
    ],
  },

  // Teacher Portal
  {
    path: '/teacher',
    Component: teacherRoot,
    children: [
      { index: true,      Component: TeacherDashboard },
      { path: 'library',  Component: TeacherLibraryPage },
      { path: 'upload',   Component: UploadPage },
      { path: 'builder',  Component: QuizBuilderPage },
    ],
  },

  // Operator Portal — gated on the admin claim, not on UserRole
  {
    path: '/admin',
    Component: adminRoot,
    children: [
      { index: true,      Component: AdminOverviewPage },
      { path: 'people',   Component: AdminPeoplePage },
      { path: 'classes',  Component: AdminClassesPage },
      { path: 'links',    Component: AdminLinksPage },
    ],
  },

  // Anything unrecognised goes home rather than rendering a router error page.
  { path: '*', element: createElement(Navigate, { to: '/', replace: true }) },
])

/**
 * The `/` route.
 *
 * Firebase is the only source of truth for who someone is, so this waits for
 * the first auth callback. Three outcomes:
 *
 *   unconfigured  a hold; the login page renders the setup instructions itself
 *   signed-out    the sign-in / register form
 *   signed-in     a redirect to the portal for the profile's role
 *
 * The role comes from the profile document, not from anything the user picked on
 * a previous screen, which is why a teacher button cannot lead to `/learner`.
 */
function Entry() {
  const { status, profile } = useAuth()
  const location = useLocation()

  if (status === 'unconfigured') return createElement(LoginPage)
  if (status === 'loading') return createElement(FullPageWait)
  if (status === 'signed-out' || !profile) return createElement(LoginPage)

  const home = ROLE_HOME[profile.role] ?? '/learner'
  // Returning the user to where they were headed before the session check, so a
  // sign-in from a deep link does not dump them on a generic dashboard.
  const from = (location.state as { from?: string } | null)?.from

  return createElement(Navigate, { to: from ?? home, replace: true })
}

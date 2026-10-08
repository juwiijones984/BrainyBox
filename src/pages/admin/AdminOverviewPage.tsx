import { Link } from 'react-router'
import { Button, Card, EmptyState, SectionLabel, StatTile } from '@/components/ui'
import { useAdminData } from './useAdminData'

/**
 * Operator overview: the shape of the deployment, and anything in it that is
 * broken.
 *
 * Counts are read from the collections rather than reported by the server, so
 * every number here is one the operator could verify by looking at the People or
 * Classes tab.
 */
export default function AdminOverviewPage() {
  const { people, classes, links, issues, nameOf, loading, error, reload } = useAdminData()

  if (error) return <LoadError message={error} />
  if (loading) return <p className="text-ink-70 text-sm font-display py-10 text-center">Loading…</p>

  const learners = people.filter(p => p.role === 'learner')
  const parents = people.filter(p => p.role === 'parent')
  const teachers = people.filter(p => p.role === 'teacher')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-extrabold text-ink text-xl tracking-tight">Overview</h1>
        <p className="text-ink-70 text-xs mt-1">
          Operator access is held by the <code className="text-ink-70">admin</code> claim on the
          ID token, not by a role. Your own portal is unchanged.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <StatTile label="Learners" value={String(learners.length)} accent="#027FC4" />
        <StatTile label="Teachers" value={String(teachers.length)} accent="#34d399" />
        <StatTile label="Parents" value={String(parents.length)} accent="#fbbf24" />
        <StatTile label="Classes" value={String(classes.length)} accent="#a78bfa" />
        <StatTile label="Parent links" value={String(links.length)} accent="#f472b6" />
        <StatTile label="Needs attention" value={String(issues.length)} accent={issues.length ? '#fb7185' : undefined} />
      </div>

      <Card className="p-4 space-y-3">
        <SectionLabel>Needs attention</SectionLabel>
        {issues.length === 0 ? (
          <p className="text-ink-70 text-xs leading-relaxed">
            Every parent link and class points at an account that exists. Nothing to clean up.
          </p>
        ) : (
          <>
            <p className="text-ink-70 text-xs leading-relaxed">
              These reference accounts that cannot exist — a uid nobody ever registered. A link
              like this grants access to nobody, so it is harmless but permanent noise. Removing one
              deletes a document; it does not touch any learner's work.
            </p>
            <ul className="space-y-1.5">
              {issues.map((issue, i) => (
                <li key={`${issue.kind}-${issue.uid}-${i}`} className="flex items-start gap-2 text-xs">
                  <span className="text-rose-400 leading-none mt-0.5" aria-hidden="true">!</span>
                  <span className="text-ink-70 leading-relaxed">{issue.detail}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/admin/links"
              className="inline-block text-xs font-display font-semibold text-navy active:text-navy"
            >
              Review links →
            </Link>
          </>
        )}
      </Card>

      <Card className="p-4 space-y-2.5">
        <SectionLabel>Manage</SectionLabel>
        <ManageRow to="/admin/people" glyph="◉" title="People"
          body="Every registered account, with the role each one holds." />
        <ManageRow to="/admin/classes" glyph="▦" title="Classes"
          body="Create a class, assign its teacher, and enrol or unenrol members." />
        <ManageRow to="/admin/links" glyph="◈" title="Parent links"
          body="Grant a parent access to a child's progress, or revoke it." />
      </Card>

      <Card className="p-4 border-orange/10 space-y-2">
        <SectionLabel>Not here on purpose</SectionLabel>
        <p className="text-ink-70 text-xs leading-relaxed">
          Changing someone's role is not offered in the browser. It is a deliberate two-step on a
          machine that holds the service-account key:
        </p>
        <code className="block text-[11px] font-mono-data text-ember bg-tint rounded-lg px-3 py-2 overflow-x-auto">
          npm run provision -- setrole &lt;uid&gt; parent
        </code>
        <p className="text-ink-60 text-xs leading-relaxed">
          The rules reserve a profile's <code className="text-ink-70">role</code> field for the
          operator path, so no browser — including this one — can promote itself.
        </p>
      </Card>

      <Button variant="ghost" full onClick={reload}>Refresh</Button>
    </div>
  )
}

function ManageRow({ to, glyph, title, body }: { to: string; glyph: string; title: string; body: string }) {
  return (
    <Link to={to} className="flex items-start gap-3 active:opacity-70 transition-opacity">
      <span className="w-8 h-8 rounded-lg bg-blue/8 border border-blue/13 flex items-center justify-center flex-shrink-0">
        <span className="text-sm text-navy" aria-hidden="true">{glyph}</span>
      </span>
      <span className="min-w-0">
        <span className="block font-display font-semibold text-ink text-sm">{title}</span>
        <span className="block text-ink-70 text-xs mt-0.5 leading-relaxed">{body}</span>
      </span>
    </Link>
  )
}

/** Shared by every admin tab, so a rejected read always reads the same way. */
export function LoadError({ message }: { message: string }) {
  return (
    <Card className="p-5 border-rose-500/20 space-y-2">
      <SectionLabel>Could not load</SectionLabel>
      <p className="text-ink-80 text-sm leading-relaxed">{message}</p>
      <p className="text-ink-70 text-xs leading-relaxed">
        If this says permission denied, the operator claim is no longer on your session. Sign out
        and back in to pick up a revoked or newly granted claim.
      </p>
    </Card>
  )
}

export function NoPeople({ icon = '◈' }: { icon?: string }) {
  return (
    <EmptyState
      icon={icon}
      title="Nothing here yet"
      body="Once accounts are registered they will appear in this list."
    />
  )
}

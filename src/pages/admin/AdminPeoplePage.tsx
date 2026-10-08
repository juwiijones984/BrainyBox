import { useMemo, useState } from 'react'
import { Card, Pill, SectionLabel, Segmented } from '@/components/ui'
import { NoPeople, LoadError } from './AdminOverviewPage'
import { useAdminData } from './useAdminData'
import type { UserRole } from '@/data/types'

type Filter = 'all' | UserRole

const ROLE_COLOR: Record<UserRole, string> = {
  learner: '#0291D3',
  parent: '#fbbf24',
  teacher: '#34d399',
}

/**
 * Every registered account, read-only.
 *
 * There is no role editor here on purpose, and the note in the footer says why:
 * `firestore.rules` gives `users/{uid}` update to the account itself with a
 * `hasOnly` allowlist that omits `role`, and to nobody else. So even an
 * operator cannot promote an account from this page — the field is closed to
 * every browser and open only to `provision setrole`. Adding an edit control
 * would have meant widening that rule, which is a larger decision than a
 * dashboard should make for itself.
 */
export default function AdminPeoplePage() {
  const { people, loading, error } = useAdminData()
  const [filter, setFilter] = useState<Filter>('all')

  const shown = useMemo(
    () => (filter === 'all' ? people : people.filter(p => p.role === filter)),
    [people, filter],
  )

  if (error) return <LoadError message={error} />
  if (loading) return <p className="text-ink-70 text-sm font-display py-10 text-center">Loading…</p>

  const count = (role: UserRole) => people.filter(p => p.role === role).length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display font-extrabold text-ink text-xl tracking-tight">People</h1>
        <p className="text-ink-70 text-xs mt-1">{people.length} registered accounts</p>
      </div>

      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: `All ${people.length}` },
          { value: 'learner', label: `Learners ${count('learner')}` },
          { value: 'parent', label: `Parents ${count('parent')}` },
          { value: 'teacher', label: `Teachers ${count('teacher')}` },
        ]}
      />

      {shown.length === 0 ? (
        <NoPeople icon="◉" />
      ) : (
        <ul className="space-y-2">
          {shown.map(person => (
            <li key={person.id}>
              <Card className="p-3.5">
                <div className="flex items-start gap-3">
                  <span
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-display font-bold text-xs text-ink"
                    style={{ background: `${ROLE_COLOR[person.role]}33`, border: `1px solid ${ROLE_COLOR[person.role]}55` }}
                    aria-hidden="true"
                  >
                    {person.avatar || person.name?.slice(0, 2).toUpperCase() || '?'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-semibold text-ink text-sm truncate">
                        {person.name || 'Unnamed'}
                      </span>
                      <Pill color={ROLE_COLOR[person.role]}>{person.role}</Pill>
                    </div>
                    <p className="text-ink-60 text-[11px] mt-1 font-mono-data truncate" title={person.id}>
                      {person.id}
                    </p>
                    <p className="text-ink-70 text-xs mt-1">
                      {person.role === 'learner'
                        ? person.grade
                          ? `Grade ${person.grade} · ${person.subjects?.length ?? 0} subjects`
                          : 'Grade not set'
                        : 'Not a learner'}
                    </p>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card className="p-4 space-y-1.5">
        <SectionLabel>Read-only</SectionLabel>
        <p className="text-ink-70 text-xs leading-relaxed">
          This list cannot change a role. Registration only ever creates a learner, so a parent or
          teacher here got that role from{' '}
          <code className="text-ink-70">npm run provision -- setrole</code> on a machine holding
          the service-account key.
        </p>
      </Card>
    </div>
  )
}

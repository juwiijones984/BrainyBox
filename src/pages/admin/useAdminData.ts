import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listClasses, listParentLinks, listProfiles,
  type ClassDoc, type ParentLinkDoc,
} from '@/lib/firebase/store'
import type { Profile } from '@/data/types'

export interface AdminPerson extends Profile {
  id: string
}

/**
 * Problems worth an operator's attention.
 *
 * These are all cases where the database holds a reference to an account that
 * cannot exist: a link to a uid nobody registered, or a class pointing at a
 * teacher who has no profile. They are surfaced rather than auto-repaired,
 * because deleting a learner's data is not a repair an operator tool should
 * decide to do on its own — the link may simply predate a re-registration.
 */
export interface AdminIssue {
  kind: 'link-parent-missing' | 'link-child-missing' | 'class-teacher-missing'
  /** The offending uid, for the operator to act on. */
  uid: string
  detail: string
}

export interface AdminData {
  people: AdminPerson[]
  classes: ClassDoc[]
  links: ParentLinkDoc[]
  issues: AdminIssue[]
  /** `uid` → name, for resolving references in the UI. */
  nameOf: (uid: string) => string
  roleOf: (uid: string) => Profile['role'] | null
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * Load the three operator collections together.
 *
 * All three reads are authorised by the `admin` claim alone, and all three are
 * whole-collection reads — Firestore authorises those before any document is
 * known, which works here only because `isAdmin()` references no path variable.
 * A learner calling any of these three is rejected outright, not filtered.
 *
 * The load is deliberately fail-loud. If the reads throw — most likely because
 * the claim was revoked and the cached token is stale — the dashboard shows the
 * error rather than rendering empty lists, because "0 people" and "I am not an
 * operator" look identical on an empty admin portal and the operator would have
 * no way to tell which they are looking at.
 */
export function useAdminData(): AdminData {
  const [people, setPeople] = useState<AdminPerson[]>([])
  const [classes, setClasses] = useState<ClassDoc[]>([])
  const [links, setLinks] = useState<ParentLinkDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce(n => n + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([listProfiles(), listClasses(), listParentLinks()])
      .then(([p, c, l]) => {
        if (cancelled) return
        setPeople(p)
        setClasses(c)
        setLinks(l)
        setLoading(false)
      })
      .catch((e: Error) => {
        if (cancelled) return
        setError(e.message)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [nonce])

  const byUid = useMemo(() => new Map(people.map(p => [p.id, p])), [people])

  const issues = useMemo<AdminIssue[]>(() => {
    const found: AdminIssue[] = []
    for (const link of links) {
      if (!byUid.has(link.parentUid)) {
        found.push({
          kind: 'link-parent-missing',
          uid: link.parentUid,
          detail: `Parent link ${link.id} names a parent with no profile`,
        })
      }
      if (!byUid.has(link.childUid)) {
        found.push({
          kind: 'link-child-missing',
          uid: link.childUid,
          detail: `Parent link ${link.id} names a child with no profile`,
        })
      }
    }
    for (const cls of classes) {
      if (!byUid.has(cls.teacherUid)) {
        found.push({
          kind: 'class-teacher-missing',
          uid: cls.teacherUid,
          detail: `Class "${cls.name}" is owned by a teacher with no profile`,
        })
      }
    }
    return found
  }, [links, classes, byUid])

  const nameOf = useCallback(
    (uid: string) => byUid.get(uid)?.name || uid,
    [byUid],
  )

  const roleOf = useCallback(
    (uid: string) => byUid.get(uid)?.role ?? null,
    [byUid],
  )

  return { people, classes, links, issues, nameOf, roleOf, loading, error, reload }
}

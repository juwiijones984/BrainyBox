import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { SKILLS, weakestSkills } from '@/data'
import type { Attempt, Profile, SkillProgress } from '@/data/types'
import { useAuth } from '@/store/AuthStore'
import { withMastery } from '@/lib/roster'
import { buildRevisionPlan } from '@/lib/revision'
import type { RevisionItem } from '@/data/types'
import { fetchProfile } from '@/lib/firebase/auth'
import { readAttempts, readChildLinks, readMastery, readRevision } from '@/lib/firebase/store'

// ── Child view ─────────────────────────────────────────────────────────────
//
// A deeper problem than missing mock data: the parent portal was reading the
// *signed-in* store — the parent's own `skills`, `attempts` and `revision`.
// But a parent is not a learner, so the store had no data of its own to read.
// In practice the parent was being shown whatever the shared device last held,
// which is not their child either.
//
// A parent now reads a specific child, chosen from `parentLinks`. That link is
// the authorisation boundary, enforced in `firestore.rules`: a parent may read
// `learners/{childUid}/mastery` and the child's attempts only where a link
// document names them.

export type ChildStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unauthorised' | 'no-children'

export interface Child {
  uid: string
  profile: Profile
  skills: SkillProgress[]
  attempts: Attempt[]
  revision: RevisionItem[]
  lastActive: string | null
}

export interface ChildView {
  status: ChildStatus
  error: string | null
  children: Child[]
  activeChild: Child | null
  /** True when there is a link but the chosen child has not been assessed. */
  childNeedsDiagnostic: boolean
  setActiveChildUid: (uid: string) => void
}

export function useChildView(): ChildView {
  const { user, profile } = useAuth()
  const [children, setChildren] = useState<Child[]>([])
  const [searchParams, setSearchParams] = useSearchParams()
  const [status, setStatus] = useState<ChildStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  // Which child is being viewed lives in the URL, not in component state. Both
  // parent pages share this hook, and a selection held in `useState` would be
  // forgotten the moment a parent moved between them — landing on the detail
  // page for a different child than the one they were just reading about.
  const activeUid = searchParams.get('child')

  const uid = user?.uid ?? null
  const isParent = profile?.role === 'parent'

  useEffect(() => {
    if (!uid || !isParent) {
      setStatus(isParent ? 'idle' : 'unauthorised')
      return
    }

    let cancelled = false
    setStatus('loading')
    setError(null)

    const load = async () => {
      const childUids = await readChildLinks(uid)
      if (!childUids.length) {
        if (!cancelled) setStatus('no-children')
        return
      }

      const loaded = await Promise.all(childUids.map(async (childUid): Promise<Child | null> => {
        const [childProfile, mastery, attempts, revisionState] = await Promise.all([
          fetchProfile(childUid),
          readMastery(childUid),
          readAttempts(childUid),
          readRevision(childUid),
        ])

        if (!childProfile) return null

        const skills = withMastery(SKILLS, [...mastery.values()])
        const completed = new Set(revisionState.filter(r => r.complete).map(r => r.id))
        const lastActive: string | null = attempts[0]?.date ?? null

        return {
          uid: childUid,
          profile: childProfile,
          skills,
          attempts,
          revision: buildRevisionPlan(skills, { completedIds: completed }),
          lastActive,
        }
      }))

      const rows = loaded.filter((c): c is Child => c !== null)
      if (cancelled) return
      setChildren(rows)
      setStatus('ready')

      // Default to the first child only when the URL names none, or names one
      // that is not actually linked to this parent. A `child` parameter that
      // does not resolve must not silently show someone else's data, and since
      // `activeChild` falls back to `children[0]`, correcting the parameter is
      // what keeps the page and the URL agreeing.
      const named = searchParams.get('child')
      if (!named || !rows.some(c => c.uid === named)) {
        const first = rows[0]?.uid
        setSearchParams(first ? { child: first } : {}, { replace: true })
      }
    }

    load().catch((err: unknown) => {
      if (cancelled) return
      setError(err instanceof Error ? err.message : 'Could not load your children.')
      setStatus('error')
    })

    return () => { cancelled = true }
    // `searchParams` is read inside but is not a dependency: it is the initial
    // value being reconciled, and re-running the load whenever the URL changes
    // would refetch every child on each switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, isParent])

  const activeChild = useMemo(
    () => children.find(c => c.uid === activeUid) ?? children[0] ?? null,
    [children, activeUid],
  )

  const setActiveChildUid = useCallback((next: string) => {
    setSearchParams({ child: next }, { replace: false })
  }, [setSearchParams])

  return {
    status,
    error,
    children,
    activeChild,
    childNeedsDiagnostic: activeChild ? activeChild.skills.every(s => s.current === null) : false,
    setActiveChildUid,
  }
}

/** The weakest assessed skills across a child's subjects, for "needs attention". */
export const childWeakest = (child: Child | null, limit = 1) =>
  child ? weakestSkills(child.skills, limit) : []

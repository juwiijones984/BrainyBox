import { useCallback, useEffect, useMemo, useState } from 'react'
import { SKILLS, subjectTopics } from '@/data'
import type { ClassLearner, SkillProgress, SubjectId } from '@/data/types'
import { useAuth } from '@/store/AuthStore'
import { orderRoster, toRosterEntry, withMastery } from '@/lib/roster'
import {
  readAttemptsFor, readMasteryFor, readMemberships, readTeachingClasses, type ClassDoc,
} from '@/lib/firebase/store'

// ── Class roster ───────────────────────────────────────────────────────────
//
// The teacher dashboard used to call `buildClassLearners(subjectId)`, which
// returned twelve invented learners with plausible scores, trends, session
// counts and weak topics. Every figure on that screen — the class average, the
// "3 learners need support" count, the lowest-scores list — described people
// who do not exist. A teacher acting on it would have chased a fictional
// student.
//
// A roster is now read from real enrolment:
//
//   classes            where the teacher teaches, keyed by teacherUid
//   classes/{id}/members  who is actually enrolled
//   learners/{uid}/mastery what each of them has actually done
//
// and a teacher with no classes sees an honest empty state rather than twelve
// rows of fiction.

export type RosterStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unauthorised'

/** One topic's figures across the whole class, from every learner's evidence. */
export interface TopicStat {
  id: string
  name: string
  /** Mean `current` across the class for this topic, or null if nobody has it. */
  average: number | null
  /** Mean `baseline` across the class, or null. */
  baseline: number | null
  /** How many enrolled learners have a measured score here. */
  assessed: number
  /** How many enrolled learners have no evidence here at all. */
  unassessed: number
  /** Learners whose own weakest topic is this one. */
  struggling: number
}

export interface Roster {
  status: RosterStatus
  error: string | null
  classes: ClassDoc[]
  /** The class currently being viewed, or null when the teacher has none. */
  activeClass: ClassDoc | null
  learners: ClassLearner[]
  /** Mean of `overallScore` across learners who have any, or null. */
  classAverage: number | null
  /** Learners with a measured score, and those without. */
  assessed: number
  unassessed: number
  /** Class-wide topic figures, averaged over the learners who have evidence. */
  topicStats: TopicStat[]
  /** Learners who have not completed an attempt in a week or more. */
  inactive: number
  setActiveClassId: (id: string | null) => void
}

/** A learner counts as inactive after this many days without an attempt. */
const INACTIVE_AFTER_DAYS = 7

export function useRoster(subjectId: SubjectId): Roster {
  const { profile, user } = useAuth()
  const [classes, setClasses] = useState<ClassDoc[]>([])
  const [activeClassId, setActiveClassId] = useState<string | null>(null)
  const [learners, setLearners] = useState<ClassLearner[]>([])
  const [status, setStatus] = useState<RosterStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const uid = user?.uid ?? null
  const isTeacher = profile?.role === 'teacher'

  // The roster rows alone are not enough to answer a topic question: a row holds
  // one score per learner, not per topic. This keeps every learner's skills so
  // the topic figures can be computed from the same read, rather than the page
  // reaching for the signed-in teacher's own (empty) progress.
  const [skillsByLearner, setSkillsByLearner] = useState<Map<string, SkillProgress[]>>(new Map())

  // Load the classes this teacher owns.
  useEffect(() => {
    if (!uid || !isTeacher) {
      setStatus(isTeacher ? 'idle' : 'unauthorised')
      return
    }

    let cancelled = false
    setStatus('loading')
    setError(null)

    readTeachingClasses(uid)
      .then(found => {
        if (cancelled) return
        setClasses(found)
        setActiveClassId(current => current ?? found[0]?.id ?? null)
        setStatus(found.length ? 'ready' : 'ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not load your classes.')
        setStatus('error')
      })

    return () => { cancelled = true }
  }, [uid, isTeacher])

  // Load the roster for the selected class.
  useEffect(() => {
    if (!uid || !activeClassId) {
      setLearners([])
      return
    }

    let cancelled = false
    setStatus('loading')

    const load = async () => {
      const memberships = await readMemberships(activeClassId)
      const uids = memberships.map(m => m.uid)
      // One read per learner. Firestore charges per document, not per query, and
      // a class roster is small enough that batching by hand would complicate the
      // rules for no meaningful saving.
      const [masteryByLearner, attemptsByLearner] = await Promise.all([
        readMasteryFor(uids),
        // Session counts and "last active" come from the attempt history, which
        // is the record of what a learner actually did. A per-skill attempt
        // count is not a session count: one sitting of a 20-question quiz
        // touches many skills, and summing them would report one sitting as
        // twenty.
        readAttemptsFor(uids),
      ])

      const rows = uids.map(childUid => {
        const member = memberships.find(m => m.uid === childUid)
        const skills = withMastery(
          SKILLS.filter(s => s.subjectId === subjectId),
          masteryByLearner.get(childUid),
        )
        const attempts = attemptsByLearner.get(childUid) ?? []
        return toRosterEntry(childUid, subjectId, {
          // A member document is the only place the name is available; the
          // profile read that would supply it is a per-learner cost this view
          // does not need yet.
          profile: { name: member?.displayName ?? 'Learner', avatar: (member?.displayName ?? '?').split(' ').map(p => p[0]).slice(0, 2).join('') },
          skills,
          sessionCount: attempts.length,
          lastActive: attempts[0]?.date ?? null,
        })
      })

      if (!cancelled) {
        setLearners(orderRoster(rows))
        setSkillsByLearner(
          new Map(uids.map(childUid => [
            childUid,
            withMastery(
              SKILLS.filter(s => s.subjectId === subjectId),
              masteryByLearner.get(childUid),
            ),
          ])),
        )
        setStatus('ready')
      }
    }

    load().catch((err: unknown) => {
      if (cancelled) return
      setError(err instanceof Error ? err.message : 'Could not load this class.')
      setStatus('error')
    })

    return () => { cancelled = true }
  }, [uid, activeClassId, subjectId])

  const classAverage = useMemo(() => {
    const scored = learners.filter(l => l.overallScore !== null)
    if (!scored.length) return null
    return Math.round(scored.reduce((sum, l) => sum + l.overallScore!, 0) / scored.length)
  }, [learners])

  /**
   * Class-wide topic figures.
   *
   * A topic's average is over the learners who have evidence for it, not over
   * the whole class: averaging a learner's absence in as a zero would drag the
   * number down with data that was never collected. The `unassessed` count is
   * carried alongside so the number can be read honestly.
   */
  const topicStats = useMemo<TopicStat[]>(() => {
    const all = [...skillsByLearner.values()]

    return subjectTopics(subjectId).map(topic => {
      const measured: { current: number; baseline: number | null }[] = []
      let assessed = 0
      let unassessed = 0

      all.forEach(skills => {
        const inTopic = skills.filter(s => s.topicId === topic.id)
        const current = mean(inTopic.filter(s => s.current !== null).map(s => s.current!))
        if (current === null) {
          // Nobody in this class has a measured score here. Only count a learner
          // as unassessed if the topic has skills they could have been asked on.
          if (inTopic.length) unassessed += 1
          return
        }
        assessed += 1
        measured.push({
          current,
          baseline: mean(inTopic.filter(s => s.baseline !== null).map(s => s.baseline!)),
        })
      })

      return {
        id: topic.id,
        name: topic.name,
        average: measured.length
          ? Math.round(mean(measured.map(m => m.current))!)
          : null,
        // Null when nobody in the class has a baseline here — not zero. The
        // `?? 0` this replaces was reached whenever every measured learner's
        // baseline was missing, and it reported "the class started at 0%" for a
        // topic where no start has been recorded at all.
        baseline: (() => {
          const baselines = measured.map(m => m.baseline).filter((b): b is number => b !== null)
          return baselines.length ? Math.round(mean(baselines)!) : null
        })(),
        assessed,
        unassessed,
        struggling: learners.filter(l => l.weakTopic === topic.name).length,
      }
    })
  }, [skillsByLearner, learners, subjectId])

  /**
   * Learners with no attempt for a week or more.
   *
   * A learner who has never attempted anything is not counted as inactive: they
   * have not gone quiet, they have not started, which is a different thing and
   * is already reported as `unassessed`.
   */
  const inactive = useMemo(() => {
    const cutoff = Date.now() - INACTIVE_AFTER_DAYS * 24 * 60 * 60 * 1000
    return learners.filter(l => l.lastActive !== null && Date.parse(l.lastActive) < cutoff).length
  }, [learners])

  const activeClass = useMemo(
    () => classes.find(c => c.id === activeClassId) ?? null,
    [classes, activeClassId],
  )

  const setActiveClassIdSafe = useCallback((id: string | null) => setActiveClassId(id), [])

  return {
    status,
    error,
    classes,
    activeClass,
    learners,
    classAverage,
    assessed: learners.filter(l => l.overallScore !== null).length,
    unassessed: learners.filter(l => l.overallScore === null).length,
    topicStats,
    inactive,
    setActiveClassId: setActiveClassIdSafe,
  }
}

/** Mean of a non-empty list, or null when there is nothing to average. */
function mean(values: readonly number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

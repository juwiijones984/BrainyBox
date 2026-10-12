import type { AssessmentKind, SubjectId } from '@/data'
import { read, remove, write } from '@/lib/storage'

// ── In-progress sessions ───────────────────────────────────────────────────
//
// A sitting that has been started but not submitted. Only one is kept per
// learner, because "Continue Learning" asks for the most recent activity, not a
// list of them — starting something new replaces the previous resume point.
//
// It lives in localStorage rather than Firestore on purpose. A partially
// answered paper is transient device state, not a result: it is meaningless on
// another device, and an attempt only becomes learner data when it is finished
// and written by `recordAttempt`. Keeping it here mirrors `activeSubjectId` and
// keeps the durable record free of half-finished work.
//
// The session is scoped by uid so two learners sharing a family tablet do not
// inherit each other's papers.

export interface SavedSession {
  /** The quiz that was opened, or `skill-<skillId>` for an ad-hoc drill. */
  quizId: string
  quizTitle: string
  subjectId: SubjectId
  kind: AssessmentKind
  /** The skill being drilled, or `null` for a real quiz. */
  skillId: string | null
  questionIds: string[]
  answers: (number | null)[]
  textAnswers: string[]
  checked: boolean[]
  index: number
  /** Active seconds elapsed before this save, so a resume does not restart the clock. */
  elapsedSec: number
  /** Seconds left on a timed paper, or `null` when untimed. */
  timeLeftSec: number | null
  savedAt: number
}

const keyFor = (uid: string): string => `session:${uid}`

/** The learner's stored session, or `null` when there is nothing to resume. */
export function readSession(uid: string | null): SavedSession | null {
  if (!uid) return null
  const saved = read<SavedSession | null>(keyFor(uid), null)
  // A record that does not name any questions cannot be resumed; treating it as
  // absent is safer than rendering a paper with no body.
  if (!saved || !Array.isArray(saved.questionIds) || !saved.questionIds.length) return null
  return saved
}

export function writeSession(uid: string, session: SavedSession): void {
  write(keyFor(uid), session)
}

export function clearSession(uid: string): void {
  remove(keyFor(uid))
}

/**
 * True when a stored session is for exactly this activity and question set.
 *
 * The questions are compared id-for-id rather than by count: a bank can be
 * re-imported between sittings, and restoring answers against a reordered or
 * resized question list would mark the wrong questions. A mismatch is treated
 * as no session and the paper starts fresh.
 */
export function sessionMatches(
  session: SavedSession | null,
  quizId: string,
  questionIds: readonly string[],
): boolean {
  return Boolean(
    session
      && session.quizId === quizId
      && session.questionIds.length === questionIds.length
      && session.questionIds.every((id, i) => id === questionIds[i]),
  )
}

/** Where "resume" takes the learner for a stored session. */
export function resumePath(session: SavedSession): string {
  return session.skillId
    ? `/learner/practice/session/${session.skillId}`
    : `/learner/tests/${session.quizId}`
}

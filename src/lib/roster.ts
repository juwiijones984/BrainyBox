import { topicAveragesOf } from '@/data'
import type {
  Attempt, ClassLearner, MasteryRecord, Profile, SkillProgress, SubjectId, TrendDir,
} from '@/data/types'

// ── Roster aggregation ─────────────────────────────────────────────────────
//
// `buildClassLearners` used to take a subject id and return twelve invented
// classmates, each with a plausible score, trend, session count and "weak
// topic" picked round-robin from a hand-written pool. A teacher opening the
// class view saw a full, healthy-looking class that did not exist, and there
// was no way to tell the numbers were fiction.
//
// A roster is now assembled from real enrolment and real mastery, and the
// differences are deliberate:
//
//   - A learner with no mastery document is not ranked, because there is
//     nothing to rank them on. They appear with `overallScore: null`.
//   - `weakTopic` is the learner's own lowest measured topic, not a rotated
//     pick from a fixed list.
//   - `sessions` counts their actual completed attempts.
//   - `trend` is derived from their own baseline versus current, and is
//     'stable' when either figure is missing.

/** Mastery records keyed by skill id, with the catalogue joined on. */
export type ProgressBySkill = ReadonlyMap<string, SkillProgress>

/** Join a static skill list to this learner's mastery, for display. */
export function withMastery(
  skills: readonly { id: string; subjectId: SubjectId; topicId: string; topic: string; name: string }[],
  records: readonly MasteryRecord[] | null | undefined,
  /**
   * Questions asked per skill, derived from the attempt history.
   *
   * `MasteryRecord` carries its own `answered` count, but records written before
   * that field existed do not have one — and those same records do have `correct`
   * and `attempts`, so accuracy would read as a divide-by-sittings. Where the
   * record has no count of its own, the history fills it in; where the history is
   * also empty, `correct` is used as a floor so accuracy can never exceed 100%.
   */
  answeredBySkill?: ReadonlyMap<string, number>,
): SkillProgress[] {
  const bySkill = new Map((records ?? []).map(r => [r.skillId, r]))
  return skills.map(skill => {
    const record = bySkill.get(skill.id)
    const answered = record?.answered
      ?? answeredBySkill?.get(skill.id)
      ?? record?.correct
      ?? 0
    return {
      ...skill,
      baseline: record?.baseline ?? null,
      current: record?.current ?? null,
      attempts: record?.attempts ?? 0,
      correct: Math.min(record?.correct ?? 0, answered),
      answered,
      trend: record?.trend ?? 'stable',
      lastPracticedAt: record?.lastPracticedAt ?? null,
    }
  })
}

/**
 * Count questions asked per skill across an attempt history.
 *
 * An attempt records the questions it asked and their outcomes, so the per-skill
 * denominator is reconstructable from history rather than only being counted
 * forwards as attempts are recorded.
 */
export function answeredBySkillFrom(
  attempts: readonly Attempt[],
  skillIdByQuestionId: ReadonlyMap<string, string>,
): Map<string, number> {
  const out = new Map<string, number>()
  for (const attempt of attempts) {
    for (const questionId of attempt.questionIds) {
      const skillId = skillIdByQuestionId.get(questionId)
      if (!skillId) continue
      out.set(skillId, (out.get(skillId) ?? 0) + 1)
    }
  }
  return out
}

/**
 * Rebuild per-skill mastery from an attempt history.
 *
 * Pure: it computes the records and writes nothing, so the arithmetic can be tested
 * without a database. `rebuildMasteryForSkills` persists the result.
 *
 * The one rule that matters is what it does *not* read. It takes no stored mastery as
 * a starting point, because the stored record already contains everything being
 * corrected — it was built from the very attempts being handed in here. Seeding the
 * first attempt of each skill from the stored record (the previous behaviour) added
 * a deleted attempt's contribution back on top of the survivors: `current` is a
 * blend of the whole history, and its `correct` and `answered` counts included the
 * attempt that no longer existed. The score moved less than it should have and the
 * counts never came down.
 *
 * A consequence worth stating: `baseline` is the earliest *surviving* attempt's
 * score. Deleting the first attempt moves the baseline, because a baseline citing an
 * attempt that no longer exists describes nothing.
 */
export function recomputeMastery(
  attempts: readonly Attempt[],
  skillIdByQuestionId: ReadonlyMap<string, string>,
  blend = 0.4,
  trendEpsilon = 4,
): Map<string, MasteryRecord> {
  // Oldest first, with the id as a tie-break so two attempts on one day rebuild in a
  // stable order rather than depending on read order.
  const byDate = [...attempts]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))

  const rebuilt = new Map<string, MasteryRecord>()
  for (const attempt of byDate) {
    const totals = new Map<string, { correct: number; total: number }>()
    attempt.questionIds.forEach((questionId, i) => {
      const skillId = skillIdByQuestionId.get(questionId)
      if (!skillId) return
      const entry = totals.get(skillId) ?? { correct: 0, total: 0 }
      entry.total += 1
      if (attempt.results[i]) entry.correct += 1
      totals.set(skillId, entry)
    })

    for (const [skillId, { correct, total }] of totals) {
      if (!total) continue
      const score = Math.round((correct / total) * 100)
      const prior = rebuilt.get(skillId)
      const baseline = prior?.baseline ?? score
      const current = prior?.current == null
        ? score
        : Math.round(prior.current + (score - prior.current) * blend)
      rebuilt.set(skillId, {
        skillId,
        baseline,
        current,
        attempts: (prior?.attempts ?? 0) + 1,
        correct: (prior?.correct ?? 0) + correct,
        answered: (prior?.answered ?? 0) + total,
        trend: (current - baseline) > trendEpsilon
          ? 'improving'
          : (current - baseline) < -trendEpsilon ? 'declining' : 'stable',
        lastPracticedAt: attempt.date,
        updatedAt: attempt.date,
      })
    }
  }
  return rebuilt
}

export interface RosterEntryInput {
  profile: Pick<Profile, 'name' | 'avatar'>
  skills: SkillProgress[]
  /** Real completed attempts, used for the session count. */
  sessionCount: number
  lastActive: string | null
}

const trendOf = (skills: SkillProgress[]): TrendDir => {
  // A trend is a statement about change, and change needs two measurements.
  // With one or neither, the honest answer is that nothing is known yet.
  const moves = skills
    .filter(s => s.baseline !== null && s.current !== null)
    .map(s => s.current! - s.baseline!)
  if (!moves.length) return 'stable'
  const mean = moves.reduce((sum, d) => sum + d, 0) / moves.length
  return mean > 4 ? 'improving' : mean < -4 ? 'declining' : 'stable'
}

const weakestTopicOf = (skills: SkillProgress[]): string | null => {
  const inSubject = skills.filter(s => s.current !== null)
  if (!inSubject.length) return null
  const topics = topicAveragesOf(inSubject, inSubject[0].subjectId)
  return topics.length ? topics[0].name : null
}

/** Assemble one row of a class or parent view from a learner's real data. */
export function toRosterEntry(
  uid: string,
  subjectId: SubjectId,
  { profile, skills, sessionCount, lastActive }: RosterEntryInput,
): ClassLearner {
  const inSubject = skills.filter(s => s.subjectId === subjectId)
  const assessed = inSubject.filter(s => s.current !== null)

  return {
    uid,
    name: profile.name,
    avatar: profile.avatar,
    subjectId,
    overallScore: assessed.length
      ? Math.round(assessed.reduce((sum, s) => sum + s.current!, 0) / assessed.length)
      : null,
    trend: trendOf(inSubject),
    lastActive,
    weakTopic: weakestTopicOf(inSubject),
    sessions: sessionCount,
  }
}

/**
 * Order a roster for display: learners with a measured score first, strongest
 * at the top, and unassessed learners last rather than at the bottom pretending
 * to be weakest.
 */
export function orderRoster(learners: ClassLearner[]): ClassLearner[] {
  return [...learners].sort((a, b) => {
    if (a.overallScore === null) return b.overallScore === null ? a.name.localeCompare(b.name) : 1
    if (b.overallScore === null) return -1
    return b.overallScore - a.overallScore || a.name.localeCompare(b.name)
  })
}

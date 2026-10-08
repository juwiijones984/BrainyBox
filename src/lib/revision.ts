import { getMasteryLevel, topicAveragesOf, weakestSkills } from '@/data'
import { localDay } from '@/lib/storage'
import type { RevisionItem, SkillProgress, SubjectId } from '@/data/types'

// ── Revision plan ──────────────────────────────────────────────────────────
//
// The old plan was eight fixed items on fixed September dates, three of them
// already ticked off before the learner had opened the app. It described
// someone else's week.
//
// A plan is now derived from the learner's own assessed mastery: the weakest
// measured skills, ordered, with real calendar dates computed from the day the
// plan is built. A learner with no evidence gets an empty plan and a
// diagnostic-first message, not a fabricated timetable.

/** How long each activity should take, before tailoring. */
const ACTIVITY_MINUTES: Record<RevisionItem['type'], number> = {
  practice: 20,
  lesson: 15,
  'mini-test': 25,
  revision: 15,
}

/**
 * Choose an activity for a skill from how it is doing.
 *
 * A major gap is re-taught from the lesson before it is drilled; a weak skill
 * is drilled; a developing one is retested; a mastered one is spaced. Using the
 * same four Marks Map bands the rest of the app uses keeps the plan consistent
 * with the charts.
 */
function activityFor(skill: SkillProgress): RevisionItem['type'] {
  switch (getMasteryLevel(skill.current)) {
    case 'major-gap': return 'lesson'
    case 'weak': return 'practice'
    case 'developing': return 'mini-test'
    default: return 'revision'
  }
}

/** Local `YYYY-MM-DD`, used to advance the streak and label plan days. */
export const isoDate = (date: Date): string => localDay(date)

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

const addDays = (from: Date, days: number): Date => {
  const next = new Date(from)
  next.setDate(next.getDate() + days)
  return next
}

const formatShortDate = (date: Date): string =>
  date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })

export interface PlanOptions {
  /** How many items to produce. */
  perDay?: number
  /** How many days the plan should cover, starting today. */
  days?: number
  /** Ids of items already completed, so they are not re-planned. */
  completedIds?: ReadonlySet<string>
  now?: Date
}

/**
 * The skill ids a set of completed ids refers to.
 *
 * Plan items are keyed `${skillId}-${YYYY-MM-DD}` — skill plus the day it was
 * scheduled for — so a completed item's id is not its skill id. The plan used to
 * test `completedIds.has(skill.id)` against bare skill ids, which can never match a
 * skill-and-day key: a learner who ticked off Monday's item got it straight back on
 * the next rebuild, because nothing recorded that the *skill* had been done.
 *
 * The date is stripped rather than prefix-matched, so `ALG-1` and `ALG-10` cannot
 * be confused for one another. A bare skill id is also accepted, which costs
 * nothing and covers records written before the key included a day.
 */
export function completedSkillIds(completedIds: Iterable<string>): Set<string> {
  const skills = new Set<string>()
  for (const id of completedIds) {
    const dated = /^(.*)-\d{4}-\d{2}-\d{2}$/.exec(id)
    skills.add(dated ? dated[1] : id)
  }
  return skills
}

/**
 * Build a study plan from measured mastery.
 *
 * Returns an empty array when nothing is assessed — the caller shows the
 * diagnostic prompt instead. Skills are taken weakest-first, so the plan always
 * starts where the learner actually needs help, and spread one per slot across
 * the requested days.
 *
 * A skill with a completed item is dropped from the ranking entirely, rather than
 * skipped mid-loop. Skipping in place consumed a slot while adding nothing, so every
 * later skill moved forward a day: its id changed with its date, so it came back
 * unticked, and the plan shifted again on the next rebuild.
 */
export function buildRevisionPlan(
  skills: SkillProgress[],
  { perDay = 1, days = 7, completedIds = new Set<string>(), now = new Date() }: PlanOptions = {},
): RevisionItem[] {
  const done = completedSkillIds(completedIds)
  const priority = weakestSkills(skills).filter(s => !done.has(s.id))
  if (!priority.length) return []

  const slots = Math.max(0, perDay * days)
  const items: RevisionItem[] = []

  for (let slot = 0; slot < slots && items.length < priority.length; slot++) {
    const dayOffset = Math.floor(slot / perDay)
    const date = addDays(now, dayOffset)
    const skill = priority[items.length]
    // Keyed by skill and day, so the same plan is idempotent across rebuilds and
    // a completed item stays matched to the skill it was for.
    const id = `${skill.id}-${isoDate(date)}`
    const type = activityFor(skill)

    items.push({
      id,
      day: DAY_NAMES[date.getDay()],
      date: formatShortDate(date),
      subjectId: skill.subjectId,
      topic: skill.topic,
      skillId: skill.id,
      type,
      durationMin: ACTIVITY_MINUTES[type],
      complete: false,
    })
  }

  return items
}

/**
 * The subjects a plan should prioritise.
 *
 * Ordered by the learner's weakest measured topic within each subject, and only
 * for subjects they are actually enrolled in. A subject with no evidence is
 * left out of the ranking rather than being given a score of zero.
 */
export const subjectsByUrgency = (
  skills: SkillProgress[],
  enrolled: readonly SubjectId[],
): { subjectId: SubjectId; weakest: number; assessed: number }[] =>
  enrolled
    .map(subjectId => {
      const topics = topicAveragesOf(skills, subjectId)
      return { subjectId, weakest: topics.length ? topics[0].average : null, topics }
    })
    // A subject with no evidence is left out of the ranking rather than given
    // a score of zero; the caller reports the gap instead.
    .filter((s): s is { subjectId: SubjectId; weakest: number; topics: typeof s.topics } =>
      s.weakest !== null)
    .map(({ subjectId, weakest, topics }) => ({
      subjectId,
      weakest,
      assessed: topics.reduce((sum, t) => sum + t.assessed, 0),
    }))
    .sort((a, b) => a.weakest - b.weakest || a.subjectId.localeCompare(b.subjectId))

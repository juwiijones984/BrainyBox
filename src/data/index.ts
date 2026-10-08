import type {
  CapsStatusOfAssessment, MasteryLevel, Question, Quiz, Skill, SkillProgress, SubjectId, Topic, Attempt,
} from './types'
import { CURRICULUM, SUBJECTS, SUBJECT_MAP } from './subjects'
import { SEED_QUESTIONS } from './questions'
import {
  LESSONS, lessonForModule, lessonForSkill,
  moduleDiagnosticQuestions, moduleQuestions, moduleReserveQuestions,
} from './mathematics'
export * from './types'
export { SUBJECTS, SUBJECT_MAP, CURRICULUM }
export { SEED_QUESTIONS }
export {
  LESSONS, lessonForModule, lessonForSkill,
  moduleDiagnosticQuestions, moduleQuestions, moduleReserveQuestions,
}
export * from './caps'
export * from './mathematicsCaps'

// ── Ids ────────────────────────────────────────────────────────────────────
// Topic names are prose and need to become ids. This is normalisation, not
// data generation: the same topic name always yields the same id, and no value
// is invented from it.
function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ── Topics ─────────────────────────────────────────────────────────────────
// Topics are derived from the skill seeds, so a topic only exists if it has at
// least one skill. The id is namespaced by subject, which keeps "Number" in
// Mathematical Literacy from colliding with anything of the same name.
export const TOPICS: Topic[] = (Object.keys(CURRICULUM) as SubjectId[]).flatMap(subjectId => {
  const seed = CURRICULUM[subjectId]
  const seen = new Set<string>()

  return seed.skills
    .filter(s => !seen.has(s.topic) && seen.add(s.topic) !== undefined)
    .map(s => ({
      id: `${subjectId}--${slug(s.topic)}`,
      subjectId,
      name: s.topic,
      term: seed.terms[s.topic] ?? 1,
    }))
})

// ── Skills ─────────────────────────────────────────────────────────────────
// The skill catalogue: identity only, identical for every learner.
//
// There is no mastery here and nothing generates any. The previous version of
// this file derived `baseline`, `current`, `attempts` and `correct` from an FNV
// hash of the skill id for 142 of the 208 skills, and carried hand-authored
// literals for the other 66 — which meant every average, every band and every
// "you have improved by N points" figure in the app was reporting a number
// nobody had earned. Mastery now lives in Firestore, per learner, and a skill
// with no evidence is `null` rather than a plausible-looking integer.
export const SKILLS: Skill[] = (Object.keys(CURRICULUM) as SubjectId[]).flatMap(subjectId =>
  CURRICULUM[subjectId].skills.map(seed => ({
    id: seed.id,
    subjectId,
    topicId: `${subjectId}--${slug(seed.topic)}`,
    topic: seed.topic,
    name: seed.name,
  })),
)

const SKILL_MAP = new Map(SKILLS.map(s => [s.id, s]))

/** The catalogue lookup used when a question or lesson names a skill. */
export const skillById = (id: string): Skill | undefined => SKILL_MAP.get(id)

// ── Questions ──────────────────────────────────────────────────────────────
// Seed questions carry a skillId; the topic follows from the skill. Ids are
// made unique here because the seed builders derive them from question text,
// which can collide across subjects.
const seenQuestionIds = new Set<string>()
export const QUESTIONS: Question[] = SEED_QUESTIONS.map((question, i) => {
  const skill = SKILL_MAP.get(question.skillId)
  let id = question.id
  if (seenQuestionIds.has(id)) id = `${id}-${i}`
  seenQuestionIds.add(id)

  return { ...question, id, topicId: skill?.topicId ?? '' }
})

// ── Quizzes ────────────────────────────────────────────────────────────────
const pick = (subjectId: SubjectId, limit: number) =>
  QUESTIONS.filter(q => q.subjectId === subjectId).slice(0, limit).map(q => q.id)

function quiz(
  id: string,
  title: string,
  description: string,
  subjectId: SubjectId,
  kind: Quiz['kind'],
  timeLimitMin: number | null,
  questionIds: string[],
  caps: { capsStatus: CapsStatusOfAssessment; capsTaskId?: string } = { capsStatus: 'formative' },
): Quiz {
  const questions = QUESTIONS.filter(q => questionIds.includes(q.id))
  return {
    id,
    title,
    description,
    subjectId,
    kind,
    timeLimitMin,
    ...caps,
    questionIds,
    topicIds: [...new Set(questions.map(q => q.topicId))],
    skillIds: [...new Set(questions.map(q => q.skillId))],
    source: 'seed',
    createdAt: '2026-09-01T00:00:00.000Z',
  }
}

// ── Study-guide assessment structure ────────────────────────────────────────
// The guide gives every module 15 questions: 10 form that module's diagnostic
// and 5 are held back. The held-back questions are what make an "equivalent
// difficulty" retest possible without repeating the diagnostic the learner has
// already seen, so each module gets a diagnostic and a practice drill.
const GUIDE_DIAGNOSTIC_IDS: string[] = []
const GUIDE_DRILL_IDS: string[] = []
const QUIZ_REGISTRY: Quiz[] = []

for (const lesson of LESSONS) {
  const n = lesson.moduleNumber
  const diagnosticIds = moduleDiagnosticQuestions(n).map(q => q.id)
  const drillIds = moduleReserveQuestions(n).map(q => q.id)
  GUIDE_DIAGNOSTIC_IDS.push(...diagnosticIds)
  GUIDE_DRILL_IDS.push(...drillIds)

  QUIZ_REGISTRY.push(
    quiz(
      `q-math-diag-m${n}`,
      `${lesson.title} Diagnostic`,
      `Module ${n} of 11. Ten skill-tagged questions that set your ${lesson.title.toLowerCase()} baseline.`,
      'mathematics', 'diagnostic', null, diagnosticIds,
    ),
    quiz(
      `q-math-drill-m${n}`,
      `${lesson.title} Drill`,
      `Five ${lesson.title.toLowerCase()} questions held back from the diagnostic, so you can retest on equivalent work.`,
      'mathematics', 'practice', null, drillIds,
    ),
  )
}

// A mixed mini-test must not repeat the diagnostic, so it is built from the
// reserve pool. Every module is represented, which is what makes it a test of
// whether the learner can pick the right method without being told the module.
const mixedMiniTestIds = GUIDE_DRILL_IDS.filter((_, i) => i % 2 === 1)

const OTHER_SUBJECT_QUIZZES: Quiz[] = [
  quiz('q-phys-drill', 'Physical Sciences Drill', 'Forces, energy, electricity and chemical reactions', 'physical-sciences', 'practice', null, pick('physical-sciences', 8)),
  quiz('q-phys-mini', 'Physical Sciences Mini-Test', 'Mixed chemistry and physics under time pressure', 'physical-sciences', 'test', 20, pick('physical-sciences', 10)),
  quiz('q-life-drill', 'Life Sciences Drill', 'Cells, systems, reproduction and evolution', 'life-sciences', 'practice', null, pick('life-sciences', 8)),
  quiz('q-life-mini', 'Life Sciences Mini-Test', 'Mixed topics under time pressure', 'life-sciences', 'test', 20, pick('life-sciences', 10)),
  quiz('q-matl-drill', 'Mathematical Literacy Drill', 'Finance, measurements, ratios and probability', 'mathematical-literacy', 'practice', null, pick('mathematical-literacy', 8)),
  quiz('q-matl-mini', 'Mathematical Literacy Mini-Test', 'Mixed topics under time pressure', 'mathematical-literacy', 'test', 20, pick('mathematical-literacy', 10)),
  quiz('q-socs-drill', 'Social Sciences Drill', 'Geography and History from Year 1 to Year 4', 'social-sciences', 'practice', null, pick('social-sciences', 8)),
  quiz('q-socs-mini', 'Social Sciences Mini-Test', 'Mixed topics under time pressure', 'social-sciences', 'test', 20, pick('social-sciences', 10)),
  quiz('q-econ-drill', 'Economic Sciences Drill', 'Markets, macro-economics and business studies', 'economic-sciences', 'practice', null, pick('economic-sciences', 8)),
  quiz('q-econ-mini', 'Economic Sciences Mini-Test', 'Mixed topics under time pressure', 'economic-sciences', 'test', 20, pick('economic-sciences', 10)),
]

export const QUIZZES: Quiz[] = [
  quiz(
    'q-math-diagnostic',
    'Full Grade 10 Diagnostic',
    'All 11 modules, 110 skill-tagged questions. Take this once to set your baseline before you start practising.',
    'mathematics', 'diagnostic', null, GUIDE_DIAGNOSTIC_IDS,
  ),
  ...QUIZ_REGISTRY,
  quiz(
    'q-math-mini',
    'Mixed Topic Mini-Test',
    'Timed paper drawn only from questions you have not been diagnosed on, so it measures new work rather than recall.',
    'mathematics', 'test', 30, mixedMiniTestIds,
  ),
  quiz(
    'q-math-exam',
    'Full Guide Revision Paper',
    'All 165 study-guide questions, one mark each, under exam conditions: 150 marks in 150 minutes. ' +
    'This is a revision paper built from the study guide, not a CAPS mock — the official Grade 10 ' +
    'Mathematics paper structure is not covered by the 2020 amendments booklet and is not yet encoded.',
    'mathematics', 'exam', 150, moduleQuestions(1).length
      ? LESSONS.flatMap(l => moduleQuestions(l.moduleNumber)).map(q => q.id)
      : [],
  ),
  ...OTHER_SUBJECT_QUIZZES,
]

// ── Attempted work ─────────────────────────────────────────────────────────
// There is no seeded history. Attempts exist in Firestore only once a learner
// has actually sat something, and every figure downstream — streaks, time
// studied, accuracy, class rankings — is derived from that. The previous ten
// hardcoded attempts, with their literal dates and hand-written answer arrays,
// are gone.

// ── Mastery bands ──────────────────────────────────────────────────────────
// These mirror the study guide's Marks Map exactly. The band boundaries drive
// every progress figure in the app, so they live in one place.
//
// `null` means the skill has never been assessed and is deliberately *not*
// treated as 0: a learner who has not sat the diagnostic is in an unknown
// state, not a failing one, and the two must render differently.
export const getMasteryLevel = (score: number | null): MasteryLevel | null =>
  score === null
    ? null
    : score >= 80 ? 'mastered' : score >= 60 ? 'developing' : score >= 40 ? 'weak' : 'major-gap'

/**
 * GREEN / YELLOW / ORANGE / RED, matching the guide's Marks Map.
 *
 * `null` maps to a neutral grey rather than the red of a major gap: an
 * unassessed skill has not been found wanting, and a red dot next to a topic
 * the learner has never opened is a false accusation.
 *
 * These are darker than the dark theme used, because they are now read as text and
 * as chart fills on white. They are six-digit hex rather than `rgba()` so callers can
 * append an alpha (`${masteryColor(level)}18`) to tint a fill — which silently
 * produced `rgba(...)18`, an invalid colour, when the unassessed grey was returned.
 */
export const masteryColor = (level: MasteryLevel | null): string =>
  level === null
    ? '#94A3B8'
    : ({ mastered: '#047857', developing: '#B45309', weak: '#C2410C', 'major-gap': '#B91C1C' })[level]

export const masteryLabel = (level: MasteryLevel | null): string =>
  level === null
    ? 'Not assessed'
    : ({ mastered: 'Mastered', developing: 'Developing', weak: 'Weak', 'major-gap': 'Major gap' })[level]

/** The guide's "what happens next" for each band, shown on the Marks Map. */
export const masteryNextAction = (level: MasteryLevel | null): string =>
  level === null
    ? 'Sit the diagnostic to find out where you stand'
    : ({
        mastered: 'Spaced revision and challenge questions',
        developing: 'Target failed skills with a drill',
        weak: 'Return to the worked examples, then drill',
        'major-gap': 'Re-teach the prerequisite skill before retesting',
      })[level]

export const topicSkills = (subjectId: SubjectId, topicId: string): Skill[] =>
  SKILLS.filter(s => s.subjectId === subjectId && s.topicId === topicId)

export const subjectTopics = (subjectId: SubjectId): Topic[] =>
  TOPICS.filter(t => t.subjectId === subjectId)

export const subjectSkills = (subjectId: SubjectId): Skill[] =>
  SKILLS.filter(s => s.subjectId === subjectId)

export const subjectQuestions = (subjectId: SubjectId): Question[] =>
  QUESTIONS.filter(q => q.subjectId === subjectId)

export const questionsForSkill = (skillId: string): Question[] =>
  QUESTIONS.filter(q => q.skillId === skillId)

/**
 * The id an ad-hoc single-skill drill is recorded under.
 *
 * `SkillPracticePage` synthesises a quiz in memory rather than saving it, so a
 * drill's `Attempt.quizId` names something that exists in no quiz list. Recent
 * Activity has to recognise that id to send the learner back to the drill instead
 * of to a test page that renders "Test not found".
 */
export const skillQuizId = (skillId: string): string => `skill-${skillId}`

export const isSkillDrillId = (quizId: string): boolean => quizId.startsWith('skill-')

// ── Averages over mastery ──────────────────────────────────────────────────
//
// These average *assessed* skills only. Averaging a list that includes
// unassessed ones would divide by skills nobody has attempted and quietly
// report a fabricated score, so the count of assessed skills is part of the
// contract: `null` means "nothing assessed here yet", which is a different
// thing from 0 and has to render differently.
type MasteryField = 'current' | 'baseline'

const meanOf = (values: (number | null)[]): number | null => {
  const assessed = values.filter((v): v is number => v !== null)
  if (!assessed.length) return null
  return Math.round(assessed.reduce((sum, v) => sum + v, 0) / assessed.length)
}

/** Mean of a field across a list, ignoring nulls. Returns null if all are null. */
export function averageOf<T>(items: T[], pick: (item: T) => number | null): number | null {
  return meanOf(items.map(pick))
}

/** Topic id used by imported skills whose topic is not in the curriculum. */
export const IMPORTED_TOPIC_SUFFIX = '--imported'

/**
 * The topic an imported question or skill belongs to.
 *
 * A teacher tagging a bank with a study-guide topic means it: those questions
 * cover the same outcomes, so they should sit in the same topic bucket and their
 * mastery should average with the curriculum's. Only a bank tagged with something
 * the curriculum does not have falls back to the sentinel below, and that is the
 * only case where the id cannot be resolved back to a `Topic`.
 */
export const importTopicId = (subjectId: SubjectId, name?: string | null): string => {
  const wanted = name?.trim().toLowerCase()
  const match = wanted
    ? TOPICS.find(t => t.subjectId === subjectId && t.name.trim().toLowerCase() === wanted)
    : undefined
  return match?.id ?? `${subjectId}${IMPORTED_TOPIC_SUFFIX}`
}

/** True for the sentinel `importTopicId` returns when no curriculum topic matched. */
export const isImportedTopic = (topicId: string): boolean => topicId.endsWith(IMPORTED_TOPIC_SUFFIX)

export const topicName = (topicId: string): string =>
  TOPICS.find(t => t.id === topicId)?.name
  // An unmatched import has no topic of its own. Calling it "General" named it
  // after a real topic in another subject, which is a worse lie than saying so.
  ?? (isImportedTopic(topicId) ? 'Imported' : 'General')

export const subjectName = (subjectId: SubjectId): string =>
  SUBJECT_MAP[subjectId]?.name ?? subjectId

export const totalMarks = (questionIds: string[]): number =>
  QUESTIONS.filter(q => questionIds.includes(q.id)).reduce((sum, q) => sum + q.marks, 0)

// ── Store-aware selectors ───────────────────────────────────────────────────
// The helpers above read the static catalogue, which is wrong for anything the
// learner has done: attempts move mastery, and imports add questions. Pages pass
// the live arrays from the store through the `*Of` variants below, so a figure
// always describes the current data rather than the shipped seed.

/** Topic mean for mastery, from a caller-supplied progress list. */
export const topicAverageOf = (
  skills: SkillProgress[],
  subjectId: SubjectId,
  topicId: string,
  field: MasteryField = 'current',
): number | null => averageOf(
  skills.filter(s => s.subjectId === subjectId && s.topicId === topicId),
  s => s[field],
)

/** Subject mean for mastery, from a caller-supplied progress list. */
export const subjectAverageOf = (
  skills: SkillProgress[],
  subjectId: SubjectId,
  field: MasteryField = 'current',
): number | null => averageOf(skills.filter(s => s.subjectId === subjectId), s => s[field])

/** Mean score across every assessed skill, from a caller-supplied list. */
export const overallSkillAverageOf = (
  skills: SkillProgress[],
  field: MasteryField = 'current',
): number | null => averageOf(skills, s => s[field])

/**
 * How many skills in a list actually have evidence, and how many do not.
 * The learner dashboard needs both: "6 of 11 modules assessed" is the honest
 * headline for a new account, where a bare percentage would be a fiction.
 */
export const masteryCoverage = (skills: SkillProgress[]): { assessed: number; total: number } => ({
  assessed: skills.filter(s => s.current !== null).length,
  total: skills.length,
})

/** Percentage of questions answered correctly across a set of attempts. */
export const attemptAverageOf = (attempts: Attempt[]): number | null => {
  const total = attempts.reduce((sum, a) => sum + a.total, 0)
  if (!total) return null
  return Math.round((attempts.reduce((sum, a) => sum + a.correct, 0) / total) * 100)
}

/** Marks for a question set, from a caller-supplied question list. */
export const totalMarksOf = (questions: Question[], questionIds: string[]): number => {
  const wanted = new Set(questionIds)
  return questions.filter(q => wanted.has(q.id)).reduce((sum, q) => sum + q.marks, 0)
}

// ── Sorting real mastery ───────────────────────────────────────────────────
// Every ranking the app shows — weakest skills, revision priority, who needs
// support — is a sort over assessed skills. Unassessed ones sort last and are
// excluded from "weakest", because calling an unassessed skill weak would be
// the same fabrication the old seeded numbers performed, just quieter.

/** Assessed skills only, weakest first. Ties break on id for a stable order. */
export const weakestSkills = (skills: SkillProgress[], limit?: number): SkillProgress[] => {
  const assessed = skills
    .filter(s => s.current !== null)
    .sort((a, b) => (a.current! - b.current!) || a.id.localeCompare(b.id))
  return typeof limit === 'number' ? assessed.slice(0, limit) : assessed
}

/** Assessed skills only, strongest first. */
export const strongestSkills = (skills: SkillProgress[], limit?: number): SkillProgress[] => {
  const assessed = skills
    .filter(s => s.current !== null)
    .sort((a, b) => (b.current! - a.current!) || a.id.localeCompare(b.id))
  return typeof limit === 'number' ? assessed.slice(0, limit) : assessed
}

/** Topic mean for a subject, ignoring topics with nothing assessed. */
export const topicAveragesOf = (
  skills: SkillProgress[],
  subjectId: SubjectId,
): { topicId: string; name: string; average: number; assessed: number }[] =>
  TOPICS
    .filter(t => t.subjectId === subjectId)
    .map(topic => {
      const inTopic = skills.filter(s => s.topicId === topic.id)
      const assessed = inTopic.filter(s => s.current !== null)
      return {
        topicId: topic.id,
        name: topic.name,
        average: meanOf(assessed.map(s => s.current)) ?? 0,
        assessed: assessed.length,
      }
    })
    // A topic with no evidence is not a zero-scoring topic; hide it from
    // rankings and let the coverage figure explain the absence.
    .filter(t => t.assessed > 0)
    .sort((a, b) => a.average - b.average || a.topicId.localeCompare(b.topicId))

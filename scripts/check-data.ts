import { readFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  CAPS_AMENDMENTS, CAPS_POLICIES, GRADE10_ASSESSMENT_STANDARDS, GRADE10_STANDARD_IDS,
  GUIDE_BAND_BREAKDOWN, IMPORTED_TOPIC_SUFFIX, LESSONS, MATHEMATICS_LEARNING_OUTCOMES,
  MATHEMATICS_MODULE_STANDARDS,
  HAS_MATHEMATICS_POA, MATHEMATICS_NCS, MATHEMATICS_OFFICIAL_TASK_CERTIFIABLE, NCS_ACHIEVEMENT_SCALE,
  NCS_ASSESSMENT_TYPES, PENDING_VERBATIM_STANDARDS, QUESTIONS, QUIZZES, SKILLS,
  SUBJECTS, TOPICS, capsPolicyFor, capsSbaWeightTotal, capsTaskMarks,
  capsWeightingTotal, crossGradeSkills, getMasteryLevel, guideBandForNcsLevel, importTopicId,
  masteryCoverage, moduleDiagnosticQuestions, moduleQuestions, moduleReserveQuestions,
  ncsAssessmentType, ncsLevel, ncsStandardsForModule, quizMatchesCapsTask, subjectAverageOf,
  subjectTopics, topicAverageOf, topicName,
  overallSkillAverageOf, weakestSkills, type CapsSubjectPolicy,
} from '../src/data'
import { buildRevisionPlan, completedSkillIds } from '../src/lib/revision'
import { answeredBySkillFrom, orderRoster, recomputeMastery, toRosterEntry, withMastery } from '../src/lib/roster'
import { ROLE_OPTIONS, SELF_REGISTERABLE_ROLES } from '../src/lib/roles'
import type { MasteryRecord, SkillProgress } from '../src/data/types'

let failures = 0
let checksRun = 0
const check = (label: string, ok: boolean, detail?: unknown) => {
  checksRun++
  if (!ok) failures++
  if (!ok) console.log(`FAIL  ${label}\n        ${JSON.stringify(detail)}`)
}
const section = (name: string) => console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 58 - name.length))}`)

// ── Referential integrity of the seed data ──────────────────────────────────
section('Referential integrity')
const skillIds = new Set(SKILLS.map(s => s.id))
const subjectIds = new Set(SUBJECTS.map(s => s.id))

check('every question maps to a real skill',
  QUESTIONS.every(q => skillIds.has(q.skillId)),
  QUESTIONS.filter(q => !skillIds.has(q.skillId)).map(q => `${q.id}→${q.skillId}`))

check('question subject matches its skill subject', QUESTIONS.every(q => {
  const skill = SKILLS.find(s => s.id === q.skillId)
  return !skill || skill.subjectId === q.subjectId
}))

check('every MCQ has >=2 options and a valid answer index', QUESTIONS
  .filter(q => q.type === 'mcq')
  .every(q => q.options.length >= 2 && q.correct >= 0 && q.correct < q.options.length))

check('every true/false question has 2 options', QUESTIONS
  .filter(q => q.type === 'true-false')
  .every(q => q.options.length === 2 && q.correct >= 0 && q.correct <= 1))

check('every short question has an accepted answer', QUESTIONS
  .filter(q => q.type === 'short')
  .every(q => q.accepted.length > 0))

check('every skill has a real subject', SKILLS.every(s => subjectIds.has(s.subjectId)))
// A shipped skill is curriculum identity only. It carries no baseline and no
// current, because those are per-learner measurements: a skill that claimed a
// score in the catalogue would give every new account a fabricated starting
// point. These checks fail if a score is ever written into the seed data again.
check('no shipped skill carries a fabricated score',
  SKILLS.every(s => !('current' in s) && !('baseline' in s)),
  SKILLS.filter(s => 'current' in s || 'baseline' in s).map(s => s.id).slice(0, 5))
check('no shipped skill claims attempts or accuracy',
  SKILLS.every(s => !('attempts' in s) && !('correct' in s)),
  SKILLS.filter(s => 'attempts' in s || 'correct' in s).map(s => s.id).slice(0, 5))

// ── Quizzes reference real questions ────────────────────────────────────────
section('Quizzes')
const questionIds = new Set(QUESTIONS.map(q => q.id))
check('every quiz references real questions', QUIZZES.every(q =>
  q.questionIds.length > 0 && q.questionIds.every(id => questionIds.has(id))),
  QUIZZES.filter(q => !q.questionIds.every(id => questionIds.has(id))).map(q => q.id))
check('no quiz has duplicate questions', QUIZZES.every(q =>
  new Set(q.questionIds).size === q.questionIds.length))
check('a mini-test never repeats a diagnostic question', (() => {
  const diag = new Set(QUIZZES.filter(q => q.kind === 'diagnostic').flatMap(q => q.questionIds))
  const mini = QUIZZES.find(q => q.id === 'q-math-mini')
  return !!mini && mini.questionIds.every(id => !diag.has(id))
})())

// ── Study-guide structure ───────────────────────────────────────────────────
section('Study guide structure')
check('there are exactly 11 lessons', LESSONS.length === 11, LESSONS.length)
check('module numbers are 1..11',
  LESSONS.map(l => l.moduleNumber).sort((a, b) => a - b).join(',') === '1,2,3,4,5,6,7,8,9,10,11')
check('every lesson has 6 concepts', LESSONS.every(l => l.concepts.length === 6),
  LESSONS.filter(l => l.concepts.length !== 6).map(l => `${l.moduleNumber}:${l.concepts.length}`))
check('every lesson has 4 worked examples', LESSONS.every(l => l.workedExamples.length === 4),
  LESSONS.filter(l => l.workedExamples.length !== 4).map(l => l.moduleNumber))
check('every lesson has key vocabulary', LESSONS.every(l => l.vocabulary.length >= 5))
check('every lesson concept maps to a real skill',
  LESSONS.every(l => l.concepts.every(c => skillIds.has(c.skillId))),
  LESSONS.flatMap(l => l.concepts.filter(c => !skillIds.has(c.skillId)).map(c => c.skillId)))
check('every worked example maps to a real skill',
  LESSONS.every(l => l.workedExamples.every(w => skillIds.has(w.skillId))))
check('every lesson concept and example has steps', LESSONS.every(l =>
  l.workedExamples.every(w => w.steps.length > 0 && w.rationale.length > 0)))

section('Guide question bank')
const guideQuestions = QUESTIONS.filter(q => q.moduleNumber !== undefined)
check('there are 165 guide questions', guideQuestions.length === 165, guideQuestions.length)
check('every module has 15 questions', LESSONS.every(l => moduleQuestions(l.moduleNumber).length === 15),
  LESSONS.map(l => `${l.moduleNumber}:${moduleQuestions(l.moduleNumber).length}`))
check('every module has 10 diagnostic questions',
  LESSONS.every(l => moduleDiagnosticQuestions(l.moduleNumber).length === 10))
check('every module has 5 reserve questions',
  LESSONS.every(l => moduleReserveQuestions(l.moduleNumber).length === 5))
check('diagnostic and reserve pools never overlap', LESSONS.every(l => {
  const d = moduleDiagnosticQuestions(l.moduleNumber).map(q => q.id)
  const r = moduleReserveQuestions(l.moduleNumber).map(q => q.id)
  return d.every(id => !r.includes(id))
}))
check('guide question ids are unique', (() => {
  const ids = guideQuestions.map(q => q.id)
  return new Set(ids).size === ids.length
})(), guideQuestions.filter((q, i) => guideQuestions.findIndex(x => x.id === q.id) !== i).map(q => q.id))
check('every guide question is worth 1 mark, as the guide specifies',
  guideQuestions.every(q => q.marks === 1))
check('every guide question cites the study guide as its source',
  guideQuestions.every(q => q.source === 'BrainyBox Grade 10 Mathematics Study Guide'))
check('every guide question is Easy, Medium or Hard',
  guideQuestions.every(q => ['easy', 'medium', 'hard'].includes(q.difficulty)))
check('each module has 5 easy, 5 medium and 5 hard questions', LESSONS.every(l => {
  const qs = moduleQuestions(l.moduleNumber)
  return ['easy', 'medium', 'hard'].every(d => qs.filter(q => q.difficulty === d).length === 5)
}))
// The guide files Module 7 Medium 5 ("find the range of 18, 21, ...") under
// Euclidean Geometry, but range is a Statistics skill. It is tagged to the
// skill that teaches it, so it sits in another topic on purpose. Every other
// guide question must match its module's topic exactly.
const CROSS_TOPIC_GUIDE_QUESTIONS = new Set(['m7-m5'])
check('every guide question belongs to its own module topic',
  LESSONS.every(l => moduleQuestions(l.moduleNumber).every(q =>
    q.topicId === l.topicId || CROSS_TOPIC_GUIDE_QUESTIONS.has(q.id))),
  LESSONS.flatMap(l => moduleQuestions(l.moduleNumber)
    .filter(q => q.topicId !== l.topicId && !CROSS_TOPIC_GUIDE_QUESTIONS.has(q.id))
    .map(q => `${q.id}: ${q.topicId} != ${l.topicId}`)))
check('the only cross-topic guide question is the documented one', (() => {
  const crossTopic = new Set(guideQuestions
    .filter(q => {
      const lesson = LESSONS.find(l => l.moduleNumber === q.moduleNumber)
      return lesson && q.topicId !== lesson.topicId
    })
    .map(q => q.id))
  return crossTopic.size === CROSS_TOPIC_GUIDE_QUESTIONS.size &&
    [...crossTopic].every(id => CROSS_TOPIC_GUIDE_QUESTIONS.has(id))
})(), [...CROSS_TOPIC_GUIDE_QUESTIONS])

// ── Every topicId must resolve ──────────────────────────────────────────────
//
// A topicId that no `Topic` matches is not a label problem: it is invisible. The
// per-topic averages filter skills by `s.topicId === topicId` against real topic
// ids, so an unresolvable one silently contributes to no topic's breakdown while
// still counting toward subject totals. The import path minted
// `${subjectId}--imported` for every imported bank, which resolved to nothing.
const resolvableTopics = new Set(TOPICS.map(t => t.id))
const unresolvable = [...QUESTIONS, ...SKILLS, ...LESSONS]
  .filter(item => item.topicId && !resolvableTopics.has(item.topicId))
  .map(item => `${item.id}: ${item.topicId}`)
check('every shipped topicId resolves to a curriculum topic',
  unresolvable.length === 0, unresolvable)
check('the only permitted unresolvable topicId is the documented import sentinel',
  importTopicId('mathematics', undefined).endsWith(IMPORTED_TOPIC_SUFFIX)
  && !resolvableTopics.has(importTopicId('mathematics', undefined)),
  { sentinel: importTopicId('mathematics', undefined), suffix: IMPORTED_TOPIC_SUFFIX })
// `topicName` is what the UI shows for a topic id, so a fallback of 'General' for
// the sentinel named it after a real topic in another subject.
check('the sentinel reports itself as imported, not as General',
  topicName(importTopicId('mathematics', undefined)) === 'Imported',
  topicName(importTopicId('mathematics', undefined)))
check('a topic name in the curriculum resolves to that topic id',
  TOPICS.every(t => importTopicId(t.subjectId, t.name) === t.id),
  TOPICS.filter(t => importTopicId(t.subjectId, t.name) !== t.id).map(t => t.id))
check('an unmatched topic name falls back to the sentinel',
  importTopicId('mathematics', 'Not A Curriculum Topic') === importTopicId('mathematics', undefined))

// ── The weak-skill engine needs every skill to be drillable ─────────────────
section('Weak-skill engine coverage')
const mathQuestions = QUESTIONS.filter(q => q.subjectId === 'mathematics')
const questionsPerSkill = new Map<string, number>()
for (const q of mathQuestions) {
  questionsPerSkill.set(q.skillId, (questionsPerSkill.get(q.skillId) ?? 0) + 1)
}

const mathSkills = SKILLS.filter(s => s.subjectId === 'mathematics')
check('every mathematics skill is covered by a lesson concept', mathSkills.every(s =>
  LESSONS.some(l => l.concepts.some(c => c.skillId === s.id))),
  mathSkills.filter(s => !LESSONS.some(l => l.concepts.some(c => c.skillId === s.id))).map(s => s.id))
check('every mathematics skill has at least 2 questions to drill', mathSkills.every(s =>
  (questionsPerSkill.get(s.id) ?? 0) >= 2),
  mathSkills.filter(s => (questionsPerSkill.get(s.id) ?? 0) < 2)
    .map(s => `${s.name} (${s.id}): ${questionsPerSkill.get(s.id) ?? 0}`))
check('every module lesson has questions', LESSONS.every(l =>
  moduleQuestions(l.moduleNumber).length > 0))

// The practice extensions must never leak into the guide's own paper.
section('Practice extensions')
const extensions = mathQuestions.filter(q => q.source === 'BrainyBox practice extension')
check('practice extensions exist for the unassessed skills', extensions.length >= 40, extensions.length)
check('no practice extension is flagged as a diagnostic', extensions.every(q => !q.diagnostic))
check('no practice extension claims a module number', extensions.every(q => q.moduleNumber === undefined))
check('no practice extension reuses a guide question id', (() => {
  const guideIds = new Set(guideQuestions.map(q => q.id))
  const dupes = extensions.filter(q => guideIds.has(q.id)).map(q => q.id)
  return dupes.length === 0
})())
check('guide bank is still exactly 165 questions after extensions were added',
  guideQuestions.length === 165, guideQuestions.length)

// ── Answer-key spot checks where the guide's own key is wrong ───────────────
section('Answer key corrections')
// The exported guide lists x^2 - 9x - 6 for Module 1 Hard 3. Expanding
// (2x+1)(x-6) - x(x-4) gives 2x^2 - 11x - 6 - x^2 + 4x = x^2 - 7x - 6.
const m1h3 = guideQuestions.find(q => q.id === 'm1-h3')
check('m1-h3 answer key is corrected to x^2 - 7x - 6',
  !!m1h3 && m1h3.accepted.includes('x^2-7x-6') && !m1h3.accepted.includes('x^2-9x-6'),
  m1h3?.accepted)

// ── Programme of Assessment (CAPS) ─────────────────────────────────────────
// The 2020 amendments booklet is the source for everything below. These checks
// exist so a transcription slip fails the build instead of shipping: every
// weighting CAPS prints must add up, every split must reach 100, and no quiz
// may claim to be a formal task without matching a prescribed one.
section('CAPS source')
check('the amendments booklet records its own implementation date',
  CAPS_AMENDMENTS.implementationDate === '2020-01', CAPS_AMENDMENTS.implementationDate)
check('the booklet records that it must be read with the full CAPS',
  CAPS_AMENDMENTS.standing.toLowerCase().includes('read together with'),
  CAPS_AMENDMENTS.standing)
check('every policy cites the section of the booklet it came from',
  CAPS_POLICIES.every(p => p.section.length > 0),
  CAPS_POLICIES.filter(p => !p.section).map(p => p.id))

section('CAPS subject coverage')
const policyKey = (p: CapsSubjectPolicy) => `${p.id}:${p.grade}`
check('no CAPS subject and grade is recorded twice', (() => {
  const keys = CAPS_POLICIES.map(policyKey)
  return new Set(keys).size === keys.length
})(), CAPS_POLICIES.map(policyKey).filter((k, i, a) => a.indexOf(k) !== i))
check('every app subject maps only to CAPS subjects we have a policy for', SUBJECTS.every(s =>
  s.capsComponents.every(c => !!capsPolicyFor(c, 10))),
  SUBJECTS.flatMap(s => s.capsComponents.filter(c => !capsPolicyFor(c, 10)).map(c => `${s.id}→${c}`)))
check('every app subject declares at least one CAPS component',
  SUBJECTS.every(s => s.capsComponents.length > 0))
// The Programme of Assessment page offers a Grade 11 toggle for every subject, but
// not every subject has a Grade 11 policy. Those gaps are deliberate and must stay
// explicit: adding a Grade 11 policy should change this list on purpose, not silently.
const GRADE_11_ENCODED = new Set(CAPS_POLICIES.filter(p => p.grade === 11).map(p => p.id))
const GRADE_11_ABSENT = new Set(SUBJECTS.flatMap(s => s.capsComponents)
  .filter(c => !GRADE_11_ENCODED.has(c)))
check('the set of subjects without a Grade 11 programme is unchanged',
  GRADE_11_ABSENT.size > 0
  && [...SUBJECTS.flatMap(s => s.capsComponents)].every(c =>
    GRADE_11_ENCODED.has(c) || GRADE_11_ABSENT.has(c)),
  { encoded: [...GRADE_11_ENCODED], absent: [...GRADE_11_ABSENT] })
check('a subject with no Grade 11 policy still has a Grade 10 one to fall back to',
  [...GRADE_11_ABSENT].every(c => !!capsPolicyFor(c, 10)),
  [...GRADE_11_ABSENT].filter(c => !capsPolicyFor(c, 10)))
check('every CAPS subject is claimed by at least one app subject', (() => {
  const claimed = new Set(SUBJECTS.flatMap(s => s.capsComponents))
  return CAPS_POLICIES.every(p => p.grade === 10 ? claimed.has(p.id) : true)
})(), CAPS_POLICIES.filter(p => p.grade === 10 && !SUBJECTS.some(s => s.capsComponents.includes(p.id))).map(p => p.id))

section('CAPS weightings')
const amended = CAPS_POLICIES.filter(p => p.status === 'amended')
const notAmended = CAPS_POLICIES.filter(p => p.status === 'not-amended')

check('Mathematics is recorded as not amended, with no invented tasks', (() => {
  const maths = notAmended.filter(p => p.id === 'mathematics')
  return maths.length > 0 && maths.every(p => p.tasks.length === 0)
})(), notAmended.map(p => `${p.id}:${p.tasks.length} tasks`))
check('only Mathematics is recorded as not amended', notAmended.every(p => p.id === 'mathematics'),
  notAmended.map(p => p.id))

check('every amended subject splits 25% SBA against 75% final', amended.every(p =>
  p.sbaWeightPct === 25 && p.finalWeightPct === 75),
  amended.filter(p => p.sbaWeightPct !== 25 || p.finalWeightPct !== 75)
    .map(p => `${p.id}${p.grade}: ${p.sbaWeightPct}/${p.finalWeightPct}`))
check('every amended subject has a 400-mark promotion mark', amended.every(p => p.promotionMark === 400),
  amended.filter(p => p.promotionMark !== 400).map(p => `${p.id}${p.grade}: ${p.promotionMark}`))
check('task weightings reach 100, or the shortfall is documented', amended.every(p =>
  capsSbaWeightTotal(p) === 100 || (p.sbaWeightNote !== undefined && capsSbaWeightTotal(p) < 100)),
  amended.filter(p => capsSbaWeightTotal(p) !== 100 && !p.sbaWeightNote)
    .map(p => `${p.id}${p.grade}: ${capsSbaWeightTotal(p)}`))
check('a documented shortfall is never above 100 or hidden', amended.every(p =>
  p.sbaWeightNote === undefined || capsSbaWeightTotal(p) < 100),
  amended.filter(p => p.sbaWeightNote && capsSbaWeightTotal(p) >= 100).map(policyKey))
check('the three Economic Sciences subjects record the printed 90% allocation', (() => {
  const econ = amended.filter(p => ['accounting', 'business-studies', 'economics'].includes(p.id))
  return econ.length === 3 && econ.every(p => capsSbaWeightTotal(p) === 90 && !!p.sbaWeightNote)
})(), amended.filter(p => ['accounting', 'business-studies', 'economics'].includes(p.id))
  .map(p => `${p.id}: ${capsSbaWeightTotal(p)}`))
check('every amended subject has a Term 4 examination', amended.every(p =>
  p.tasks.some(t => t.term === 4 && t.type === 'examination')),
  amended.filter(p => !p.tasks.some(t => t.term === 4 && t.type === 'examination')).map(policyKey))
const hasTerms = (p: CapsSubjectPolicy, terms: number[]) =>
  terms.every(term => p.tasks.some(t => t.term === term))
check('every amended subject assesses in Terms 1, 2 and 3', amended.every(p => hasTerms(p, [1, 2, 3])),
  amended.filter(p => !hasTerms(p, [1, 2, 3])).map(policyKey))
check('task ids are unique within each policy', amended.every(p => {
  const ids = p.tasks.map(t => t.id)
  return new Set(ids).size === ids.length
}), amended.flatMap(p => p.tasks.map(t => t.id).filter((id, i, a) => a.indexOf(id) !== i)))

section('CAPS paper structure')
const allPapers = amended.flatMap(p => p.tasks.flatMap(t => t.papers.map(paper => ({ policy: p, task: t, paper }))))
check('every prescribed paper carries marks and a cognitive slot', allPapers.every(x =>
  x.paper.rawMarks > 0 && Array.isArray(x.paper.cognitive)),
  allPapers.filter(x => x.paper.rawMarks <= 0).map(x => `${x.task.id}/${x.paper.label}`))
// Where CAPS prescribes a cognitive or topic split, it must total 100. Papers
// the booklet leaves without a split carry an empty list rather than an
// invented one, so an empty split is skipped rather than failed.
check('every prescribed cognitive split sums to 100', allPapers.every(x =>
  x.paper.cognitive.length === 0 || capsWeightingTotal(x.paper.cognitive) === 100),
  allPapers.filter(x => x.paper.cognitive.length > 0 && capsWeightingTotal(x.paper.cognitive) !== 100)
    .map(x => `${x.task.id}/${x.paper.label}: ${capsWeightingTotal(x.paper.cognitive)}`))
check('a prescribed cognitive split is never left half-specified', allPapers.every(x =>
  x.paper.cognitive.length === 0 || x.paper.cognitive.length >= 2),
  allPapers.filter(x => x.paper.cognitive.length === 1).map(x => x.task.id))
// Task types the booklet assesses in a mode of its own — mapwork, an essay, a
// research task, a project — rather than through a paper carrying an explicit
// cognitive split.
const MODAL_ASSESSMENT_TYPES = /mapwork|essay|research|assignment|project|practical|case study/i
const finalPaperLacksCognitiveSplit = (p: CapsSubjectPolicy) =>
  p.tasks
    .filter(t => t.term === 4)
    .some(t => t.papers.some(paper =>
      paper.cognitive.length === 0 && !MODAL_ASSESSMENT_TYPES.test(t.type)))
// The booklet prescribes a per-paper cognitive split for some subjects and not
// others. Physical Sciences and Geography are pitched only by the general three
// degrees of difficulty, so their papers legitimately carry no split. The
// allowlist records that rather than inventing weightings for them.
const COGNITIVE_SPLIT_NOT_PRESCRIBED = new Set(['physical-sciences', 'geography'])
check('every amended final paper is pitched by the booklet', amended.every(p => {
  if (COGNITIVE_SPLIT_NOT_PRESCRIBED.has(p.id)) return true
  return !finalPaperLacksCognitiveSplit(p)
}), amended.filter(p => !COGNITIVE_SPLIT_NOT_PRESCRIBED.has(p.id) && finalPaperLacksCognitiveSplit(p)).map(policyKey))
check('a subject is only excused from a cognitive split if the booklet excuses it',
  COGNITIVE_SPLIT_NOT_PRESCRIBED.size === 2 &&
  [...COGNITIVE_SPLIT_NOT_PRESCRIBED].every(id => amended.some(p => p.id === id)),
  [...COGNITIVE_SPLIT_NOT_PRESCRIBED])
check('every topic split sums to 100', allPapers.every(x =>
  !x.paper.topics || capsWeightingTotal(x.paper.topics) === 100),
  allPapers.filter(x => x.paper.topics && capsWeightingTotal(x.paper.topics) !== 100)
    .map(x => `${x.task.id}/${x.paper.label}: ${capsWeightingTotal(x.paper.topics)}`))
check('a tolerance is never negative', allPapers.every(x =>
  [...(x.paper.cognitive ?? []), ...(x.paper.topics ?? [])].every(w => (w.tolerance ?? 0) >= 0)))
check('a stated duration is always a positive number of minutes', allPapers.every(x =>
  x.paper.durationMin === null || (Number.isInteger(x.paper.durationMin) && x.paper.durationMin > 0)),
  allPapers.filter(x => x.paper.durationMin !== null && !(x.paper.durationMin > 0)).map(x => x.task.id))
check('a task with no prescribed duration does not invent one', allPapers.every(x =>
  x.paper.durationMin === null ? true : x.paper.durationMin % 15 === 0),
  allPapers.filter(x => x.paper.durationMin !== null && x.paper.durationMin % 15 !== 0)
    .map(x => `${x.task.id}/${x.paper.label}: ${x.paper.durationMin}`))
check('every prescribed task carries at least one paper', amended.every(p =>
  p.tasks.every(t => t.papers.length > 0)))
// CAPS states some tasks as a percentage of the term rather than of the SBA,
// and those shares do not always total 100 across a term — Geography's Term 2
// is printed as 25% essay + 25% mapwork + 75% mid-year. The shares are stored
// exactly as printed, so this only bounds them individually.
check('a term share is a sane percentage', amended.every(p =>
  p.tasks.every(t => t.termWeightPct === undefined || (t.termWeightPct > 0 && t.termWeightPct <= 100))),
  amended.flatMap(p => p.tasks.filter(t => t.termWeightPct !== undefined &&
    !(t.termWeightPct > 0 && t.termWeightPct <= 100)).map(t => `${t.id}: ${t.termWeightPct}`)))
check('an SBA share is a sane percentage', amended.every(p =>
  p.tasks.every(t => t.sbaWeightPct >= 0 && t.sbaWeightPct <= 100)),
  amended.flatMap(p => p.tasks.filter(t => t.sbaWeightPct < 0 || t.sbaWeightPct > 100).map(t => t.id)))

section('CAPS classification of app quizzes')
check('every quiz declares whether it counts towards the SBA', QUIZZES.every(q =>
  q.capsStatus === 'formative' || q.capsStatus === 'official-task'))
check('no quiz claims to be an official task it cannot evidence', QUIZZES.every(q => {
  if (q.capsStatus !== 'official-task') return true
  if (!q.capsTaskId) return false
  const match = amended.flatMap(p => p.tasks).find(t => t.id === q.capsTaskId)
  if (!match) return false
  return quizMatchesCapsTask(q, match, QUESTIONS).ok
}), QUIZZES.filter(q => q.capsStatus === 'official-task' && !q.capsTaskId).map(q => q.id))
check('a formative quiz never points at a prescribed task', QUIZZES.every(q =>
  q.capsStatus === 'official-task' || q.capsTaskId === undefined),
  QUIZZES.filter(q => q.capsStatus === 'formative' && q.capsTaskId).map(q => q.id))
// The app ships no official task. Mathematics has no encoded POA at all, and the
// other five subjects are still at seeded placeholder content, so every quiz is
// formative. This check exists to make that an explicit, testable fact.
check('every seeded quiz is formative while no official task is encoded', QUIZZES.every(q =>
  q.capsStatus === 'formative'),
  QUIZZES.filter(q => q.capsStatus !== 'formative').map(q => q.id))
check('a Mathematics quiz can never be an official task without the full CAPS',
  capsPolicyFor('mathematics', 10)?.status === 'not-amended')
check('every cap task referenced in the app exists in a policy',
  QUIZZES.every(q => !q.capsTaskId || amended.flatMap(p => p.tasks).some(t => t.id === q.capsTaskId)))

// ── The unassessed cold start ───────────────────────────────────────────────
//
// A learner with no attempts must read as unassessed everywhere, not as zero.
// These checks are the regression test for the fabricated-progress removal: if
// a default of 0 creeps back into `withMastery` or the selectors below, the
// Marks Map starts lying again.
section('Unassessed cold start')
const coldSkills = withMastery(SKILLS, null)
check('a new learner has every skill unassessed',
  coldSkills.every(s => s.current === null && s.baseline === null),
  coldSkills.filter(s => s.current !== null).map(s => s.id).slice(0, 5))
check('a new learner has no attempts recorded',
  coldSkills.every(s => s.attempts === 0 && s.correct === 0))
check('a new learner has no last-practised date',
  coldSkills.every(s => s.lastPracticedAt === null))
check('subject average is null, not 0, with no evidence',
  subjectAverageOf(coldSkills, 'mathematics') === null,
  subjectAverageOf(coldSkills, 'mathematics'))
check('overall average is null, not 0, with no evidence',
  overallSkillAverageOf(coldSkills) === null,
  overallSkillAverageOf(coldSkills))
check('topic average is null, not 0, with no evidence',
  topicAverageOf(coldSkills, 'mathematics', subjectTopics('mathematics')[0].id) === null)
check('coverage reports nothing assessed out of the full catalogue',
  (() => { const c = masteryCoverage(coldSkills); return c.assessed === 0 && c.total === SKILLS.length })(),
  masteryCoverage(coldSkills))
check('no skill is recommended for revision before anything is measured',
  weakestSkills(coldSkills, 5).length === 0, weakestSkills(coldSkills, 5).length)
check('a null score has no mastery band', getMasteryLevel(null) === null)
check('an unassessed learner has no revision plan at all',
  buildRevisionPlan(coldSkills).length === 0, buildRevisionPlan(coldSkills).length)

// ── Real evidence does produce real figures ────────────────────────────────
//
// The checks above pin the empty case. These pin the opposite end, so the fix
// cannot be "always return null", which would pass the first half and leave
// every Marks Map blank forever.
section('Assessed evidence')
const record = (skillId: string, baseline: number, current: number, attempts = 2): MasteryRecord => ({
  skillId, baseline, current, attempts, correct: attempts,
  trend: current - baseline > 4 ? 'improving' : current - baseline < -4 ? 'declining' : 'stable',
  lastPracticedAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})
const measuredMathSkills = mathSkills.slice(0, 10)
// A deliberate spread across the four Marks Map bands, so "weakest" means
// something. A flat set of scores would make the ordering checks pass by luck.
const measuredScores = [15, 35, 45, 55, 65, 75, 85, 25, 50, 70]
const assessedSkills = withMastery(SKILLS,
  measuredMathSkills.map((s, i) => record(s.id, 40, measuredScores[i])))
const assessedCoverage = masteryCoverage(assessedSkills)
check('coverage counts exactly the measured skills',
  assessedCoverage.assessed === 10 && assessedCoverage.total === SKILLS.length,
  assessedCoverage)
check('subject average is the mean of the measured skills only',
  (() => {
    const mean = measuredScores.reduce((a, b) => a + b, 0) / measuredScores.length
    return Math.abs(subjectAverageOf(assessedSkills, 'mathematics') - Math.round(mean)) <= 1
  })(), { got: subjectAverageOf(assessedSkills, 'mathematics'), expected: measuredScores })
check('a subject with no evidence averages to null',
  subjectAverageOf(assessedSkills, 'physical-sciences') === null,
  subjectAverageOf(assessedSkills, 'physical-sciences'))
check('the weakest measured skill is recommended first',
  (() => {
    const weak = weakestSkills(assessedSkills, 1)
    return weak.length === 1 && weak[0].current === Math.min(...measuredScores)
  })(), weakestSkills(assessedSkills, 3).map(s => `${s.id}:${s.current}`))
check('skills are ordered weakest first',
  (() => {
    const order = weakestSkills(assessedSkills).map(s => s.current ?? 0)
    return order.every((score, i) => i === 0 || score >= order[i - 1])
  })())
check('a major gap is re-taught before it is drilled',
  (() => {
    const gap = buildRevisionPlan(assessedSkills).find(i => {
      const current = assessedSkills.find(s => s.id === i.skillId)?.current ?? 100
      return current < 40
    })
    return gap?.type === 'lesson'
  })(), buildRevisionPlan(assessedSkills).map(i => `${i.skillId}:${i.type}`))
check('a developing skill is retested rather than re-taught',
  (() => {
    // Read the band off the plan the learner would actually see: a default plan
    // is seven days, so only the first seven ranked skills are in it.
    const planned = buildRevisionPlan(assessedSkills)
    const developing = planned.find(i => i.skillId &&
      (assessedSkills.find(s => s.id === i.skillId)?.current ?? 0) >= 60 &&
      (assessedSkills.find(s => s.id === i.skillId)?.current ?? 100) < 80)
    return !!developing && developing.type === 'mini-test'
  })(), buildRevisionPlan(assessedSkills).map(i => `${i.skillId}:${i.type}`))
check('a revision plan is generated from measured skills only',
  (() => {
    const plan = buildRevisionPlan(assessedSkills)
    return plan.length > 0 && plan.every(item => skillIds.has(item.skillId))
  })(), buildRevisionPlan(assessedSkills).length)
check('an unmeasured skill is never placed in a revision plan',
  (() => {
    const plan = buildRevisionPlan(assessedSkills)
    const measured = new Set(measuredMathSkills.map(s => s.id))
    return plan.every(item => measured.has(item.skillId))
  })())
/** Shift a plan's start date, for the "same plan, later day" cases below. */
const addPlanDays = (from: Date, days: number): Date => {
  const next = new Date(from)
  next.setDate(next.getDate() + days)
  return next
}

// A completed item must leave the plan: the skill it was for is done, and every other
// item keeps the day it was given.
//
// This check asserted `next.length === first.length - 1`, which was only true
// because the planner skipped the completed item *in place*, consuming a slot while
// adding nothing. Every later skill then moved forward a day, its id changed with its
// date, and it came back unticked — so completing an item made the plan shorter and
// rescheduled the rest, rather than removing one thing.
const planNow = new Date(2026, 0, 5)
const firstPlan = buildRevisionPlan(assessedSkills, { now: planNow })
const completedSkill = firstPlan[0]
const afterFirst = buildRevisionPlan(assessedSkills, {
  now: planNow, completedIds: new Set([completedSkill.id]),
})
check('a completed revision item leaves the plan entirely',
  afterFirst.every(i => i.skillId !== completedSkill.skillId),
  { done: completedSkill, stillPlanned: afterFirst.map(i => `${i.skillId}:${i.id}`) })
// The freed slot is reused rather than skipped: the next weakest skill takes today's
// date, because today is still available. So the plan keeps its length instead of
// shrinking by one — which is what the old in-place skip produced, and why a learner
// completing an item watched the rest of the week slide forward a day each time.
check('completing an item does not shorten the plan',
  afterFirst.length === firstPlan.length,
  { before: firstPlan.length, after: afterFirst.length })
check('completing an item fills the freed slot with the next weakest skill',
  afterFirst[0]?.id === `${firstPlan[1].skillId}-2026-01-05`,
  { expected: `${firstPlan[1].skillId}-2026-01-05`, got: afterFirst[0]?.id })
check('no completed item comes back, on any day',
  !buildRevisionPlan(assessedSkills, {
    now: planNow, completedIds: new Set(firstPlan.slice(0, 3).map(i => i.id)),
  }).some(i => firstPlan.slice(0, 3).some(done => done.skillId === i.skillId)),
  'a completed skill must stay out however the days fall')
check('a completed skill is never planned on a later day either',
  !buildRevisionPlan(assessedSkills, {
    now: addPlanDays(planNow, 3), completedIds: new Set([completedSkill.id]),
  }).some(i => i.skillId === completedSkill.skillId),
  'the exclusion is by skill, not by the day it was scheduled for')
check('completing everything in the plan surfaces the skills that did not fit',
  (() => {
    // Seven slots, ten measured skills: completing the plan does not empty it, it
    // promotes the three that were ranked out. Asserting it emptied would be wrong.
    const afterAll = buildRevisionPlan(assessedSkills, {
      now: planNow, completedIds: new Set(firstPlan.map(i => i.id)),
    })
    const plannedBefore = new Set(firstPlan.map(i => i.skillId))
    return afterAll.length === Math.min(measuredMathSkills.length - firstPlan.length, 7)
      && afterAll.every(i => !plannedBefore.has(i.skillId))
  })(),
  (() => {
    const afterAll = buildRevisionPlan(assessedSkills, {
      now: planNow, completedIds: new Set(firstPlan.map(i => i.id)),
    })
    return { measured: measuredMathSkills.length, planned: firstPlan.length, afterAll: afterAll.map(i => i.skillId) }
  })())
check('completing every measured skill empties the plan',
  buildRevisionPlan(assessedSkills, {
    now: planNow, completedIds: new Set(measuredMathSkills.map(s => `${s.id}-2026-01-05`)),
  }).length === 0,
  buildRevisionPlan(assessedSkills, {
    now: planNow, completedIds: new Set(measuredMathSkills.map(s => `${s.id}-2026-01-05`)),
  }).map(i => i.id))
// Skill ids contain dashes and `ALG-1`-style ids are prefixes of `ALG-10`, so the
// date suffix is stripped rather than the prefix matched.
check('a completed id resolves to its skill, not a shorter id that prefixes it',
  completedSkillIds(new Set(['ALG-10-2026-01-05'])).has('ALG-10')
  && !completedSkillIds(new Set(['ALG-10-2026-01-05'])).has('ALG-1'),
  [...completedSkillIds(new Set(['ALG-10-2026-01-05']))])
check('a bare skill id in the completed set is honoured too',
  completedSkillIds(new Set(['ALG-LIN'])).has('ALG-LIN'),
  [...completedSkillIds(new Set(['ALG-LIN']))])
check('a plan is idempotent when nothing has been completed',
  buildRevisionPlan(assessedSkills, { now: planNow }).map(i => i.id).join()
  === buildRevisionPlan(assessedSkills, { now: planNow }).map(i => i.id).join())

// ── Roster from real enrolment ─────────────────────────────────────────────
section('Roster aggregation')
check('a learner with no evidence cannot be ranked',
  (() => {
    const row = toRosterEntry('u1', 'mathematics', {
      profile: { name: 'New', avatar: 'N' }, skills: coldSkills, sessionCount: 0, lastActive: null,
    })
    return row.overallScore === null && row.weakTopic === null && row.trend === 'stable'
  })(), toRosterEntry('u1', 'mathematics', {
    profile: { name: 'New', avatar: 'N' }, skills: coldSkills, sessionCount: 0, lastActive: null,
  }))
check('an unassessed learner sorts below every assessed one',
  (() => {
    const blank = toRosterEntry('u1', 'mathematics', {
      profile: { name: 'Blank', avatar: 'B' }, skills: coldSkills, sessionCount: 0, lastActive: null,
    })
    const measured = toRosterEntry('u2', 'mathematics', {
      profile: { name: 'Measured', avatar: 'M' }, skills: assessedSkills, sessionCount: 3, lastActive: '2026-01-01T00:00:00.000Z',
    })
    return orderRoster([blank, measured]).map(l => l.uid).join() === 'u2,u1'
  })(), orderRoster([
    toRosterEntry('u1', 'mathematics', { profile: { name: 'Blank', avatar: 'B' }, skills: coldSkills, sessionCount: 0, lastActive: null }),
    toRosterEntry('u2', 'mathematics', { profile: { name: 'Measured', avatar: 'M' }, skills: assessedSkills, sessionCount: 3, lastActive: '2026-01-01T00:00:00.000Z' }),
  ]).map(l => l.uid))
check('the session count is the real attempt count, not a per-skill sum',
  (() => {
    const row = toRosterEntry('u3', 'mathematics', {
      profile: { name: 'S', avatar: 'S' }, skills: assessedSkills, sessionCount: 2, lastActive: null,
    })
    return row.sessions === 2
  })())
check('a weak topic is named only when a measurement exists',
  (() => {
    const row = toRosterEntry('u4', 'mathematics', {
      profile: { name: 'W', avatar: 'W' }, skills: assessedSkills, sessionCount: 1, lastActive: null,
    })
    return typeof row.weakTopic === 'string' && row.weakTopic.length > 0
  })())

// ── Mastery rebuild ─────────────────────────────────────────────────────────
//
// `recomputeMastery` is what `deleteAttempt` uses to restate a skill after an
// attempt is removed. It previously seeded each skill's first attempt from the
// stored record, which meant the deleted attempt was folded back in: `current` is a
// blend over the whole history and its `correct`/`answered` counts included the
// attempt that was gone. Nothing below could have caught that, because nothing
// exercised the arithmetic.
const SKILL_OF: ReadonlyMap<string, string> = new Map([
  ['q1', 'ALG-LIN'], ['q2', 'ALG-LIN'], ['q3', 'ALG-LIN'],
  ['q4', 'ALG-QUAD'],
])
const attemptOn = (id: string, date: string, questionIds: string[], results: boolean[]): Attempt => ({
  id, date, startedAt: 0, finishedAt: 0,
  subjectId: 'mathematics', quizId: 'z', title: id,
  questionIds, results,
})

section('Mastery rebuild after deleting an attempt')
const twoSittings = [
  attemptOn('a1', '2026-01-01T09:00:00.000Z', ['q1', 'q2'], [true, false]),
  attemptOn('a2', '2026-01-08T09:00:00.000Z', ['q3'], [true]),
]
const full = recomputeMastery(twoSittings, SKILL_OF).get('ALG-LIN')!
const afterDeletingFirst = recomputeMastery([twoSittings[1]], SKILL_OF).get('ALG-LIN')!
const twoSittingsJson = JSON.stringify([...recomputeMastery(twoSittings, SKILL_OF)])

check('a rebuild counts every sittings and every question',
  full.attempts === 2 && full.answered === 3 && full.correct === 2, full)
check('the earliest attempt is the baseline', full.baseline === 50, full)

check('deleting the first attempt removes its questions from the denominator',
  afterDeletingFirst.answered === 1, afterDeletingFirst)
check('deleting the first attempt removes its correct answers',
  afterDeletingFirst.correct === 1, afterDeletingFirst)
check('deleting the first attempt removes the sitting count',
  afterDeletingFirst.attempts === 1, afterDeletingFirst)
// The baseline moves to the earliest surviving attempt. That is the honest outcome: a
// baseline citing an attempt that no longer exists describes nothing.
check('deleting the first attempt moves the baseline to the earliest survivor',
  afterDeletingFirst.baseline === 100, afterDeletingFirst)
// The real regression: seeded from the stored record, the survivor was blended onto a
// score that still contained the deleted attempt, so deleting it barely moved the
// figure. A rebuild of one sitting has to read as that sitting.
check('a one-sitting rebuild is not blended onto the two-sitting score',
  afterDeletingFirst.current === 100, afterDeletingFirst)
check('a one-sitting rebuild is not the two-sitting current',
  afterDeletingFirst.current !== full.current, { twoSittings: full.current, oneSittings: afterDeletingFirst.current })
check('accuracy divides by questions, not by sittings',
  afterDeletingFirst.correct / afterDeletingFirst.answered === 1
  && afterDeletingFirst.attempts === 1, afterDeletingFirst)

check('a rebuild is deterministic',
  JSON.stringify([...recomputeMastery(twoSittings, SKILL_OF)]) === twoSittingsJson)
check('attempt order does not change the result',
  JSON.stringify([...recomputeMastery([...twoSittings].reverse(), SKILL_OF)]) === twoSittingsJson)
check('a skill with no surviving attempt has no record at all',
  !recomputeMastery([], SKILL_OF).has('ALG-LIN'),
  [...recomputeMastery([], SKILL_OF).keys()])
check('a rebuild never reports more correct than answered',
  [...recomputeMastery(twoSittings, SKILL_OF).values()].every(r => r.correct <= r.answered))
check('a question belonging to no skill is counted nowhere',
  !recomputeMastery([attemptOn('a3', '2026-01-02T09:00:00.000Z', ['nowhere'], [true])], SKILL_OF).size,
  'an unmapped question must not create a record')

// ── NCS Mathematics: the full Subject Statement ─────────────────────────────
section('NCS Mathematics source')
check('the NCS subject statement records its own provenance',
  MATHEMATICS_NCS.publisher === 'Department of Education' &&
  MATHEMATICS_NCS.year === 2003 && MATHEMATICS_NCS.isbn === '1-919975-28-4',
  { publisher: MATHEMATICS_NCS.publisher, year: MATHEMATICS_NCS.year, isbn: MATHEMATICS_NCS.isbn })
check('the NCS statement is explicit that it is not a Programme of Assessment',
  MATHEMATICS_NCS.standing.includes('does not set a Programme of Assessment'),
  MATHEMATICS_NCS.standing)

section('NCS achievement scale')
check('the official scale has six levels numbered 1 to 6',
  NCS_ACHIEVEMENT_SCALE.length === 6 &&
  [...NCS_ACHIEVEMENT_SCALE].sort((a, b) => a.level - b.level)
    .map(b => b.level).join() === '1,2,3,4,5,6')
check('the official labels are the printed NCS labels',
  [...NCS_ACHIEVEMENT_SCALE].sort((a, b) => a.level - b.level)
    .map(b => b.label).join('|') === 'Inadequate|Partial|Adequate|Satisfactory|Meritorious|Outstanding')
check('the official scale covers 0 to 100 with no gaps and no overlaps', (() => {
  const asc = [...NCS_ACHIEVEMENT_SCALE].sort((a, b) => a.minPct - b.minPct)
  return asc[0].minPct === 0 && asc[asc.length - 1].maxPct === 100 &&
    asc.every((b, i) => i === 0 || b.minPct === asc[i - 1].maxPct + 1)
})(), NCS_ACHIEVEMENT_SCALE.map(b => `${b.minPct}-${b.maxPct}`))
check('every percentage maps to exactly one level, boundaries included',
  [0, 29, 30, 39, 40, 49, 50, 59, 60, 79, 80, 100, 45, 55, 65, 85]
    .map(pct => ncsLevel(pct)).join() === '1,1,2,2,3,3,4,4,5,5,6,6,3,4,5,6')
check('scores outside 0 to 100 are clamped, not thrown', ncsLevel(-5) === 1 && ncsLevel(140) === 6)

section('NCS learning outcomes and standards')
check('there are four learning outcomes numbered 1 to 4',
  MATHEMATICS_LEARNING_OUTCOMES.length === 4 &&
  MATHEMATICS_LEARNING_OUTCOMES.map(l => l.number).join() === '1,2,3,4')
check('the Grade 10 outcome titles are the printed NCS titles',
  MATHEMATICS_LEARNING_OUTCOMES.map(l => l.title).join('|') ===
  'Number and Number Relationships|Functions and Algebra|Space, Shape and Measurement|Data Handling and Probability')
check('every standard id is well formed as 10.<outcome>.<n>',
  GRADE10_ASSESSMENT_STANDARDS.every(s => {
    const m = /^10\.([1-4])\.(\d+)$/.exec(s.id)
    return !!m && Number(m[1]) === s.outcome
  }), GRADE10_ASSESSMENT_STANDARDS.filter(s => !/^10\.[1-4]\.\d+$/.test(s.id)).map(s => s.id))
check('no standard is recorded twice', (() => {
  const ids = GRADE10_STANDARD_IDS
  return new Set(ids).size === ids.length
})(), GRADE10_STANDARD_IDS.filter((id, i, a) => a.indexOf(id) !== i))
check('there are 24 Grade 10 standards', GRADE10_ASSESSMENT_STANDARDS.length === 24,
  GRADE10_ASSESSMENT_STANDARDS.length)
check('the outcomes list and the standard records agree exactly', (() => {
  const fromOutcomes = MATHEMATICS_LEARNING_OUTCOMES.flatMap(l => l.standards)
  return fromOutcomes.length === GRADE10_STANDARD_IDS.length &&
    fromOutcomes.every(id => GRADE10_STANDARD_IDS.includes(id))
})(), {
  outcomeOnly: MATHEMATICS_LEARNING_OUTCOMES.flatMap(l => l.standards)
    .filter(id => !GRADE10_STANDARD_IDS.includes(id)),
  recordOnly: GRADE10_STANDARD_IDS
    .filter(id => !MATHEMATICS_LEARNING_OUTCOMES.flatMap(l => l.standards).includes(id)),
})
// The document runs 10.4.1, 10.4.2, 10.4.3, 10.4.5. There is no 10.4.4 at
// Grade 10. If a future transcription "fixes" this, the source has changed.
check('Grade 10 genuinely has no 10.4.4', !GRADE10_STANDARD_IDS.includes('10.4.4'),
  GRADE10_STANDARD_IDS.filter(id => id.startsWith('10.4')))
check('every standard has a summary', GRADE10_ASSESSMENT_STANDARDS.every(s => s.summary.length > 20),
  GRADE10_ASSESSMENT_STANDARDS.filter(s => s.summary.length <= 20).map(s => s.id))

section('NCS module mapping')
const GUIDE_MODULES = Array.from({ length: 11 }, (_, i) => i + 1)
check('every one of the eleven study-guide modules is mapped to the NCS',
  GUIDE_MODULES.every(n => ncsStandardsForModule(n).length > 0),
  GUIDE_MODULES.filter(n => ncsStandardsForModule(n).length === 0))
check('a module is not mapped twice', (() => {
  const ns = MATHEMATICS_MODULE_STANDARDS.map(m => m.moduleNumber)
  return new Set(ns).size === ns.length
})(), MATHEMATICS_MODULE_STANDARDS.map(m => m.moduleNumber))
check('every module points at real Grade 10 standards', (() => {
  const bad = MATHEMATICS_MODULE_STANDARDS.flatMap(m =>
    m.standards.filter(id => !GRADE10_STANDARD_IDS.includes(id)).map(id => `M${m.moduleNumber}→${id}`))
  return bad.length === 0
})(), MATHEMATICS_MODULE_STANDARDS.flatMap(m =>
  m.standards.filter(id => !GRADE10_STANDARD_IDS.includes(id)).map(id => `M${m.moduleNumber}→${id}`)))
check('every standard points at an outcome that exists', GRADE10_ASSESSMENT_STANDARDS.every(s =>
  MATHEMATICS_LEARNING_OUTCOMES.some(l => l.number === s.outcome)))

// The five standards the guide does not own: three integrative ones that cut
// across modules, plus two the eleven-module guide simply has no home for.
// Recorded as the expected set so a new gap fails the build, and so the gap
// itself is visible rather than inferred from a missing count.
const EXPECTED_UNCOVERED = ['10.1.1', '10.1.6', '10.2.6', '10.3.7', '10.4.5']
const uncovered = GRADE10_STANDARD_IDS
  .filter(id => !MATHEMATICS_MODULE_STANDARDS.some(m => m.standards.includes(id)))
check('the uncovered standards are exactly the five already accounted for',
  uncovered.join() === EXPECTED_UNCOVERED.join(), { uncovered, expected: EXPECTED_UNCOVERED })
console.log('  standards not owned by a single guide module:', uncovered.join(', '))

check('cross-grade skills are real skills that exist in the seed',
  crossGradeSkills().every(c => skillIds.has(c.skillId)),
  crossGradeSkills().filter(c => !skillIds.has(c.skillId)).map(c => c.skillId))
check('every cross-grade skill explains why it sits outside Grade 10',
  crossGradeSkills().every(c => c.reason.length > 40),
  crossGradeSkills().filter(c => c.reason.length <= 40).map(c => c.skillId))

section('NCS scale against the guide bands')
// The guide's four bands are a coarsening of the official six. This asserts the
// relationship holds, so a change to either scale has to be acknowledged.
const GUIDE_BAND_RANGES: Record<string, [number, number]> = {
  mastered: [80, 100], developing: [60, 79], weak: [40, 59], 'major-gap': [0, 39],
}
check('the app still bands scores the way the Marks Map does', (() => {
  for (const [band, [lo, hi]] of Object.entries(GUIDE_BAND_RANGES)) {
    for (const pct of [lo, hi, Math.round((lo + hi) / 2)]) {
      if (getMasteryLevel(pct) !== band) return false
    }
  }
  return true
})(), GUIDE_BAND_RANGES)
check('the guide bands decompose exactly into the official levels', (() => {
  for (const [band, [lo, hi]] of Object.entries(GUIDE_BAND_RANGES)) {
    const levels = GUIDE_BAND_BREAKDOWN[band] ?? []
    const covered = levels.reduce((n, l) => {
      const b = NCS_ACHIEVEMENT_SCALE.find(x => x.level === l)!
      return n + (b.maxPct - b.minPct + 1)
    }, 0)
    const spread = hi - lo + 1
    if (levels.length === 0 || covered !== spread) return false
    // The levels in a band must be the ones whose range sits inside it.
    if (!levels.every(l => {
      const b = NCS_ACHIEVEMENT_SCALE.find(x => x.level === l)!
      return b.minPct >= lo && b.maxPct <= hi
    })) return false
  }
  return Object.values(GUIDE_BAND_BREAKDOWN).flat().sort().join() === '1,2,3,4,5,6'
})(), GUIDE_BAND_BREAKDOWN)
check('every official level maps back to exactly one guide band',
  NCS_ACHIEVEMENT_SCALE.every(b => !!guideBandForNcsLevel(b.level)) &&
  new Set(NCS_ACHIEVEMENT_SCALE.map(b => guideBandForNcsLevel(b.level))).size === 4)

section('NCS assessment types')
check('all four NCS assessment types are recorded',
  NCS_ASSESSMENT_TYPES.map(t => t.id).sort().join() === 'baseline,diagnostic,formative,summative')
check('each assessment type has a definition and a mapping note',
  NCS_ASSESSMENT_TYPES.every(t => t.definition.length > 40 && t.note.length > 20))
check('an assessment type can be looked up by id',
  NCS_ASSESSMENT_TYPES.every(t => ncsAssessmentType(t.id)?.title === t.title))

section('Mathematics official-task certification')
// The whole point of the flag: while any standard is only paraphrased, or the
// Programme of Assessment is missing, Mathematics may not claim official tasks.
check('certification stays off while standards are pending verbatim transcription',
  PENDING_VERBATIM_STANDARDS.length > 0 ? !MATHEMATICS_OFFICIAL_TASK_CERTIFIABLE : true,
  { pending: PENDING_VERBATIM_STANDARDS, certifiable: MATHEMATICS_OFFICIAL_TASK_CERTIFIABLE })
// Both documented conditions, checked. The flag tested only the verbatim condition
// while its own comment claimed a conjunction, so it would have certified an
// official task with no Programme of Assessment to certify against.
check('certification requires a Programme of Assessment as well as verbatim standards',
  HAS_MATHEMATICS_POA
    ? MATHEMATICS_OFFICIAL_TASK_CERTIFIABLE === (PENDING_VERBATIM_STANDARDS.length === 0)
    : !MATHEMATICS_OFFICIAL_TASK_CERTIFIABLE,
  { poa: HAS_MATHEMATICS_POA, certifiable: MATHEMATICS_OFFICIAL_TASK_CERTIFIABLE })
check('no Mathematics quiz claims an official task', QUIZZES
  .filter(q => q.capsTaskId)
  .every(q => q.capsTaskId?.startsWith('math')),
  QUIZZES.filter(q => q.capsTaskId?.startsWith('math')).map(q => `${q.id}→${q.capsTaskId}`))
const mathPolicy = capsPolicyFor('mathematics', 10)
check('the Mathematics policy still has no tasks, so nothing can bind to one',
  !!mathPolicy && mathPolicy.tasks.length === 0, mathPolicy?.tasks.length)
check('the Mathematics policy cites the NCS subject statement as its curriculum source',
  !!mathPolicy && mathPolicy.notes.includes('ISBN 1-919975-28-4') &&
  mathPolicy.status === 'not-amended', mathPolicy?.section)
console.log(`  standards awaiting verbatim text: ${PENDING_VERBATIM_STANDARDS.join(', ')}`)

// ── Rules cover every path the app actually uses ───────────────────────────
//
// The `questions` and `skills` collections were written by `AppStore` and had no
// rule at all, so the catch-all denied them and loading failed for every signed-in
// learner. Nothing in the build caught it, because the rules are not TypeScript
// and nothing compares them to the paths in `store.ts`.
//
// This closes that gap by parsing both files. It is a text comparison, not a
// rules evaluation — it cannot tell you a condition is *wrong*, only that a
// collection the app writes has no rule naming it at all, which is the failure
// that reads as a mysterious permission error.
// ── Assessment kinds have briefing copy ─────────────────────────────────────
//
// This is a crash that shipped: `TestRunnerPage`'s `BRIEF` map was typed
// `Record<string, ...>`, so the compiler was satisfied by any lookup and the
// missing `diagnostic` key compiled fine. Every diagnostic quiz — one per lesson,
// plus `q-math-diagnostic` — then died on `Cannot read properties of undefined
// (reading 'title')`.
//
// Three things are asserted, because each catches a different recurrence:
// the type annotation (compiler-enforced completeness going forward), the keys
// themselves against both the union and the kinds actually used by the seed
// data, and the runtime fallback that Firestore-sourced quizzes need.
section('Assessment kind briefing')

const testRunnerText = readFileSync(new URL('../src/pages/learner/TestRunnerPage.tsx', import.meta.url), 'utf8')
const typesText2 = readFileSync(new URL('../src/data/types.ts', import.meta.url), 'utf8')

const briefKeys = new Set(
  [.../const BRIEF:[^=]*=\s*\{([\s\S]*?)\n\}/.exec(testRunnerText)?.[1]?.matchAll(/^\s{2}(\w+):\s*\{/gm) ?? []]
    .map(m => m[1]),
)

// Scoped to one line, not `[^;]+`: `AssessmentKind` is declared without a
// trailing semicolon, so a semicolon-terminated match ran on through
// `ResourceKind`, `SubjectId` and the rest, and reported every one of their
// members as a missing kind.
const kindUnion = /export type AssessmentKind\s*=\s*([^\n;]+)/.exec(typesText2)?.[1] ?? ''
const declaredKinds = [...kindUnion.matchAll(/'(\w+)'/g)].map(m => m[1])
const kindsInUse = [...new Set(QUIZZES.map(q => q.kind))]

check('BRIEF is keyed by AssessmentKind, not by string',
  /const BRIEF:\s*Record<AssessmentKind,/.test(testRunnerText),
  (/const BRIEF:[^=]*=/.exec(testRunnerText)?.[0] ?? '').trim())

check('every declared assessment kind has briefing copy',
  declaredKinds.length > 0 && declaredKinds.every(k => briefKeys.has(k)),
  { declared: declaredKinds, missing: declaredKinds.filter(k => !briefKeys.has(k)) })

check('every kind used by the seed quizzes has briefing copy',
  kindsInUse.length > 0 && kindsInUse.every(k => briefKeys.has(k)),
  { used: kindsInUse, missing: kindsInUse.filter(k => !briefKeys.has(k)) })

// `users/{uid}/quizzes` is writable by its owner and read straight into the
// store, so a `kind` can be any string at runtime. The type cannot save that.
check('the briefing lookup falls back for an unknown kind',
  /BRIEF\[quiz\.kind\]\s*\?\?/.test(testRunnerText),
  (/const brief = .*/.exec(testRunnerText)?.[0] ?? '').trim())

// `KIND_META` in TestsPage was the pattern BRIEF should have followed.
const testsPageText = readFileSync(new URL('../src/pages/learner/TestsPage.tsx', import.meta.url), 'utf8')
check('TestsPage KIND_META is also keyed by AssessmentKind',
  /const KIND_META:\s*Record<AssessmentKind,/.test(testsPageText),
  (/const KIND_META:[^=]*=/.exec(testsPageText)?.[0] ?? '').trim())

// A clickable `Card` renders a real <button>, so any <button> nested inside one is
// invalid HTML that the browser hoists out of the outer control. Nothing in the type
// system stops it, so the shape is checked in the source instead.
section('Interactive nesting')
const CARD_RENDERS_BUTTON = /if \(as === 'button' \|\| interactive\)\s*\{[\s\S]{0,200}?<button/
const uiCardText = readFileSync(new URL('../src/components/ui/index.tsx', import.meta.url), 'utf8')
check('a clickable Card is still a real button, which is why nesting matters',
  CARD_RENDERS_BUTTON.test(uiCardText),
  'Card no longer renders a <button>; re-check the nesting rule')
const pageFiles = globSync('src/**/*.tsx', { cwd: fileURLToPath(new URL('..', import.meta.url)) })
  .map(p => p.replace(/\//g, '\\'))
check('there are tsx pages to scan for nested controls', pageFiles.length > 20, pageFiles.length)

/** Rough JSX nesting depth of `<Card ...>`, ignoring strings and comments. */
const cardNestingOffences = (source: string): string[] => {
  const offences: string[] = []
  // Strip comments so a documented example is not mistaken for live markup.
  const clean = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  const stack: number[] = []
  const tag = /<(\/?)(Card|Button|a|button)(?=[\s/>])((?:[^<>]|"[^"]*"|'[^']*')*?)(\/?)>/g
  let m: RegExpExecArray | null
  while ((m = tag.exec(clean))) {
    const [, closing, name, , selfClosing] = m
    if (name === 'Card' || name === 'button' || name === 'a' || name === 'Button') {
      // A component named Card only becomes a <button> when it is given onClick.
      const clickable = name !== 'Card' || /\bonClick\s*=/.test(m[3]) || /\bas\s*=\s*['"]button['"]/.test(m[3])
      if (closing) {
        stack.pop()
      } else if (!selfClosing) {
        const outer = stack[stack.length - 1]
        if (clickable && outer && outer.clickable) {
          offences.push(`<${name}> inside a clickable <${outer.name}>`)
        }
        stack.push({ name, clickable })
      }
    }
  }
  return offences
}
const nestingOffences = pageFiles.flatMap(file => {
  const source = readFileSync(new URL(`../${file.replace(/\\/g, '/')}`, import.meta.url), 'utf8')
  return cardNestingOffences(source).map(o => `${file}: ${o}`)
})
check('no clickable Card contains another button or link', nestingOffences.length === 0,
  nestingOffences)

section('Security rule coverage')
const rulesText = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
const storeText = readFileSync(new URL('../src/lib/firebase/store.ts', import.meta.url), 'utf8')
const storageRulesText = readFileSync(new URL('../storage.rules', import.meta.url), 'utf8')
const loginPageText = readFileSync(new URL('../src/pages/auth/LoginPage.tsx', import.meta.url), 'utf8')
const dashboardShellText = readFileSync(new URL('../src/components/layout/DashboardShell.tsx', import.meta.url), 'utf8')
const profilePageText = readFileSync(new URL('../src/pages/learner/ProfilePage.tsx', import.meta.url), 'utf8')
const learnerShellText = readFileSync(new URL('../src/components/layout/LearnerShell.tsx', import.meta.url), 'utf8')
const signOutText = readFileSync(new URL('../src/components/layout/SignOutButton.tsx', import.meta.url), 'utf8')
const typesText = readFileSync(new URL('../src/data/types.ts', import.meta.url), 'utf8')
const authLibText = readFileSync(new URL('../src/lib/firebase/auth.ts', import.meta.url), 'utf8')
const authStoreText = readFileSync(new URL('../src/store/AuthStore.tsx', import.meta.url), 'utf8')
const guardsText = readFileSync(new URL('../src/app/guards.ts', import.meta.url), 'utf8')
const routesText = readFileSync(new URL('../src/app/routes.ts', import.meta.url), 'utf8')
const isKnownRoleText = /function isKnownRole\([^)]*\) \{[\s\S]*?\n    \}/.exec(rulesText)?.[0] ?? ''
const adminPagesText = ['AdminOverviewPage', 'AdminPeoplePage', 'AdminClassesPage', 'AdminLinksPage']
  .map(f => readFileSync(new URL(`../src/pages/admin/${f}.tsx`, import.meta.url), 'utf8'))
  .join('\n')
const provisionText = readFileSync(new URL('./provision.ts', import.meta.url), 'utf8')
const KNOWN_ROLES_CONST = /const KNOWN_ROLES[^=]*=\s*(\[[^\]]*\])/.exec(provisionText)?.[1] ?? ''

// Every collection the client addresses, taken from the `paths` map so a new one
// cannot be added without appearing here.
const clientCollections = Array.from(
  storeText.matchAll(/`([a-z]+)\/\$\{uid\}(?:\/[a-z]+)?`/g),
  m => m[1],
)
const ruleCollections = new Set(
  Array.from(rulesText.matchAll(/match \/([a-zA-Z]+)/g), m => m[1]),
)

check('the rules name every top-level collection the client addresses',
  clientCollections.every(c => ruleCollections.has(c)),
  clientCollections.filter(c => !ruleCollections.has(c)))

// The per-user subcollections are the ones that actually broke, so they are
// checked individually rather than by top-level name.
const clientSubcollections = ['attempts', 'questions', 'skills', 'quizzes', 'resources', 'revision']
const userBlock = /match \/users\/\{uid\} \{([\s\S]*?)\n    \}\n/.exec(rulesText)?.[1] ?? ''
check('every per-user collection the app writes has a rule',
  clientSubcollections.every(c => new RegExp(`match /${c}/\\{`).test(userBlock)),
  clientSubcollections.filter(c => !new RegExp(`match /${c}/\\{`).test(userBlock)))

// Both parent and teacher shell out of DashboardShell, and the learner reaches
// sign-out from both the header and the profile page. Each was verified by hand
// to be reachable: the parent and teacher portals previously had no sign-out
// anywhere, the only button that looked like one ("Switch") navigated to `/`,
// which `Entry()` resolves straight back to the same portal, and the learner had
// to pass through the profile page to end a session.
check('the parent and teacher shell can end the session',
  /<SignOutButton\b/.test(dashboardShellText) && !/>\s*Switch\s*</.test(dashboardShellText),
  dashboardShellText.match(/<SignOutButton\b[^>]*>|>\s*Switch\s*</)?.[0] ?? 'no sign-out affordance')

check('the learner dashboard can end the session',
  /<SignOutButton\b/.test(learnerShellText),
  learnerShellText.match(/<SignOutButton\b[^>]*>/)?.[0] ?? 'no sign-out affordance')

check('the learner profile page can end the session',
  /<SignOutButton\b/.test(profilePageText),
  profilePageText.match(/<SignOutButton\b[^>]*>/)?.[0] ?? 'no sign-out affordance')

// One component, so the two portals cannot drift apart. `signOut` is a network
// round-trip; without the pending latch a double-tap fires two of them and the
// second rejects against an already-signed-out client.
check('sign-out latches while the request is in flight',
  /useState\(false\)/.test(signOutText) && /if \(pending\) return/.test(signOutText) &&
  /signOut\(\)\.catch/.test(signOutText),
  signOutText.match(/if \(pending\) return/)?.[0] ?? 'no pending guard')

// A parent and a teacher must be able to read a learner's history; the whole
// parent and teacher portal depends on these two being cross-account readable.
const attemptsRule = /match \/attempts\/\{attemptId\} \{([\s\S]*?)\n      \}/.exec(rulesText)?.[1] ?? ''
check('attempt history is readable by a linked guardian or teacher',
  /allow read: if canViewLearner/.test(attemptsRule), attemptsRule.trim())
check('attempt history is not writable by a guardian or teacher',
  /allow write, delete: if isSelf/.test(attemptsRule) && !/allow read, write/.test(attemptsRule))

// `role` and `teacherUids` are what make a profile the authorisation boundary.
// A self-update that could touch either would let any account promote itself.
const profileUpdate = /allow update: if isSelf\(uid\)[\s\S]*?hasOnly\(\[([\s\S]*?)\]\)/.exec(rulesText)?.[1] ?? ''
check('a profile self-update cannot change the role',
  !profileUpdate.split(',').some(f => f.includes("'role'")))
check('a profile self-update cannot change teacherUids',
  !profileUpdate.split(',').some(f => f.includes('teacherUids')))
check('a profile self-update can still change the display fields',
  ['name', 'grade', 'subjects'].every(f => profileUpdate.includes(`'${f}'`)), profileUpdate.trim())

// Cloud Storage rules reach Firestore through the `firestore` namespace; a bare
// `get()` there refers to a storage object, not a document, and the deploy is
// rejected with a compile error rather than a runtime denial.
check('storage rules read Firestore through the firestore namespace',
  storageRulesText.includes('firestore.get(') && storageRulesText.includes('firestore.exists('))
// A bare `get(`/`exists(` on a document path is the Firestore form and refers
// to a storage object in a bucket, so it is a compile error, not a denial.
// Matched with a preceding non-identifier character so `firestore.get(` does
// not count as a violation of its own qualified form.
check('storage rules do not use Firestore-only get() on a document path',
  !/(^|[^.\w])get\(\/databases\//m.test(storageRulesText) &&
  !/(^|[^.\w])exists\(\/databases\//m.test(storageRulesText))
// `allow write` covers deletes, where `request.resource` is null, so reading
// `.size` off it denies the owner their own delete.
check('storage rules separate delete from the size-checked create',
  /allow delete: if isSelf/.test(storageRulesText) &&
  /allow create, update: if isSelf/.test(storageRulesText))

// The provisioning script is the only thing that may create these, so the rules
// must not offer a browser a way in.
check('the three relationships are operator-only in the rules',
  /match \/parentLinks\/\{linkId\}/.test(rulesText) &&
  /allow create, delete: if isAdmin/.test(rulesText))
check('an unmatched path is denied', /match \/\{document=\*\*\} \{\s*allow read, write: if false/.test(rulesText))

// ── Self-declared roles stay inert ──────────────────────────────────────────
//
// `parent` and `teacher` may be declared at signup, on the operator's explicit
// decision. That is safe because a declared role carries no access on its own:
// every cross-account read in the rules is gated on an operator-written record —
// class membership, a `parentLinks` document, or the `teacherUids` mirror. So
// what these checks enforce is not "no privileged role may be chosen" but the two
// properties that keep that true:
//
//   1. `admin` is never selectable, because it is a token claim and no role value
//      can confer it.
//   2. Neither path trusts the picker. Both re-validate against the allowlist
//      before writing, because this is component state and a console can move it.
//
// The live proof that a declared role is inert is in `npm run rules:matrix` —
// "self-declared teacher reads a learner profile" and its siblings all deny.

check('admin is not self-selectable at signup',
  !SELF_REGISTERABLE_ROLES.includes('admin') &&
  new Set(SELF_REGISTERABLE_ROLES).size === SELF_REGISTERABLE_ROLES.length,
  `SELF_REGISTERABLE_ROLES = [${SELF_REGISTERABLE_ROLES.join(', ')}]`)

check('the self-registerable roles are the three declarable ones',
  [...SELF_REGISTERABLE_ROLES].sort().join(',') === 'learner,parent,teacher',
  `SELF_REGISTERABLE_ROLES = [${SELF_REGISTERABLE_ROLES.join(', ')}]`)

// The rule that admits a declared role. It must go through `isKnownRole`, which
// omits `admin`, and must not name any role literally in a way that would admit a
// fourth. `admin` as a value is checked separately, against the union type.
const profileCreate = /allow create: if isSelf\(uid\)[\s\S]*?;/.exec(rulesText)?.[0] ?? ''
check('the profile create rule admits declared roles via isKnownRole',
  /isKnownRole\(request\.resource\.data\.role\)/.test(profileCreate) &&
  !/role == 'admin'/.test(profileCreate) &&
  !/role == 'teacher'/.test(profileCreate),
  profileCreate.replace(/\s+/g, ' ').trim())

// `grade` means something only for a learner. Without this, a parent profile
// could carry a grade and imply an enrolment that does not exist.
//
// Both branches must be present, and their polarity is what this asserts. A
// previous version only grepped for the substring `role != 'learner'`, which the
// unenforced form `role != 'learner' || grade is int || grade == null` also
// contains — that expression short-circuits on the first disjunct for every
// non-learner and leaves grade completely unrestricted, so the check passed
// against a rule that enforced nothing.
const flattenedCreate = profileCreate.replace(/\s+/g, ' ')
check('the profile create rule scopes grade to learners in both branches',
  /role == 'learner'\s*&&\s*request\.resource\.data\.grade is int/.test(flattenedCreate)
  && /role != 'learner'\s*&&\s*request\.resource\.data\.grade == null/.test(flattenedCreate)
  // The unenforced shape short-circuits: `A || B || C` must not be a top-level
  // operator anywhere in the grade condition.
  && !/grade is int \|\|/.test(flattenedCreate),
  flattenedCreate.slice(0, 220))

// A picker exists, but it renders from the shared allowlist rather than a
// hard-coded list, so the form cannot drift from what the rules accept. Drift
// here presents as a permission-denied at signup, which is a bad way to find out.
check('the role picker is driven by the shared allowlist',
  /role="radiogroup"/.test(loginPageText) &&
  /ROLES\.filter\(r => isSelfRegisterable\(r\.id\)\)/.test(loginPageText),
  (/\.filter\(r => isSelfRegisterable[^)]*\)/.exec(loginPageText)?.[0] ?? 'no isSelfRegisterable filter').trim())

// Both profile-creating paths — the register form and the "finish setting up"
// recovery screen for a credential with no profile — re-check the value. A single
// unchecked path would be enough to let a console-set state through, and the
// recovery screen is the one people forget is reachable.
check('both profile-creating paths re-validate the declared role',
  (loginPageText.match(/if \(!isSelfRegisterable\(role\)\)/g) ?? []).length >= 2,
  `${(loginPageText.match(/if \(!isSelfRegisterable\(role\)\)/g) ?? []).length} validations found`)

check('a non-learner never submits a grade',
  (loginPageText.match(/role === 'learner' \? grade : null/g) ?? []).length >= 2,
  `${(loginPageText.match(/role === 'learner' \? grade : null/g) ?? []).length} grade guards found`)

check('the privileged roles are still grantable by an operator',
  provisionText.includes('setrole') && /npm run provision -- setrole|setrole <uid>/.test(provisionText))

// `scripts/provision.ts` cannot import from `src` (its standalone tsc invocation
// has no path alias), so it redeclares the role list. That duplication is only
// safe while the two agree.
const appRoles = ROLE_OPTIONS.map(r => r.id).sort()
const provisionRoles = (KNOWN_ROLES_CONST.match(/'([a-z]+)'/g) ?? []).map(s => s.replace(/'/g, '')).sort()
check('the provisioning script and the app agree on the role list',
  appRoles.join(',') === provisionRoles.join(','),
  `app: [${appRoles.join(', ')}] provision: [${provisionRoles.join(', ')}]`)

// ── Operator access ─────────────────────────────────────────────────────────
//
// Admin is a custom claim on the ID token, not a `UserRole` and not a Firestore
// field. These check the properties that make that worth trusting, each of which
// is a way the design could quietly collapse into "the client asked nicely".
//
// The load-bearing one is the first: if `isAdmin()` ever read anything the
// browser can write, the claim would be decorative and every check after it
// would be asserting the security of a fiction.

const isAdminFn = /function isAdmin\(\) \{([\s\S]*?)\n    \}/.exec(rulesText)?.[1] ?? ''

check('operator access is decided by the token claim alone',
  /request\.auth\.token\.admin == true/.test(isAdminFn) &&
  // No `get(`, no path variable, no profile field. Any of those would be a way
  // for the client to influence the answer.
  !/get\(|myUid\(|userDoc|data\./.test(isAdminFn),
  isAdminFn.trim())

check('admin is not a value of the role union',
  !/'admin'/.test(typesText) && !/'admin'/.test(isKnownRoleText),
  'admin must stay orthogonal to UserRole, so an operator keeps their own portal')

check('the rules reject admin as a written role',
  !/role == 'admin'/.test(isKnownRoleText) && !/isKnownRole\([^)]*admin/.test(rulesText))

// The client reads the claim rather than inferring it. The `force = true` default
// matters as much as the read: Firebase caches the ID token for about an hour, so
// without the refresh a freshly-granted claim shows no portal until the token
// happens to expire, and the grant looks broken.
check('the client reads the admin claim from the token, forcing a refresh',
  /getIdTokenResult\(force\)/.test(authLibText) &&
  /claims\.admin === true/.test(authLibText) &&
  /force = true/.test(authLibText),
  authLibText.match(/force = true/)?.[0] ?? 'no forced claim refresh')

check('the claim is cleared on sign-out',
  /setIsAdmin\(false\)/.test(authStoreText) &&
  (authStoreText.match(/setIsAdmin\(false\)/g) ?? []).length >= 2,
  'a shared device must not hand the next account the previous one’s powers')

check('the admin portal is gated on the claim, not on a role',
  /export function RequireAdmin/.test(guardsText) && /\bisAdmin\b/.test(guardsText))

check('every admin route sits behind RequireAdmin',
  /createElement\(RequireAdmin/.test(routesText) &&
  (routesText.match(/Component: adminRoot/g) ?? []).length >= 1,
  routesText.match(/createElement\(RequireAdmin[^)]*\)/)?.[0] ?? 'no admin guard')

// The claim must be mintable from somewhere, or the portal is unreachable — and
// it must be mintable only from the operator script, since no browser call can
// set a custom claim.
check('the operator script can grant the admin claim',
  /setCustomUserClaims/.test(provisionText) && /setAdmin/.test(provisionText),
  provisionText.match(/setCustomUserClaims\([^)]*\)/)?.[0] ?? 'no claim grant')

check('no browser code can mint a custom claim',
  !/setCustomUserClaims/.test(storeText) && !/setCustomUserClaims/.test(authLibText) &&
  !/setCustomUserClaims/.test(routesText),
  'setCustomUserClaims must not appear in the client')

// Every portal page used to be imported eagerly, so a learner downloaded the teacher
// quiz builder and the operator console in the first bundle. The split is easy to
// undo by adding one import line, and the build only warns about it, so the shape is
// pinned here instead.
// `LoginPage` is deliberately eager: it is the first paint when the app is
// unconfigured or signed out, so splitting it would only put a chunk fetch in front
// of the form. Everything behind a role guard is split.
const EAGER_ROUTE_PAGES = new Set(['LoginPage'])
const eagerPageImports = [...routesText.matchAll(/^import\s+(\w+)\s+from\s+'@\/pages\//gm)]
  .map(m => m[1])
  .filter(name => !EAGER_ROUTE_PAGES.has(name))
const routedPages = [...routesText.matchAll(/lazyPage\(\(\)\s*=>\s*import\('@\/pages\/([^']+)'\)\)/g)]
  .map(m => m[1])
check('no page behind a guard is imported eagerly by the router', eagerPageImports.length === 0,
  eagerPageImports)
check('the router still loads the login page eagerly', /import\s+LoginPage\s+from/.test(routesText),
  'LoginPage must render without waiting on a chunk')
check('every routed page is code-split', routedPages.length >= 20, routedPages.length)
check('each portal still routes every page it declares',
  (() => {
    const declared = [...routesText.matchAll(/Component:\s*(\w+)\s*[,}]/g)].map(m => m[1])
    const shellPages = new Set(['learnerRoot', 'parentRoot', 'teacherRoot', 'adminRoot',
      'Entry', 'ParentLayout', 'TeacherLayout', 'AdminLayout'])
    return declared.filter(d => !shellPages.has(d))
      .every(d => new RegExp(`const ${d}\\s*=\\s*lazyPage\\(`).test(routesText))
  })(),
  [...routesText.matchAll(/Component:\s*(\w+)\s*[,}]/g)].map(m => m[1]))

// The whole-collection reads the dashboard depends on are only authorisable
// because `isAdmin()` binds no path variable. A future refactor to
// `collectionGroup('members')` would be silently rejected at runtime, exactly as
// `readEnrolledClasses` was — so it is asserted rather than discovered.
//
// Comments are stripped first. The operator-queries section documents *why*
// `collectionGroup` is absent, and a check that flagged that documentation would
// be an argument for deleting the explanation.
const operatorQueriesAt = storeText.indexOf('// ── Operator queries')
// If this marker ever stops matching, `slice(-1)` would hand the checks below a
// one-character string and they would pass for the wrong reason. A missing
// marker is a failure, not an empty section.
check('the operator-queries section marker still matches',
  operatorQueriesAt > 0,
  `indexOf returned ${operatorQueriesAt}`)

const operatorQueries = storeText.slice(operatorQueriesAt)
const operatorCode = operatorQueries.replace(/\/\/[^\n]*/g, '')

check('the admin queries are whole-collection reads the claim can authorise',
  /listProfiles/.test(storeText) && /getDocs\(sub\(paths\.users\(\)\)\)/.test(storeText) &&
  /getDocs\(sub\(paths\.classes\(\)\)\)/.test(storeText) && /getDocs\(sub\('parentLinks'\)\)/.test(storeText))

check('no admin query reaches a subcollection the rules cannot list',
  !/collectionGroup/.test(operatorCode),
  'collectionGroup on members is denied for every caller, including an admin')

// Role changes stay off the client, permanently — and the reason is the rules,
// not a convention anyone has to remember. `users/{uid}` update goes to the
// account itself with an allowlist that omits `role`, and no `isAdmin()`
// disjunct, so *no* browser — operator's included — can promote anyone.
// `provision setrole` is the only path that works.
//
// This replaces an earlier version of this check that grepped the client for
// writes to a `role` field. That was weaker than it looked and measurably so:
// mutating a helper to build `{ ...patch, role: 'teacher' }` passed, because the
// text `role` sits on a different line from the `setDoc` that persists it, and no
// amount of grepping fixes that. The rules cannot be argued with this way.
// The check is "no update rule can write `role`", not "no update rule mentions
// isAdmin". An operator update rule now exists — the one that maintains the
// `teacherUids` mirror when a learner is enrolled through the admin portal — so
// grepping for `isAdmin` in any update rule fails a rule that is safe. What has
// to stay true is narrower and is asserted directly: `role` appears in no
// writable-keys list, and the only admin update is scoped to `teacherUids` alone.
const profileUpdateRules = userBlock.match(/allow update:[\s\S]*?;/g) ?? []
const writableLists = profileUpdateRules.flatMap(rule => rule.match(/hasOnly\(\[([^\]]*)\]\)/g) ?? [])
const listsRole = writableLists.some(list => /(^|[^a-zA-Z])'role'/.test(list))
const adminUpdateRules = profileUpdateRules.filter(rule => /isAdmin\(\)/.test(rule))
const adminUpdateIsMirrorOnly = adminUpdateRules.every(
  rule => /hasOnly\(\['teacherUids'\]\)/.test(rule) && !/lists/.test(rule),
)

check('no rule lets any client promote an account by changing its role',
  profileUpdateRules.length > 0 && !listsRole && adminUpdateIsMirrorOnly,
  profileUpdateRules.map(r => r.replace(/\s+/g, ' ').slice(0, 90)).join(' | '))

// The `teacherUids` mirror is the only thing that grants a teacher access to a
// learner's data, and it must stay operator-written.
//
// A teacher branch was tried here and looked constrained: it allowed a write only
// when `teacherUids.removeAll([myUid()])` matched on both sides, proving the caller
// changed nothing but their own entry. It does not prove that — the comparison is
// made *after* removing the caller, so a teacher writing `[myUid()]` onto any
// profile passes it. They can grant themselves access to a learner they were never
// enrolled to teach, and the comparison constrains which other entries may change,
// never which document may be written.
//
// There is no way to close this within a `users/{uid}` rule: "is this learner in a
// class I teach?" is a query over `classes/{classId}/members`, and rules evaluate
// one document at a time with no way to enumerate the caller's classes. So the
// invariant is asserted instead of approximated.
const mirrorRule = profileUpdateRules.find(r => /hasOnly\(\['teacherUids'\]\)/.test(r)) ?? ''
check('the teacherUids mirror has an update rule', mirrorRule !== '', 'no mirror rule found')
check('only an operator may write the teacherUids mirror',
  mirrorRule !== '' && /isAdmin\(\)/.test(mirrorRule)
  && !/myRole\(\)/.test(mirrorRule) && !/isClassTeacher\(\)/.test(mirrorRule),
  mirrorRule.replace(/\s+/g, ' ').slice(0, 120))
check('no profile update rule lets a teacher write teacherUids',
  !profileUpdateRules.some(rule =>
    /teacherUids/.test(rule) && /myRole\(\)|isClassTeacher\(\)/.test(rule)),
  profileUpdateRules.filter(rule => /teacherUids/.test(rule))
    .map(r => r.replace(/\s+/g, ' ').slice(0, 90)).join(' | '))

// Enrolment is what maintains the mirror, so creating a membership is admin-only.
// A class teacher may still correct an existing enrolment's display name or role,
// which touches no mirror and grants nothing.
const memberBlock = /match \/members\/\{memberUid\} \{[\s\S]*?\n {6}\}/.exec(userBlock)?.[0]
  ?? /match \/members\/\{memberUid\} \{[\s\S]*?\n\s{6}\}/.exec(rulesText)?.[0] ?? ''
const memberCreate = /allow create:[^;]*;/.exec(memberBlock)?.[0] ?? ''
const memberDelete = /allow delete:[^;]*;/.exec(memberBlock)?.[0] ?? ''
check('creating a class enrolment requires the admin claim',
  /isAdmin\(\)/.test(memberCreate) && !/isClassTeacher\(\)/.test(memberCreate),
  memberCreate.replace(/\s+/g, ' '))
check('removing a class enrolment requires the admin claim',
  /isAdmin\(\)/.test(memberDelete) && !/isClassTeacher\(\)/.test(memberDelete),
  memberDelete.replace(/\s+/g, ' '))
// The enrolment and the mirror are written in one batch, so a batch where either
// half is refused must not silently land the other.
check('enrolment writes the membership and the mirror together',
  /batch\.set\(ref\(paths\.classMember/.test(storeText)
  && /teacherUids: arrayUnion/.test(storeText)
  && /await batch\.commit\(\)/.test(storeText),
  'addMember must batch the membership with the teacherUids mirror')

check('the people tab routes role changes to the operator script',
  /npm run provision -- setrole/.test(
    readFileSync(new URL('../src/pages/admin/AdminPeoplePage.tsx', import.meta.url), 'utf8'),
  ) && !/\bupdateDoc\b/.test(adminPagesText),
  'role promotion must stay on `provision setrole`')

// Named, and counted. `npm test` chains this script after `check-parser.ts`, and
// when both printed an identical bare "ALL CHECKS PASSED" a reader could see that
// line, stop reading, and miss a failure from the other script — which is how a
// green-looking run can hide a red one. The script name and the number of
// assertions make the tail of `npm test` say which verdict it is and how much
// was actually verified.
console.log(
  failures === 0
    ? `\ncheck-data: all ${checksRun} checks passed`
    : `\ncheck-data: ${failures} of ${checksRun} checks FAILED`,
)
process.exitCode = failures === 0 ? 0 : 1

import type { Question } from '../types'
import { LESSONS_TERM1 } from './lessonsTerm1'
import { LESSONS_TERM2 } from './lessonsTerm2'
import { LESSONS_TERM3 } from './lessonsTerm3'
import { MATH_GUIDE_QUESTIONS_1_4 } from './questions1to4'
import { MATH_GUIDE_QUESTIONS_5_8 } from './questions5to8'
import { MATH_GUIDE_QUESTIONS_9_11 } from './questions9to11'
import { MATH_PRACTICE_QUESTIONS } from './practiceExtensions'

export * from './questionBuilder'
export * from './modules'

/** The eleven Grade 10 Mathematics modules, in guide order. */
export const LESSONS = [...LESSONS_TERM1, ...LESSONS_TERM2, ...LESSONS_TERM3]

/** All 165 questions converted from the study guide, in module order. */
export const MATH_GUIDE_QUESTIONS: Question[] = [
  ...MATH_GUIDE_QUESTIONS_1_4,
  ...MATH_GUIDE_QUESTIONS_5_8,
  ...MATH_GUIDE_QUESTIONS_9_11,
].flat()

/** Questions belonging to one module, in the guide's Easy → Medium → Hard order. */
export const moduleQuestions = (moduleNumber: number): Question[] =>
  MATH_GUIDE_QUESTIONS.filter(q => q.moduleNumber === moduleNumber)

/** The ten questions the guide puts in each module diagnostic. */
export const moduleDiagnosticQuestions = (moduleNumber: number): Question[] =>
  moduleQuestions(moduleNumber).filter(q => q.diagnostic)

/** The five questions held back from the diagnostic, for equivalent mini-tests. */
export const moduleReserveQuestions = (moduleNumber: number): Question[] =>
  moduleQuestions(moduleNumber).filter(q => !q.diagnostic)

/** Looks up a lesson by the module number printed in the guide. */
export const lessonForModule = (moduleNumber: number) =>
  LESSONS.find(l => l.moduleNumber === moduleNumber)

/** Looks up the lesson that teaches a given skill. */
export const lessonForSkill = (skillId: string) =>
  LESSONS.find(l => l.concepts.some(c => c.skillId === skillId) ||
    l.workedExamples.some(w => w.skillId === skillId))

/** Every mathematics question, guide bank plus practice extensions. */
export const ALL_MATH_QUESTIONS: Question[] = [
  ...MATH_GUIDE_QUESTIONS,
  ...MATH_PRACTICE_QUESTIONS,
]

/** The questions a learner can drill for one weak skill. */
export const questionsForSkill = (skillId: string): Question[] =>
  ALL_MATH_QUESTIONS.filter(q => q.skillId === skillId)

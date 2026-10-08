import type { Difficulty, Question } from '../types'
import { moduleTopicId } from './modules'

/** Attribution for every question converted from the study guide. */
export const GUIDE_SOURCE = 'BrainyBox Grade 10 Mathematics Study Guide'

/**
 * The guide scores each diagnostic question as 1 mark and notes that an app
 * could award method marks separately. Every guide question is therefore 1 mark.
 */
const GUIDE_MARKS = 1

export interface GuideQuestion {
  /** Position in the module, e.g. 'E1' (Easy 1), 'H3' (Hard 3). */
  slot: string
  skillId: string
  difficulty: Difficulty
  text: string
  /**
   * Acceptable answers in caret form for powers: write x^2, not x2. The quiz
   * runner folds unicode superscripts and space-free typing onto the same form.
   */
  accepted: string[]
  /** The answer key's working, shown after the learner answers. */
  explanation: string
  /** Whether the guide includes this question in the module diagnostic. */
  diagnostic: boolean
}

/**
 * Converts one module's guide questions into `Question` records.
 *
 * Ids are derived from the module number and the guide's own slot labels
 * (`m7-h3`) so they stay stable, readable and unique across the whole bank.
 */
export function buildModuleQuestions(
  moduleNumber: number,
  questions: GuideQuestion[],
): Question[] {
  return questions.map(g => ({
    id: `m${moduleNumber}-${g.slot.toLowerCase()}`,
    subjectId: 'mathematics' as const,
    // `index.ts` re-derives this from the skill; setting it here too means the
    // bank is self-consistent before that pass runs.
    topicId: moduleTopicId(moduleNumber),
    skillId: g.skillId,
    type: 'short' as const,
    difficulty: g.difficulty,
    text: g.text,
    options: [],
    correct: -1,
    accepted: g.accepted,
    explanation: g.explanation,
    marks: GUIDE_MARKS,
    source: GUIDE_SOURCE,
    moduleNumber,
    diagnostic: g.diagnostic,
  }))
}

// ── Practice extensions ─────────────────────────────────────────────────────
// The guide assesses 15 questions per module, which leaves a handful of its own
// key-vocabulary skills with nothing to practise and several with only one
// question. A learner whose weak area is "Algebraic language" has to be able to
// drill it, so those skills get extra questions written here.
//
// These are deliberately *not* part of the guide bank: they carry no
// `moduleNumber` and no diagnostic flag, so the guide's per-module counts, its
// diagnostics and the mock exam stay exactly as published.
export const PRACTICE_SOURCE = 'BrainyBox practice extension'

export interface PracticeQuestion {
  /** Stable id fragment, e.g. 'alglang-1'. Ids become `x-m1-alglang-1`. */
  slot: string
  skillId: string
  /** Used only to resolve the topic id; not stored on the question. */
  moduleNumber: number
  difficulty: Difficulty
  text: string
  /** Acceptable answers for a short-answer question. */
  accepted?: string[]
  /** Options for a multiple-choice question. */
  options?: string[]
  /** Index into `options`. */
  correct?: number
  explanation: string
}

export function buildPracticeQuestions(
  moduleNumber: number,
  questions: PracticeQuestion[],
): Question[] {
  return questions.map(p => ({
    id: `x-m${moduleNumber}-${p.slot}`,
    subjectId: 'mathematics' as const,
    topicId: moduleTopicId(moduleNumber),
    skillId: p.skillId,
    type: p.options ? ('mcq' as const) : ('short' as const),
    difficulty: p.difficulty,
    text: p.text,
    options: p.options ?? [],
    correct: p.options ? (p.correct ?? 0) : -1,
    accepted: p.accepted ?? [],
    explanation: p.explanation,
    marks: GUIDE_MARKS,
    source: PRACTICE_SOURCE,
  }))
}

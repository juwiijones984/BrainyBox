import { importTopicId, topicName } from '@/data'
import type { Difficulty, Question, QuestionType, SubjectId } from '@/data'

// ── Result shapes ──────────────────────────────────────────────────────────
export interface ImportIssue {
  /** 1-based row number in the source file, or 0 when not row-scoped. */
  row: number
  message: string
  /** The offending value, truncated for display. */
  value?: string
}

/**
 * Where an imported bank is going.
 *
 * Required, because a question's `subjectId` and `topicId` cannot be derived from
 * the file alone: the same CSV imported into two subjects is two different sets of
 * questions. The parser used to hardcode `subjectId: 'mathematics'` and leave
 * `topicId` empty, leaving the store to overwrite one and quietly not fix the
 * other — so every imported question landed on an unresolvable topic.
 */
export interface ImportContext {
  subjectId: SubjectId
  /** Topic the teacher tagged the bank with, if any. */
  topicName?: string
}

export interface ImportResult {
  questions: Question[]
  issues: ImportIssue[]
  /** Columns the parser recognised but could not use. */
  ignoredColumns: string[]
}

// ── CSV parsing ────────────────────────────────────────────────────────────
/**
 * RFC 4180 parser: handles quoted fields, embedded commas, doubled quotes and
 * newlines inside quotes. Excel exports are the usual source for a school
 * question bank, so this needs to be correct rather than a `split(',')`.
 */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  const text = input.replace(/^﻿/, '')

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()
    // Ignore trailing blank lines produced by a final newline.
    if (row.length > 1 || row[0] !== '') rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      endField()
    } else if (char === '\r') {
      // Swallow; the \n handler ends the row.
    } else if (char === '\n') {
      endRow()
    } else {
      field += char
    }
  }

  if (field !== '' || row.length) endRow()
  return rows
}

// ── Header mapping ─────────────────────────────────────────────────────────
const COLUMN_ALIASES: Record<string, string[]> = {
  text: ['question', 'questions', 'text', 'prompt', 'stem', 'question text', 'instruction'],
  // The lettered columns must be matched before the catch-all `options` alias,
  // otherwise a plain "a"/"b" header is swallowed as a single options cell.
  optionA: ['a', 'optiona', 'option a', 'a)', 'choicea', 'choice a', 'first'],
  optionB: ['b', 'optionb', 'option b', 'b)', 'choiceb', 'choice b', 'second'],
  optionC: ['c', 'optionc', 'option c', 'c)', 'choicec', 'choice c', 'third'],
  optionD: ['d', 'optiond', 'option d', 'd)', 'choiced', 'choice d', 'fourth'],
  optionE: ['e', 'optione', 'option e', 'e)', 'choicee', 'choice e', 'fifth'],
  optionF: ['f', 'optionf', 'option f', 'f)', 'choicef', 'choice f', 'sixth'],
  options: ['option', 'options', 'choices', 'answers'],
  answer: ['answer', 'correctanswer', 'correct answer', 'answer key', 'key'],
  // The app's own JSON export field. Its name is unambiguous — `correct` has
  // always been a 0-based index in `Question` — so it does not need an answer-base
  // column, whereas a teacher's `answer` column does. Letting `correct` match the
  // `answer` aliases made the app unable to re-import its own exports.
  correctIndex: ['correct'],
  // Disambiguates a numeric key. Without it a bare `2` cannot be told apart from
  // "the second option" written 1-based and "index 2" written 0-based, and the
  // two differ by one option — so the guess silently marked the wrong answer.
  answerBase: ['answerbase', 'answer base', 'keybase', 'key base', 'optionbase', 'option base', 'indexbase'],
  accepted: ['accepted', 'accept', 'alternate', 'also accept', 'acceptable'],
  explanation: ['explanation', 'rationale', 'reason', 'feedback', 'solution notes', 'why', 'notes'],
  marks: ['marks', 'mark', 'points', 'point', 'weight'],
  difficulty: ['difficulty', 'level', 'tier', 'complexity'],
  type: ['type', 'format', 'question type', 'kind'],
  topic: ['topic', 'unit', 'chapter', 'strand', 'theme'],
  skill: ['skill', 'skillid', 'skill id', 'skill name', 'subtopic', 'outcome'],
  subject: ['subject', 'learner subject'],
  source: ['source', 'paper', 'reference', 'origin', 'textbook'],
  year: ['year', 'yr', 'exam year'],
  hint: ['hint', 'tip', 'memory aid'],
}

type Field = keyof typeof COLUMN_ALIASES

/** Order matters: specific fields claim a column before generic ones. */
const MATCH_ORDER: Field[] = [
  'text',
  'optionA', 'optionB', 'optionC', 'optionD', 'optionE', 'optionF',
  'options',
  'answer', 'correctIndex', 'answerBase', 'accepted', 'explanation', 'marks', 'difficulty',
  'type', 'topic', 'skill', 'subject', 'source', 'year', 'hint',
]

const normaliseHeader = (value: string) => value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')

function buildHeaderMap(headers: string[]): Map<number, Field> {
  const map = new Map<number, Field>()
  headers.forEach((header, index) => {
    const key = normaliseHeader(header)
    if (!key) return
    for (const field of MATCH_ORDER) {
      if (COLUMN_ALIASES[field].some(alias => normaliseHeader(alias) === key)) {
        // First match wins so `question` never gets stolen by `answers`.
        if (![...map.values()].includes(field)) map.set(index, field)
        break
      }
    }
  })
  return map
}

// ── Value coercion ─────────────────────────────────────────────────────────
const DIFFICULTY_MAP: Record<string, Difficulty> = {
  easy: 'easy', foundational: 'easy', basic: 'easy', '1': 'easy', low: 'easy', introductory: 'easy',
  medium: 'medium', moderate: 'medium', intermediate: 'medium', '2': 'medium', standard: 'medium',
  hard: 'hard', difficult: 'hard', advanced: 'hard', challenging: 'hard', '3': 'hard', high: 'hard',
}

const TYPE_MAP: Record<string, QuestionType> = {
  mcq: 'mcq', 'multiple choice': 'mcq', multiplechoice: 'mcq', choice: 'mcq',
  'true/false': 'true-false', 'true-false': 'true-false', 'true false': 'true-false',
  truefalse: 'true-false', boolean: 'true-false', tf: 'true-false',
  short: 'short', 'short answer': 'short', written: 'short', essay: 'short', subjective: 'short',
}

function coerceDifficulty(raw: string | undefined): Difficulty {
  if (!raw) return 'medium'
  return DIFFICULTY_MAP[normaliseHeader(raw)] ?? 'medium'
}

function coerceType(raw: string | undefined, optionCount: number): QuestionType {
  if (raw) {
    const hit = TYPE_MAP[normaliseHeader(raw)]
    if (hit) return hit
  }
  if (optionCount === 0) return 'short'
  if (optionCount === 2) return 'mcq'
  return 'mcq'
}

function coerceMarks(raw: string | undefined): number {
  const value = Number.parseFloat(raw ?? '')
  return Number.isFinite(value) && value > 0 ? value : 2
}

/**
 * How a numeric answer key should be read.
 *
 * `1` means the second option, `0` means index 2. Spreadsheets use both and the
 * two readings differ by a whole option, so a guess cannot be made: a key of `2`
 * with four options marked the third option under one reading and the second
 * under the other, and nothing in the file said which was meant.
 */
type AnswerBase = 0 | 1 | 'auto'

const ANSWER_BASE_VALUES: Record<string, AnswerBase> = {
  '1': 1, 'one': 1, 'one based': 1, 'first': 1, 'letter': 1,
  '0': 0, 'zero': 0, 'zero based': 0, 'index': 0,
}

/**
 * Resolve the answer to an option index. Accepts a letter (A–F), a numeric index,
 * or the answer text itself — spreadsheets in the wild use all three.
 *
 * `base` is `'auto'` when the file did not say. A letter key and a text key need
 * no base. A numeric key does: under `'auto'`, a value that is in range for only
 * one reading is resolved, a value in range for both is ambiguous and returns
 * `null`, and a value out of range for both falls through to matching the option
 * text — which is how an answer of `13` selects the option "13". The caller turns
 * `null` into an issue the teacher sees, which is the only honest outcome when two
 * different options are equally plausible.
 */
function resolveCorrectIndex(
  raw: string,
  options: string[],
  base: AnswerBase = 'auto',
): number | null {
  const value = raw.trim()
  if (!value) return null

  if (/^[a-fA-F]$/.test(value)) {
    const index = value.toUpperCase().charCodeAt(0) - 65
    return index < options.length ? index : null
  }

  if (/^\d+$/.test(value)) {
    const numeric = Number(value)
    if (base === 1) return numeric >= 1 && numeric <= options.length ? numeric - 1 : null
    if (base === 0) return numeric >= 0 && numeric < options.length ? numeric : null
    // 'auto': only one reading in range means only one possible answer.
    const zeroBased = numeric >= 0 && numeric < options.length
    const oneBased = numeric >= 1 && numeric <= options.length
    if (zeroBased !== oneBased) return zeroBased ? numeric : numeric - 1
    // Both readings fit, or neither does. If neither, the cell most likely holds
    // option text that happens to be a number, so fall through and match it as
    // text; if both, there is no answer to infer and the caller must ask.
    if (zeroBased) return null
  }

  const match = options.findIndex(
    option => normaliseHeader(option) === normaliseHeader(value),
  )
  return match >= 0 ? match : null
}

function coerceAnswerBase(raw: string | undefined): AnswerBase {
  if (!raw) return 'auto'
  return ANSWER_BASE_VALUES[normaliseHeader(raw)] ?? 'auto'
}

/**
 * Split a single cell holding several options.
 *
 * `|`, `;`, newline and `,` all separate. The comma is what an Excel export of
 * "9,13,21" in one cell means, and the CSV layer strips that cell's quotes before
 * we get here — which is why the inner quote tracking below only matters for a
 * delimiter that reached us through a nested field, e.g. the JSON path where
 * `options` arrives as a pre-joined string.
 *
 * The docstring here used to promise comma-delimited options while the regex split
 * on `|` and `;` alone, so such a cell arrived as one option named "9,13,21" and
 * every answer letter in that column pointed at the wrong thing.
 */
function splitOptions(raw: string): string[] {
  const options: string[] = []
  let field = ''
  let inQuotes = false

  const push = () => {
    const trimmed = field.trim()
    if (trimmed) options.push(trimmed)
    field = ''
  }

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i]
    if (inQuotes) {
      if (char === '"') {
        if (raw[i + 1] === '"') { field += '"'; i++ } else { inQuotes = false }
      } else field += char
      continue
    }
    if (char === '"') inQuotes = true
    else if (char === '|' || char === ';' || char === ',' || char === '\n') push()
    else field += char
  }
  push()
  return options
}

/** Split a single cell holding several accepted answers: "yes|true|affirmative". */
function splitAccepted(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/\s*[|;]\s*/)
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)
}

// ── Row → Question ─────────────────────────────────────────────────────────
interface RowCells {
  row: number
  cell: (field: Field) => string
}

function buildQuestion(
  { row, cell }: RowCells,
  issues: ImportIssue[],
  index: number,
  context: ImportContext,
): Question | null {
  const text = cell('text').trim()
  if (!text) {
    issues.push({ row, message: 'Skipped: no question text in the "question" column.' })
    return null
  }

  // Options may be spread across A–F columns or held in one delimited cell.
  const lettered = (['optionA', 'optionB', 'optionC', 'optionD', 'optionE', 'optionF'] as const)
    .map(field => cell(field).trim())
    .filter(Boolean)
  const single = cell('options').trim()
  let options = lettered.length >= 2 ? lettered : splitOptions(single)

  const type = coerceType(cell('type'), options.length)

  // A `correct` column is the app's own 0-based index and needs no base; an
  // `answer` column is a teacher's key and does. Keeping them apart is what lets
  // `parseJsonBank` read back a `questionsToCsv`-style export without an
  // answer-base column, while still refusing to guess on a spreadsheet.
  const correctIndexRaw = cell('correctIndex')
  const answerRaw = correctIndexRaw || cell('answer')
  const answerBase: AnswerBase = correctIndexRaw ? 0 : coerceAnswerBase(cell('answerBase'))

  let correct = -1
  let accepted: string[] = []

  if (type === 'short') {
    accepted = splitAccepted(cell('accepted') || answerRaw)
    if (!accepted.length) {
      issues.push({
        row,
        message: 'Short-answer question has no answer. Add an "answer" or "accepted" value.',
        value: answerRaw,
      })
      return null
    }
  } else if (type === 'true-false') {
    // The runner renders options, so a true/false question needs its pair even
    // when the source row has no option columns.
    options = ['True', 'False']
    const truthy = ['true', 'yes', 't', 'y', '1']
    const falsy = ['false', 'no', 'f', 'n', '0']
    const value = normaliseHeader(answerRaw)
    if (truthy.includes(value)) correct = 0
    else if (falsy.includes(value)) correct = 1
    else {
      const resolved = resolveCorrectIndex(answerRaw, ['True', 'False'])
      if (resolved === null) {
        issues.push({ row, message: 'Could not read the true/false answer.', value: answerRaw })
        return null
      }
      correct = resolved
      // A true/false pair is indexed 0 and 1, so a numeric key here is read
      // 1-based like a letter — "1" cannot mean "index 1" for a question whose
      // only options are True and False without ambiguity about intent.
    }
  } else {
    if (options.length < 2) {
      issues.push({
        row,
        message: 'Multiple-choice question needs at least two options.',
        value: options.join(' | ') || '(none found)',
      })
      return null
    }
    const resolved = resolveCorrectIndex(answerRaw, options, answerBase)
    if (resolved === null) {
      // A bare in-range number is the one case where two different options are
      // equally plausible, so it gets its own message: telling the teacher to add
      // an "answer base" column is actionable, where "could not match" is not.
      const ambiguous = /^\d+$/.test(answerRaw.trim())
        && answerBase === 'auto'
        && Number(answerRaw) >= 0
        && Number(answerRaw) < options.length
      issues.push({
        row,
        message: ambiguous
          ? 'The answer is a bare number, which could be an option position or a 0-based index. '
            + 'Add an "answer base" column set to 1 for "B is the second option", or write the letter B.'
          : 'Could not match the answer to any option.',
        value: answerRaw || '(blank)',
      })
      return null
    }
    correct = resolved
  }

  const skillName = cell('skill').trim()
  // The row's own topic wins: a bank can carry several topics even when the
  // teacher only named one subject-level bucket for it.
  const rowTopic = cell('topic').trim() || context.topicName || ''

  // The file may name a subject per row, but the target subject is chosen once and
  // governs the whole import — the skill and topic ids are minted for it. The
  // column used to be recognised and then dropped without comment, so a bank
  // imported into the wrong subject looked clean. Report the disagreement instead.
  const declared = cell('subject').trim().toLowerCase()
  if (declared && declared !== context.subjectId) {
    issues.push({
      row,
      message: `Row names subject "${cell('subject').trim()}" but the import target is `
        + `"${context.subjectId}". The row was imported under the target.`,
      value: declared,
    })
  }

  return {
    id: `imp-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    subjectId: context.subjectId,
    // A real topic id when the name is in the curriculum, the documented sentinel
    // otherwise. Never `''`: an unresolvable topic id is what made imported
    // questions invisible to every per-topic average and breakdown.
    topicId: importTopicId(context.subjectId, rowTopic),
    skillId: skillName,
    type,
    difficulty: coerceDifficulty(cell('difficulty')),
    text,
    options,
    correct,
    accepted,
    explanation: cell('explanation').trim(),
    marks: coerceMarks(cell('marks')),
    source: cell('source').trim() || undefined,
    year: (() => {
      const year = Number.parseInt(cell('year'), 10)
      return Number.isFinite(year) ? year : undefined
    })(),
  }
}

// ── File entry points ──────────────────────────────────────────────────────
export function isJsonFile(fileName: string): boolean {
  return /\.json$/i.test(fileName)
}

export function parseJsonBank(input: string, context: ImportContext): ImportResult {
  const issues: ImportIssue[] = []

  let payload: unknown
  try {
    payload = JSON.parse(input)
  } catch (error) {
    return {
      questions: [],
      issues: [{ row: 0, message: `The file is not valid JSON. ${(error as Error).message}` }],
      ignoredColumns: [],
    }
  }

  // Accept a bare array, or an object wrapping the array under any of the
  // usual keys.
  const rows: unknown[] = Array.isArray(payload)
    ? payload
    : ((payload as Record<string, unknown> | null)?.questions ??
       (payload as Record<string, unknown> | null)?.items ??
       (payload as Record<string, unknown> | null)?.data ??
       []) as unknown[]

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      questions: [],
      issues: [{ row: 0, message: 'No questions found. Expected an array, or an object with a "questions" array.' }],
      ignoredColumns: [],
    }
  }

  const questions: Question[] = []
  const allKeys = new Set<string>()

  rows.forEach((row, i) => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      issues.push({ row: i + 1, message: 'Skipped: expected a question object.' })
      return
    }
    const record = row as Record<string, unknown>
    Object.keys(record).forEach(key => allKeys.add(normaliseHeader(key)))

    const cell = (field: Field): string => {
      for (const [key, value] of Object.entries(record)) {
        const normalised = normaliseHeader(key)
        if (COLUMN_ALIASES[field].some(alias => normaliseHeader(alias) === normalised)) {
          if (value === null || value === undefined) return ''
          if (Array.isArray(value)) return value.join(' | ')
          return String(value)
        }
      }
      return ''
    }

    const built = buildQuestion({ row: i + 1, cell }, issues, i, context)
    if (built) questions.push(built)
  })

  const ignoredColumns = [...allKeys].filter(
    key => !(Object.values(COLUMN_ALIASES) as string[][]).some(alias => alias.some(a => normaliseHeader(a) === key)),
  )

  return { questions, issues, ignoredColumns }
}

export function parseCsvBank(input: string, context: ImportContext): ImportResult {
  const issues: ImportIssue[] = []
  const rows = parseCsv(input)

  if (rows.length < 2) {
    return {
      questions: [],
      issues: [{ row: 0, message: 'The file needs a header row and at least one question.' }],
      ignoredColumns: [],
    }
  }

  const headerMap = buildHeaderMap(rows[0])
  if (![...headerMap.values()].includes('text')) {
    return {
      questions: [],
      issues: [{
        row: 1,
        message: 'No question column found. Name one of the columns "question", "text", "prompt" or "stem".',
        value: rows[0].join(', '),
      }],
      ignoredColumns: [],
    }
  }

  const ignoredColumns = rows[0]
    .map(normaliseHeader)
    .filter((header, i) => header && !headerMap.has(i))

  // headerMap is keyed by column index; row building needs the reverse.
  const columnFor = new Map<Field, number>()
  headerMap.forEach((field, index) => columnFor.set(field, index))

  const questions: Question[] = []
  rows.slice(1).forEach((row, i) => {
    if (row.every(cell => !cell.trim())) return // blank line
    const cell = (field: Field): string => {
      const column = columnFor.get(field)
      return column === undefined ? '' : (row[column] ?? '')
    }
    const built = buildQuestion({ row: i + 2, cell }, issues, i, context)
    if (built) questions.push(built)
  })

  return { questions, issues, ignoredColumns }
}

export function parseQuestionBank(
  input: string,
  fileName: string,
  context: ImportContext,
): ImportResult {
  return isJsonFile(fileName) ? parseJsonBank(input, context) : parseCsvBank(input, context)
}

// ── Export ─────────────────────────────────────────────────────────────────
/** Serialise questions to the CSV shape the importer accepts, for round-tripping. */
export function questionsToCsv(questions: Question[]): string {
  const escape = (value: string | number) => {
    const text = String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  const header = [
    'question', 'a', 'b', 'c', 'd', 'e', 'f',
    // Always a letter or the answer text, never a bare number, so the exported
    // file needs no answer-base column to be read back correctly.
    'answer', 'answer base', 'explanation', 'marks', 'difficulty', 'type',
    'topic', 'skill', 'subject', 'source', 'year',
  ]

  const lines = [header.join(',')]
  for (const q of questions) {
    // Exactly six option slots: short-answer and true/false questions have none,
    // and a short row that emits five shifts every later column by one.
    const padded = Array.from({ length: 6 }, (_, i) => q.options[i] ?? '')
    lines.push([
      escape(q.text),
      ...padded.map(escape),
      escape(q.type === 'short' ? q.accepted.join(' | ') : String.fromCharCode(65 + q.correct)),
      escape('1'),
      escape(q.explanation),
      escape(q.marks),
      escape(q.difficulty),
      escape(q.type),
      // The topic *name*, not the id: the importer matches names against the
      // curriculum to rebuild the id, so writing the id here lost the topic on
      // every round trip.
      escape(topicName(q.topicId)),
      escape(q.skillId),
      escape(q.subjectId),
      escape(q.source ?? ''),
      escape(q.year ?? ''),
    ].join(','))
  }
  return lines.join('\n')
}

/** A starter CSV so the format is never a guess for a teacher. */
export const CSV_TEMPLATE = questionsToCsv([
  {
    id: 'template-1', subjectId: 'mathematics', topicId: '', skillId: '',
    type: 'mcq', difficulty: 'easy', marks: 2,
    text: 'Which of the following is a prime number?',
    options: ['9', '13', '21', '27'], correct: 1, accepted: [],
    explanation: '13 has exactly two factors: 1 and itself.', source: '', year: 2024,
  } as Question,
])

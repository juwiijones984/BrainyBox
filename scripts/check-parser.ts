import { importTopicId } from '../src/data'
import { parseCsvBank, parseJsonBank, questionsToCsv } from '../src/lib/importQuestionBank'

// The import target. A question's subject and topic cannot be derived from the file
// alone — the same CSV imported into two subjects is two different sets of
// questions — so the parser takes it from the caller rather than assuming.
const MATH = { subjectId: 'mathematics' as const }
const csvBank = (input: string) => parseCsvBank(input, MATH)
const jsonBank = (input: unknown) => parseJsonBank(JSON.stringify(input), MATH)

let failures = 0
const check = (label: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) {
    console.log('   actual  ', JSON.stringify(actual))
    console.log('   expected', JSON.stringify(expected))
  }
}

// ── CSV round trip: multiple choice ─────────────────────────────────────────
// A real curriculum topic. This fixture used `mathematics--algebra`, which is not
// an id `TOPICS` contains, so the round-trip assertions below were comparing
// against a topic nothing could resolve — the same defect as the empty `topicId`
// they were meant to catch.
const TOPIC_ID = 'mathematics--exponents'
const TOPIC_NAME = 'Exponents'

const mcq: Parameters<typeof questionsToCsv>[0][number] = {
  id: 'a', subjectId: 'mathematics', topicId: TOPIC_ID, skillId: 'ALG-EXP',
  type: 'mcq', difficulty: 'hard', marks: 4,
  text: 'Which is prime, "13" or 9?', options: ['9', '13', '21'], correct: 1,
  accepted: [], explanation: '13 is prime', source: 'Past paper', year: 2024,
}

const short: Parameters<typeof questionsToCsv>[0][number] = {
  id: 'b', subjectId: 'mathematics', topicId: '', skillId: 'ALG-FRACT',
  type: 'short', difficulty: 'medium', marks: 3,
  text: 'Factorise x^2 - 9', options: [], correct: -1,
  accepted: ['(x-3)(x+3)'], explanation: 'difference of squares',
}

const csv = questionsToCsv([mcq, short])
const fromCsv = csvBank(csv)

check('csv: no issues', fromCsv.issues, [])
check('csv: both rows parsed', fromCsv.questions.length, 2)

check('csv: mcq text', fromCsv.questions[0]?.text, mcq.text)
check('csv: mcq options', fromCsv.questions[0]?.options, mcq.options)
check('csv: mcq correct index', fromCsv.questions[0]?.correct, 1)
check('csv: mcq marks', fromCsv.questions[0]?.marks, 4)
check('csv: mcq difficulty', fromCsv.questions[0]?.difficulty, 'hard')
check('csv: mcq skill', fromCsv.questions[0]?.skillId, 'ALG-EXP')
check('csv: mcq year', fromCsv.questions[0]?.year, 2024)
check('csv: mcq source', fromCsv.questions[0]?.source, 'Past paper')

// The export writes the topic *name* and the importer turns a name back into the
// curriculum id. Writing the id instead — or leaving `topicId` empty — meant a
// saved bank came back with a topic nothing could resolve, so it dropped out of
// every per-topic average and breakdown on the next import.
check('csv: topic survives the round trip', fromCsv.questions[0]?.topicId, TOPIC_ID)

const tagged = parseCsvBank(`question,a,b,answer,topic\nWhich is prime?,9,13,A,${TOPIC_NAME}`, MATH)
check('a curriculum topic name resolves to that topic id', tagged.questions[0]?.topicId, TOPIC_ID)

const untagged = parseCsvBank('question,a,b,answer\nWhich is prime?,9,13,A', MATH)
check('an untagged bank gets the documented sentinel', untagged.questions[0]?.topicId,
  importTopicId('mathematics', undefined))
check('the sentinel is not empty', untagged.questions[0]?.topicId !== '', true)

const offSubject = parseCsvBank('question,a,b,answer,subject\nWhich is prime?,9,13,A,physical-sciences', MATH)
check('a row naming another subject is reported, not dropped',
  offSubject.questions.length, 1)
check('the mismatch is named in the issue',
  /physical-sciences/.test(offSubject.issues[0]?.message ?? ''), true)

check('csv: short accepted', fromCsv.questions[1]?.accepted, ['(x-3)(x+3)'])
check('csv: short marks', fromCsv.questions[1]?.marks, 3)
check('csv: short explanation', fromCsv.questions[1]?.explanation, 'difference of squares')
check('csv: short skill', fromCsv.questions[1]?.skillId, 'ALG-FRACT')

// ── JSON ────────────────────────────────────────────────────────────────────
const fromJson = jsonBank({ questions: [mcq, short] })
check('json: no issues', fromJson.issues, [])
check('json: both parsed', fromJson.questions.length, 2)
check('json: mcq options', fromJson.questions[0]?.options, mcq.options)
check('json: mcq correct', fromJson.questions[0]?.correct, 1)
check('json: short accepted', fromJson.questions[1]?.accepted, ['(x-3)(x+3)'])

// ── Answer formats teachers actually use ────────────────────────────────────
const byLetter = csvBank('question,a,b,answer\nWhich is prime?,9,13,A')
check('letter answer A -> index 0', byLetter.questions[0]?.correct, 0)
check('letter answer keeps options', byLetter.questions[0]?.options, ['9', '13'])

const byText = csvBank('question,a,b,answer\nWhich is prime?,9,13,13')
check('answer-by-text', byText.questions[0]?.correct, 1)

// Four options, so a bare `2` has two readings one option apart and the file does
// not say which it means. Guessing it zero-based marked the third option instead of
// the second, silently, for every imported bank without letters.
const ambiguousNumeric = csvBank('question,a,b,c,d,answer\nWhich is prime?,9,13,21,27,2')
check('ambiguous numeric key is not silently guessed', ambiguousNumeric.questions.length, 0)
check('ambiguous numeric key asks for an answer base',
  /answer base/i.test(ambiguousNumeric.issues[0]?.message ?? ''), true)

const base1 = csvBank('question,a,b,c,d,answer base,answer\nWhich is prime?,9,13,21,27,1,2')
check('answer base 1 makes 2 the second option', base1.questions[0]?.correct, 1)

const base0 = csvBank('question,a,b,c,d,answer base,answer\nWhich is prime?,9,13,21,27,0,2')
check('answer base 0 makes 2 the third option', base0.questions[0]?.correct, 2)

// A two-option question is the one case where the readings cannot collide, so the
// old zero-based test still resolves.
const byIndex = csvBank('question,a,b,answer\nWhich is prime?,9,13,2')
check('1-based index 2 -> index 1', byIndex.questions[0]?.correct, 1)

// Comma-delimited options are what an Excel export actually produces, and the cell
// has to be quoted to keep its commas inside one column. The splitter ignored
// commas, so such a cell became a single option named "9,13,21" and the answer
// letter pointed at nothing sensible.
const commaDelimited = csvBank('question,options,answer\n"Pick one","9,13,21",B')
check('comma-delimited options cell', commaDelimited.questions[0]?.options, ['9', '13', '21'])
check('comma-delimited options answer', commaDelimited.questions[0]?.correct, 1)

// The same row unquoted is genuinely malformed: its commas are column separators, so
// `options` reads "9" and `answer` reads "13". It has to be reported, not guessed at.
const unquoted = csvBank('question,options,answer\nPick one,9,13,21,B')
check('an unquoted multi-option row is reported, not mis-mapped', unquoted.questions.length, 0)
check('unquoted multi-option row names the problem',
  /at least two options/.test(unquoted.issues[0]?.message ?? ''), true)

const trueFalse = csvBank('question,type,answer\nWater boils at 100C at sea level,true-false,true')
check('true/false parsed', trueFalse.questions[0]?.type, 'true-false')
check('true/false options', trueFalse.questions[0]?.options, ['True', 'False'])
check('true/false correct', trueFalse.questions[0]?.correct, 0)

const singleCell = csvBank('question,options,answer\nPick one,9|13|21,C')
check('delimited options cell', singleCell.questions[0]?.options, ['9', '13', '21'])
check('delimited options answer', singleCell.questions[0]?.correct, 2)

// ── Bad rows are reported, not silently dropped ─────────────────────────────
const bad = csvBank('question,a,b,answer\n,9,13,A\nNo answer here,9,13,\nGood one,9,13,B')
check('bad: 1 good row survives', bad.questions.length, 1)
check('bad: 2 issues reported', bad.issues.length, 2)

console.log(failures === 0 ? '\ncheck-parser: all checks passed' : `\ncheck-parser: ${failures} CHECK(S) FAILED`)
// Use exitCode rather than process.exit() so piped stdout flushes on Windows.
process.exitCode = failures === 0 ? 0 : 1

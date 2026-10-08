import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getMasteryLevel, masteryColor, masteryLabel, topicName,
  type Attempt, type Question, type Quiz, type SubjectId,
} from '@/data'
import { localDay, newId } from '@/lib/storage'
import { Button, Pill, ProgressBar, ScoreChip, difficultyColor } from '@/components/ui'
import { useAppStore } from '@/store/AppStore'

export interface QuizRunResult {
  results: boolean[]
  durationSec: number
  timeLeftSec: number | null
}

interface QuizRunnerProps {
  quiz: Quiz
  questions: Question[]
  /** Overrides the quiz's own kind — used for ad-hoc skill practice. */
  mode?: Quiz['kind']
  /**
   * Called after the attempt is recorded, for callers that need to navigate or
   * change phase. The runner shows its own results screen, so this is optional.
   */
  onFinish?: (result: QuizRunResult) => void
  onExit: () => void
  /** Rendered under the results summary, e.g. a "try again" button. */
  footer?: React.ReactNode
}

function formatClock(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60)
  const secs = Math.max(0, seconds) % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
}

/**
 * Normalise a short answer for comparison.
 *
 * Maths answers differ far more in how they are typed than in what they mean:
 * "x^2", "x²" and "x2" are all the same answer, and a learner on a phone keypad
 * will produce all three. Unicode superscripts and bare exponents are therefore
 * folded onto a single caret form before anything else happens.
 *
 * Order matters. Superscripts are converted *before* NFKC, because NFKC would
 * silently flatten ² into a plain 2 and destroy the distinction from a product.
 */
function normaliseAnswer(value: string): string {
  return value
    // Case first. Everything below keys off a lowercase class range, so folding
    // case afterwards meant "X2" and "2X3" — the exact shapes a caps-locked phone
    // keyboard produces — missed the caret rule and were marked wrong.
    .toLowerCase()
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, d => `^${[...d].map(c => SUPERSCRIPT_DIGITS[c]).join('')}`)
    .normalize('NFKC')
    // "x2" and "ab3" are written powers with the caret left out. "3x2" is 3x²
    // and is left alone because the letter is followed by nothing, but the
    // letter-before-digit case is the common typing shorthand.
    .replace(/([a-z])(\d)/g, '$1^$2')
    .replace(/[‐-―−]/g, '-')
    .replace(/[×✕✖·∙⋅]/g, '*')
    .replace(/[÷⁄]/g, '/')
    .replace(/[′’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/°|º/g, '')
    .replace(/\s+/g, '')
    // South Africa writes the decimal separator as a comma, so "20,35 m" and
    // "20.35 m" are the same answer. Folding a comma *between digits* into a
    // full stop does that; a comma between values is left alone.
    .replace(/(\d),(\d)/g, '$1.$2')
    // A leading comma or semicolon is the same decimal point typed at the wrong
    // end of the keys, so it becomes a full stop. A leading full stop is left
    // alone: ".075" is a real answer form ("convert 7,5% to a decimal") and
    // stripping it would accept "075" as correct.
    .replace(/^[;,]+/, '.')
    .replace(/[,;.]+$/g, '')
}

export default function QuizRunner({
  quiz, questions, mode, onFinish, onExit, footer,
}: QuizRunnerProps) {
  const { recordAttempt } = useAppStore()
  const kind = mode ?? quiz.kind
  // Practice gives instant feedback; anything with a clock is exam-style and
  // must not reveal answers until submission.
  const instantFeedback = kind === 'practice'
  // A quiz with no limit set is still untimed — `(null ?? null) * 60` would
  // collapse to 0 and end the paper instantly.
  const timeLimitSec =
    kind !== 'practice' && quiz.timeLimitMin != null ? quiz.timeLimitMin * 60 : null

  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null))
  const [textAnswers, setTextAnswers] = useState<string[]>(() => questions.map(() => ''))
  const [checked, setChecked] = useState<boolean[]>(() => questions.map(() => false))
  const [revealed, setRevealed] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const [timeLeft, setTimeLeft] = useState(timeLimitSec ?? 0)
  const startedAt = useRef(Date.now())
  const finished = useRef(false)

  const question = questions[index]
  // Marks come from the questions actually being asked, not the seed bank —
  // an imported paper's questions are not in the static data.
  const marksAvailable = useMemo(
    () => questions.reduce((sum, q) => sum + q.marks, 0),
    [questions],
  )

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (timeLimitSec === null || revealed) return

    const tick = () => {
      setTimeLeft(previous => {
        if (previous <= 1) {
          clearInterval(timer)
          return 0
        }
        return previous - 1
      })
    }

    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [timeLimitSec, revealed])

  // Run state is seeded from `questions` once. A different set of questions —
  // a different quiz on the same route — would otherwise leave the old answers,
  // the old `results` indices and a possibly out-of-range `index` in place.
  useEffect(() => {
    setAnswers(questions.map(() => null))
    setTextAnswers(questions.map(() => ''))
    setChecked(questions.map(() => false))
    setIndex(0)
    setRevealed(false)
    setSaveError(false)
    setTimeLeft(timeLimitSec ?? 0)
    startedAt.current = Date.now()
    finished.current = false
  }, [questions, timeLimitSec])

  // ── Grading ──────────────────────────────────────────────────────────────
  const isCorrect = useCallback(
    (q: Question, optionIndex: number | null, text: string): boolean => {
      if (q.type === 'short') {
        const given = normaliseAnswer(text)
        if (!given) return false
        return q.accepted.some(answer => normaliseAnswer(answer) === given)
      }
      return optionIndex === q.correct
    },
    [],
  )

  const grade = useCallback((): boolean[] => {
    return questions.map((q, i) => isCorrect(q, answers[i], textAnswers[i]))
  }, [questions, answers, textAnswers, isCorrect])

  const finish = useCallback(() => {
    if (finished.current) return
    finished.current = true
    // The results screen is the only thing that gates on `revealed`, so this has
    // to be set here or every finished paper ends on a blank page. The parent
    // used to own this via `onFinish`, which meant the drill pages that pass no
    // `onFinish` never revealed anything at all.
    setRevealed(true)

    const results = grade()
    const durationSec = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000))

    const attempt: Attempt = {
      id: newId('att'),
      quizId: quiz.id,
      quizTitle: quiz.title,
      subjectId: quiz.subjectId,
      kind,
      date: localDay(),
      correct: results.filter(Boolean).length,
      total: results.length,
      durationMin: Math.max(1, Math.round(durationSec / 60)),
      questionIds: questions.map(q => q.id),
      results,
      timeLeftSec: timeLimitSec === null ? null : timeLeft,
    }
    void recordAttempt(attempt).catch(error => {
      setSaveError(true)
      console.error('Could not save attempt', error)
    })

    onFinish?.({ results, durationSec, timeLeftSec: timeLimitSec === null ? null : timeLeft })
  }, [finished, grade, quiz, kind, timeLimitSec, timeLeft, recordAttempt, onFinish])

  // Auto-submit the moment the clock runs out.
  useEffect(() => {
    if (timeLimitSec !== null && timeLeft === 0 && !revealed && !finished.current) {
      finish()
    }
  }, [timeLeft, timeLimitSec, revealed, finish])

  // Guard against losing an in-progress exam to a back gesture.
  useEffect(() => {
    if (revealed) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [revealed])

  // ── Interaction ──────────────────────────────────────────────────────────
  const canAct = !revealed && !(checked[index] && instantFeedback)

  const submitOrAdvance = () => {
    if (instantFeedback && !checked[index]) {
      const next = [...checked]
      next[index] = true
      setChecked(next)
      return
    }
    if (index < questions.length - 1) {
      setIndex(i => i + 1)
    } else {
      finish()
    }
  }

  const answeredCount = questions.filter((_, i) => {
    if (questions[i].type === 'short') return textAnswers[i].trim() !== ''
    return answers[i] !== null
  }).length

  // ── Results ──────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    if (!revealed) return null
    const results = grade()
    const correct = results.filter(Boolean).length
    const percent = Math.round((correct / results.length) * 100)
    const level = getMasteryLevel(percent)

    // Per-topic roll-up so the results screen names the weak area directly.
    const byTopic = new Map<string, { correct: number; total: number }>()
    questions.forEach((q, i) => {
      const key = q.topicId || 'unassigned'
      const bucket = byTopic.get(key) ?? { correct: 0, total: 0 }
      bucket.total += 1
      if (results[i]) bucket.correct += 1
      byTopic.set(key, bucket)
    })

    return { results, correct, percent, level, byTopic }
  }, [revealed, grade, questions])

  if (summary) {
    const { results, correct, percent, level, byTopic } = summary
    const color = masteryColor(level)
    const weakest = [...byTopic.entries()]
      .map(([id, b]) => ({ id, ...b, pct: Math.round((b.correct / b.total) * 100) }))
      .sort((a, b) => a.pct - b.pct)[0]

    return (
      <div className="space-y-5 pb-4">
        <div className="text-center py-4">
          <p className="text-ink-70 text-xs font-display uppercase tracking-widest mb-3">
            {kind === 'exam' ? 'Exam Complete' : kind === 'test' ? 'Test Complete' : 'Session Complete'}
          </p>
          <div className="font-display font-black leading-none" style={{ fontSize: '4.5rem', color }}>
            {percent}%
          </div>
          <p className="font-display text-ink text-lg font-bold mt-2">
            {correct} of {results.length} correct
          </p>
          <p className="text-ink-70 text-sm mt-1">{quiz.title}</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <Pill color={color}>{masteryLabel(level)}</Pill>
            {timeLimitSec !== null && (
              <Pill color="#B45309">
                {timeLeft === 0 ? 'Time expired' : `${formatClock(timeLeft)} left`}
              </Pill>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-surface border border-line-hover p-5">
          <p className="text-ink-70 text-xs font-display uppercase tracking-widest mb-3">Answer Grid</p>
          <div className="flex gap-2 flex-wrap">
            {results.map((ok, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold font-mono-data pressable"
                style={{
                  background: ok ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)',
                  color: ok ? '#047857' : '#f43f5e',
                  // The selected cell is called out, so the grid and the review
                  // list below move together instead of both being no-ops.
                  border: `1px solid ${i === index
                    ? (ok ? '#047857' : '#f43f5e')
                    : (ok ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)')}`,
                  outline: i === index ? '2px solid rgba(2,127,196,0.6)' : 'none',
                  outlineOffset: '2px',
                }}
                aria-label={`Question ${i + 1}, ${ok ? 'correct' : 'incorrect'}`}
                aria-pressed={i === index}
              >
                {ok ? '✓' : '✗'}
              </button>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-line-hover space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs font-mono-data text-ink-70 mb-1.5">
                <span>Marks</span>
                <span>
                  {questions.reduce((sum, q, i) => sum + (results[i] ? q.marks : 0), 0)} / {marksAvailable}
                </span>
              </div>
              <ProgressBar value={percent} color={color} height="h-2" />
            </div>

            {weakest && (
              <div>
                <p className="text-xs font-mono-data text-ink-70 mb-1.5">Weakest topic</p>
                <div className="flex items-center justify-between">
                  <span className="text-ink text-sm font-display">{topicName(weakest.id)}</span>
                  <ScoreChip score={weakest.pct} size="xs" />
                </div>
              </div>
            )}
          </div>
        </div>

        {saveError && (
          <p className="rounded-xl p-3.5 border text-sm font-display" style={{ background: 'rgba(244,63,94,0.07)', borderColor: 'rgba(244,63,94,0.25)', color: '#fda4af' }}>
            This result could not be saved. Check your connection and sit the paper again — nothing has been recorded.
          </p>
        )}

        {/* Question-by-question review with working shown */}
        <div className="space-y-2.5">
          {questions.map((q, i) => {
            const ok = results[i]
            const selected = i === index
            const given = q.type === 'short'
              ? (textAnswers[i] ?? '').trim()
              : answers[i] === null ? '' : q.options[answers[i] as number] ?? ''

            return (
              <div
                key={q.id}
                className="rounded-2xl bg-surface overflow-hidden"
                style={{ border: `1px solid ${selected ? 'rgba(2,127,196,0.5)' : '#E6EAEB'}` }}
              >
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  className="w-full p-4 flex items-start gap-3 text-left pressable"
                  aria-expanded={selected}
                >
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{
                      background: ok ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
                      color: ok ? '#047857' : '#f43f5e',
                    }}
                  >
                    {ok ? '✓' : '✗'}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-ink text-sm font-display leading-snug break-anywhere">
                      {q.text}
                    </span>
                    <span className="block text-ink-60 text-xs font-mono-data mt-1">
                      Topic: {topicName(q.topicId)} · {q.marks} mark{q.marks === 1 ? '' : 's'}
                    </span>
                  </span>
                </button>

                {/* What the learner typed or picked, against the key. Shown for the
                    selected row only — it is what makes the grid and these rows
                    worth clicking rather than decoration. */}
                {selected && (
                  <div className="px-4 pb-3 space-y-2">
                    <div className="grid grid-cols-1 gap-1.5 text-xs font-mono-data">
                      <p>
                        <span className="text-ink-60">Your answer: </span>
                        <span className={ok ? 'text-emerald-400' : 'text-rose-400'}>
                          {given || <span className="text-ink-60">not answered</span>}
                        </span>
                      </p>
                      {!ok && q.type !== 'short' && (
                        <p>
                          <span className="text-ink-60">Correct answer: </span>
                          <span className="text-emerald-400">{q.options[q.correct]}</span>
                        </p>
                      )}
                      {!ok && q.type === 'short' && (
                        <p>
                          <span className="text-ink-60">Accepted: </span>
                          <span className="text-emerald-400">{q.accepted.join(' · ')}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {q.explanation && (
                  <div className="px-4 pb-4">
                    <div className="rounded-xl p-3.5" style={{ background: 'rgba(2,127,196,0.05)', border: '1px solid rgba(2,127,196,0.25)' }}>
                      <p className="text-navy text-xs font-display uppercase tracking-widest mb-1.5">Explanation</p>
                      <p className="text-ink-80 text-sm leading-relaxed break-anywhere">{q.explanation}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {footer}
      </div>
    )
  }

  // ── In progress ───────────────────────────────────────────────────────────
  const dc = difficultyColor(question.difficulty)
  const isCurrentCorrect = checked[index]
    ? isCorrect(question, answers[index], textAnswers[index])
    : null

  return (
    <div className="space-y-4">
      {/* Sticky status bar */}
      <div className="sticky top-0 z-30 -mx-4 px-4 pt-3 pb-2.5 bg-surface/92 backdrop-blur-xl border-b border-line">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onExit}
            className="text-ink-70 active:text-ink-80 transition-colors text-sm font-display min-h-[40px] flex items-center -ml-2 px-2"
          >
            ← Exit
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono-data text-xs text-ink-70 whitespace-nowrap">
              {index + 1}/{questions.length}
            </span>
            {timeLimitSec !== null && (
              <span
                className="flex items-center gap-1 px-2.5 min-h-[32px] rounded-full border font-mono-data text-xs font-semibold tabular-nums"
                style={{
                  color: timeLeft < 120 ? '#f43f5e' : timeLeft < 300 ? '#B45309' : '#047857',
                  borderColor: 'currentColor',
                  background: 'transparent',
                }}
              >
                ⏱ {formatClock(timeLeft)}
              </span>
            )}
          </div>
        </div>
        <ProgressBar
          value={((index + (checked[index] ? 1 : 0)) / questions.length) * 100}
          color={instantFeedback ? '#027FC4' : '#FA9907'}
          height="h-1"
          className="mt-2"
        />
      </div>

      {/* Question */}
      <div className="rounded-2xl bg-surface border border-line-hover p-5">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-ink-60 text-xs font-mono-data">Q{index + 1}</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-display font-semibold capitalize"
            style={{ background: dc.bg, color: dc.color }}>
            {question.difficulty}
          </span>
          <Pill color="#6b7280">
            {question.type === 'short' ? 'Written' : question.type === 'true-false' ? 'True / False' : 'Multiple choice'}
          </Pill>
          <span className="ml-auto text-ink-60 text-xs font-mono-data">
            {question.marks} mark{question.marks === 1 ? '' : 's'}
          </span>
        </div>
        <p className="font-display text-ink font-semibold text-lg leading-relaxed break-anywhere">
          {question.text}
        </p>
      </div>

      {/* Answer input */}
      {question.type === 'short' ? (
        <div className="space-y-2">
          <label htmlFor="short-answer" className="block text-ink-70 text-xs font-display uppercase tracking-widest">
            Your answer
          </label>
          <textarea
            id="short-answer"
            value={textAnswers[index] ?? ''}
            onChange={event => {
              const next = [...textAnswers]
              next[index] = event.target.value
              setTextAnswers(next)
            }}
            disabled={!canAct}
            rows={3}
            autoComplete="off"
            placeholder="Type your answer…"
            className="w-full rounded-xl bg-surface border border-line-hover px-4 py-3.5 text-white placeholder:text-ink-60 text-base font-display focus:outline-none focus:border-blue/30 transition-colors resize-none disabled:opacity-60"
          />
          {checked[index] && isCurrentCorrect === false && (
            <p className="text-rose-400 text-sm font-display">
              Not quite — the accepted answer{question.accepted.length > 1 ? 's are' : ' is'}:{' '}
              <span className="text-ink">{question.accepted.join(' · ')}</span>
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {question.options.map((option, i) => {
            const selected = answers[index] === i
            const isAnswer = i === question.correct
            const wasWrong = checked[index] && selected && !isAnswer

            let borderColor = 'rgba(5,31,46,0.06)'
            let background = '#FFFFFF'
            let labelBackground = 'rgba(5,31,46,0.06)'
            let labelColor = 'rgba(5,31,46,0.12)'

            if (checked[index] && isAnswer) {
              borderColor = '#047857'
              background = 'rgba(16,185,129,0.08)'
              labelBackground = '#047857'
              labelColor = '#fff'
            } else if (wasWrong) {
              borderColor = '#f43f5e'
              background = 'rgba(244,63,94,0.08)'
              labelBackground = '#f43f5e'
              labelColor = '#fff'
            } else if (!checked[index] && selected) {
              borderColor = '#027FC4'
              background = 'rgba(2,127,196,0.08)'
              labelBackground = '#027FC4'
              labelColor = '#fff'
            }

            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (!canAct) return
                  const next = [...answers]
                  next[index] = i
                  setAnswers(next)
                }}
                disabled={!canAct}
                className="w-full rounded-xl p-4 min-h-[56px] flex items-center gap-3 text-left transition-all duration-150 touch-manipulation active:scale-[0.99]"
                style={{ border: `1px solid ${borderColor}`, background }}
              >
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold font-mono-data flex-shrink-0 transition-colors"
                  style={{ background: labelBackground, color: labelColor }}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="text-sm font-display text-ink flex-1 break-anywhere">{option}</span>
                {checked[index] && isAnswer && <span className="text-emerald-400 flex-shrink-0">✓</span>}
                {wasWrong && <span className="text-rose-400 flex-shrink-0">✗</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Instant-feedback explanation */}
      {instantFeedback && checked[index] && (
        <div className="rounded-xl p-4 border" style={{ background: 'rgba(2,127,196,0.05)', borderColor: 'rgba(2,127,196,0.2)' }}>
          <p className="text-navy text-xs font-display uppercase tracking-widest mb-2">Explanation</p>
          {question.explanation ? (
            <p className="text-ink-80 text-sm leading-relaxed break-anywhere">{question.explanation}</p>
          ) : (
            <p className="text-ink-70 text-sm">No explanation was provided for this question.</p>
          )}
        </div>
      )}

      {/* Sticky action bar */}
      <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-surface/92 backdrop-blur-xl border-t border-line">
        <Button full size="lg" onClick={submitOrAdvance} disabled={!canAct && !checked[index]}>
          {instantFeedback
            ? checked[index]
              ? index < questions.length - 1 ? 'Next Question →' : 'See Results →'
              : 'Submit Answer'
            : index < questions.length - 1
              ? 'Next Question →'
              : 'Submit Test'}
        </Button>
      </div>

      {/* Question navigator for exam-style runs */}
      {!instantFeedback && (
        <div className="pt-1">
          <p className="text-ink-60 text-xs font-display mb-2">
            Jump to question · {answeredCount} of {questions.length} answered
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {questions.map((_, i) => {
              const isCurrent = i === index
              const answered = questions[i].type === 'short'
                ? textAnswers[i]?.trim() !== ''
                : answers[i] !== null
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Go to question ${i + 1}`}
                  className="w-10 h-10 rounded-lg text-xs font-mono-data font-semibold transition-colors duration-150 touch-manipulation"
                  style={{
                    background: isCurrent ? '#027FC4' : answered ? 'rgba(245,158,11,0.2)' : 'rgba(5,31,46,0.06)',
                    color: isCurrent ? '#fff' : answered ? '#B45309' : 'rgba(5,31,46,0.4)',
                    border: `1px solid ${isCurrent ? '#027FC4' : 'transparent'}`,
                  }}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>

          {answeredCount < questions.length && (
            <p className="text-ember/80 text-xs mt-3 font-display">
              {questions.length - answeredCount} unanswered — they will be marked wrong.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

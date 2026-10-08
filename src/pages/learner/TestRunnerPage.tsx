import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { SUBJECT_MAP, totalMarksOf, topicName, type AssessmentKind, type Question } from '@/data'
import { useAppStore } from '@/store/AppStore'
import QuizRunner from '@/components/quiz/QuizRunner'
import { Button, EmptyState, Pill } from '@/components/ui'

type Phase = 'brief' | 'running'

/**
 * The briefing copy for each assessment kind.
 *
 * Typed `Record<AssessmentKind, ...>` rather than `Record<string, ...>`, and that
 * annotation is the entire point. This map was previously `Record<string, ...>`
 * and missing `diagnostic`, so `BRIEF[quiz.kind]` type-checked as always defined,
 * the omission compiled cleanly, and every diagnostic quiz crashed the page with
 * `Cannot read properties of undefined (reading 'title')` — there are one per
 * lesson plus `q-math-diagnostic`, so it was not an edge case. Adding a kind to
 * `AssessmentKind` now fails the build until the copy exists, which is how
 * `KIND_META` in `TestsPage` has always worked.
 */
const BRIEF: Record<AssessmentKind, { title: string; note: string }> = {
  diagnostic: {
    title: 'Diagnostic',
    note: 'Your first real assessment, so sit it before you revise. The result becomes your baseline, and every later score is measured against that rather than against nothing.',
  },
  practice: {
    title: 'Practice Session',
    note: 'Untimed. You get the explanation after every question, so this is the best mode for learning something new.',
  },
  quiz: {
    title: 'Quiz',
    note: 'Answers stay hidden until you submit. Use this once you have practised the material.',
  },
  test: {
    title: 'Timed Test',
    note: 'Answer everything — unanswered questions are marked wrong. You can move between questions and change an answer before you submit.',
  },
  exam: {
    title: 'Mock Exam',
    note: 'Full paper under exam conditions. There is no feedback until you finish, and the clock submits the paper for you when it runs out.',
  },
}

export default function TestRunnerPage() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const { quizzes, questions, attempts } = useAppStore()
  const [phase, setPhase] = useState<Phase>('brief')
  // Bumped by "Sit it again". The runner keeps a `finished` ref that suppresses a
  // second submit, so re-running the same quiz needs a fresh instance; navigating
  // back to this identical URL would not remount anything.
  const [run, setRun] = useState(0)

  const restart = () => {
    setRun(n => n + 1)
    setPhase('running')
  }

  const quiz = quizzes.find(q => q.id === quizId)

  const ordered = useMemo<Question[]>(() => {
    if (!quiz) return []
    const byId = new Map(questions.map(q => [q.id, q]))
    return quiz.questionIds.map(id => byId.get(id)).filter((q): q is Question => Boolean(q))
  }, [quiz, questions])

  const history = useMemo(
    () => attempts.filter(a => a.quizId === quizId).slice(0, 5),
    [attempts, quizId],
  )

  if (!quiz) {
    return (
      <EmptyState
        icon="◌"
        title="Test not found"
        body="This test may have been deleted. Head back to the list to pick another."
        action={<Button className="mt-2" onClick={() => navigate('/learner/tests')}>Back to Tests</Button>}
      />
    )
  }

  if (!ordered.length) {
    return (
      <EmptyState
        icon="📄"
        title="This test has no questions"
        body="The quiz points at questions that are no longer in the bank. A teacher can rebuild it in the quiz builder."
        action={<Button className="mt-2" onClick={() => navigate('/learner/tests')}>Back to Tests</Button>}
      />
    )
  }

  const subject = SUBJECT_MAP[quiz.subjectId]
  // The type says this lookup cannot miss, and `BRIEF` is now typed so the
  // compiler holds that to it. A learned quiz, though, is read straight out of
  // Firestore by `readQuizzes` and the `users/{uid}/quizzes` subcollection is
  // writable by its owner, so `kind` is whatever a document happens to contain —
  // unvalidated at runtime, whatever the declared type says. A stale or
  // hand-edited quiz with `kind: 'revision'` would otherwise take the page down
  // with the same undefined-property crash this fallback exists to prevent.
  // Falling back to the quiz copy keeps the learner on a working runner instead
  // of an error boundary, and the quiz's own title still names it correctly.
  const brief = BRIEF[quiz.kind] ?? BRIEF.quiz

  // ── Brief ─────────────────────────────────────────────────────────────────
  if (phase === 'brief') {
    const marks = totalMarksOf(questions, ordered.map(q => q.id))
    const topics = [...new Set(ordered.map(q => q.topicId))]

    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => navigate('/learner/tests')}
          className="text-ink-60 active:text-ink-80 transition-colors text-sm font-display -ml-2 px-2 min-h-[44px]"
        >
          ← Tests
        </button>

        <div className="rounded-2xl bg-surface border border-line-hover p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: `${subject.color}1a`, color: subject.color }}
              aria-hidden="true"
            >
              {subject.glyph}
            </span>
            <div className="min-w-0">
              <p className="text-ink-60 text-xs font-display uppercase tracking-widest">{brief.title}</p>
              <h2 className="font-display text-ink font-bold text-lg break-anywhere leading-tight">{quiz.title}</h2>
            </div>
          </div>

          <p className="text-ink-70 text-sm leading-relaxed">{quiz.description || brief.note}</p>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Questions', value: String(ordered.length) },
              { label: 'Marks', value: String(marks) },
              { label: 'Time', value: quiz.timeLimitMin ? `${quiz.timeLimitMin}m` : '∞' },
            ].map(({ label, value }) => (
              <div key={label} className="text-center rounded-xl bg-tint-strong p-3 border border-line-hover">
                <p className="font-mono-data font-bold text-ink text-lg">{value}</p>
                <p className="text-ink-70 text-xs font-display mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div
            className="rounded-xl p-3.5 border"
            style={{
              background: quiz.kind === 'practice' ? 'rgba(16,185,129,0.05)' : 'rgba(245,158,11,0.05)',
              borderColor: quiz.kind === 'practice' ? 'rgba(16,185,129,0.18)' : 'rgba(245,158,11,0.18)',
            }}
          >
            <p className="text-xs font-display font-semibold mb-1"
              style={{ color: quiz.kind === 'practice' ? '#047857' : '#B45309' }}>
              Before you start
            </p>
            <p className="text-ink-70 text-xs leading-relaxed">{brief.note}</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {topics.map(topicId => (
              <Pill key={topicId} color={subject.color}>{topicName(topicId)}</Pill>
            ))}
          </div>

          <Button full size="lg" onClick={() => setPhase('running')}>
            Start {brief.title} →
          </Button>
        </div>

        {history.length > 0 && (
          <div className="rounded-2xl bg-surface border border-line-hover p-4">
            <p className="text-ink-70 text-xs font-display uppercase tracking-widest mb-3">Your Previous Attempts</p>
            <div className="space-y-2">
              {history.map(attempt => {
                const pct = Math.round((attempt.correct / attempt.total) * 100)
                return (
                  <div key={attempt.id} className="flex items-center gap-3">
                    <span className="font-mono-data text-sm font-bold w-10 flex-shrink-0"
                      style={{ color: pct >= 80 ? '#047857' : pct >= 60 ? '#014E8C' : pct >= 40 ? '#B45309' : '#f43f5e' }}>
                      {pct}%
                    </span>
                    <span className="text-ink-70 text-xs font-mono-data flex-1">
                      {attempt.correct}/{attempt.total} correct · {attempt.durationMin} min
                    </span>
                    <span className="text-ink-60 text-xs font-mono-data flex-shrink-0">{attempt.date.slice(5)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Running ──────────────────────────────────────────────────────────────
  //
  // The runner reveals its own results screen, so there is no 'done' phase: an
  // `onFinish` that switched to a `done` phase which rendered `null` is what made
  // every finished paper come back blank.
  if (phase === 'running') {
    return (
      <QuizRunner
        key={`${quiz.id}-${run}`}
        quiz={quiz}
        questions={ordered}
        onExit={() => navigate('/learner/tests')}
        footer={
          <div className="space-y-2 pt-2">
            <Button full onClick={restart}>
              Sit it again
            </Button>
            <Button full variant="ghost" onClick={() => navigate('/learner/tests')}>
              All tests
            </Button>
            <button
              type="button"
              onClick={() => navigate('/learner')}
              className="w-full text-center text-ink-60 active:text-ink-80 text-sm font-display min-h-[44px]"
            >
              Back to Dashboard
            </button>
          </div>
        }
      />
    )
  }

  return null
}

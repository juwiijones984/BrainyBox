import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { SUBJECTS, SUBJECT_MAP, getMasteryLevel, masteryColor, totalMarks, type AssessmentKind } from '@/data'
import { useAppStore } from '@/store/AppStore'
import { Card, EmptyState, FilterRail, Pill, ProgressBar, Segmented, SectionLabel } from '@/components/ui'

const KIND_META: Record<AssessmentKind, { label: string; glyph: string; color: string; blurb: string }> = {
  diagnostic: { label: 'Diagnostic', glyph: '◎', color: '#8b5cf6', blurb: 'Sets your baseline. Every question is tagged to an individual skill.' },
  practice:   { label: 'Practice',  glyph: '◉', color: '#047857', blurb: 'Untimed, with instant feedback after every question.' },
  quiz:       { label: 'Quiz',      glyph: '◈', color: '#014E8C', blurb: 'Timed, answers revealed at the end.' },
  test:       { label: 'Test',      glyph: '⏱', color: '#B45309', blurb: 'Short timed paper under exam conditions.' },
  exam:       { label: 'Exam',      glyph: '▣', color: '#f43f5e', blurb: 'Full-length paper. No feedback until you finish.' },
}

// Display order: a diagnostic is what a learner should take first, so it leads.
const KIND_ORDER: AssessmentKind[] = ['diagnostic', 'practice', 'quiz', 'test', 'exam']

export default function TestsPage() {
  const navigate = useNavigate()
  const { activeSubjectId, quizzes, questions, attempts } = useAppStore()
  const [scope, setScope] = useState<'subject' | 'all'>('subject')
  const [filter, setFilter] = useState<string>('All')

  const accent = SUBJECT_MAP[activeSubjectId].color

  const visible = useMemo(
    () => (scope === 'subject' ? quizzes.filter(q => q.subjectId === activeSubjectId) : quizzes),
    [quizzes, scope, activeSubjectId],
  )

  const filtered = useMemo(
    () => (filter === 'All' ? visible : visible.filter(q => q.kind === filter)),
    [visible, filter],
  )

  // Best result per quiz, so a learner can see where they already stand.
  const best = useMemo(() => {
    const map = new Map<string, number>()
    attempts.forEach(attempt => {
      if (!attempt.total) return
      const pct = Math.round((attempt.correct / attempt.total) * 100)
      const previous = map.get(attempt.quizId)
      if (previous === undefined || pct > previous) map.set(attempt.quizId, pct)
    })
    return map
  }, [attempts])

  const byId = useMemo(() => new Map(questions.map(q => [q.id, q])), [questions])

  if (!filtered.length) {
    return (
      <EmptyState
        icon="⏱"
        title="No tests here yet"
        body={
          scope === 'subject'
            ? `No ${SUBJECT_MAP[activeSubjectId].shortName} tests match this filter. Switch to "All subjects" to see the full list.`
            : 'Upload a question bank from the teacher portal to create your first test.'
        }
        action={
          scope === 'subject'
            ? <button type="button" onClick={() => setScope('all')} className="text-navy text-sm font-display mt-2 min-h-[44px]">Show all subjects</button>
            : null
        }
      />
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-ink-70 text-xs font-semibold tracking-widest uppercase font-display">Assessments</p>
        <h2 className="font-display text-2xl font-bold text-ink mt-0.5">Tests & Quizzes</h2>
      </div>

      <Segmented
        options={[
          { value: 'subject', label: SUBJECT_MAP[activeSubjectId].shortName },
          { value: 'all', label: 'All subjects' },
        ]}
        value={scope}
        onChange={setScope}
      />

      <FilterRail
        options={[
          { value: 'All', label: 'All' },
          ...KIND_ORDER.map(k => ({ value: k, label: KIND_META[k].label })),
        ]}
        value={filter}
        onChange={setFilter}
        accent={accent}
      />

      {scope === 'all' && (
        <p className="text-ink-60 text-xs font-display -mt-2">
          Grouped by the subject each test belongs to.
        </p>
      )}

      <div className="space-y-2.5">
        {KIND_ORDER.flatMap(kind => {
          const group = filtered.filter(q => q.kind === kind)
          if (!group.length) return []

          return [
            <SectionLabel key={`head-${kind}`} className="pt-2">{KIND_META[kind].label}</SectionLabel>,
            ...group.map(quiz => {
              const meta = KIND_META[quiz.kind]
              const subject = SUBJECT_MAP[quiz.subjectId]
              const score = best.get(quiz.id)
              const missing = quiz.questionIds.filter(id => !byId.has(id)).length
              const marks = totalMarks(quiz.questionIds)

              return (
                <Card
                  key={quiz.id}
                  hover
                  className="p-4"
                  onClick={() => navigate(`/learner/tests/${quiz.id}`)}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: `${meta.color}1a`, color: meta.color }}
                      aria-hidden="true"
                    >
                      {meta.glyph}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-display font-bold text-ink text-sm break-anywhere">{quiz.title}</p>
                        {score !== undefined ? (
                          <span
                            className="font-mono-data text-sm font-bold flex-shrink-0"
                            style={{ color: masteryColor(getMasteryLevel(score)) }}
                          >
                            {score}%
                          </span>
                        ) : (
                          <Pill color="#6b7280">new</Pill>
                        )}
                      </div>

                      {scope === 'all' && (
                        <p className="text-[11px] font-mono-data mt-1 flex items-center gap-1.5">
                          <span style={{ color: subject.color }} aria-hidden="true">{subject.glyph}</span>
                          <span style={{ color: subject.color }}>{subject.shortName}</span>
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-1.5 text-xs font-mono-data text-ink-70 flex-wrap">
                        <span>{quiz.questionIds.length} Q</span>
                        <span>·</span>
                        <span>{marks} marks</span>
                        <span>·</span>
                        <span>{quiz.timeLimitMin ? `${quiz.timeLimitMin} min` : 'untimed'}</span>
                      </div>

                      {score !== undefined && (
                        <ProgressBar
                          value={score}
                          color={masteryColor(getMasteryLevel(score))}
                          className="mt-2"
                        />
                      )}

                      {missing > 0 && (
                        <p className="text-rose-400 text-xs mt-2 font-display">
                          {missing} question{missing === 1 ? '' : 's'} missing from the bank
                        </p>
                      )}
                    </div>

                    <span className="text-ink-60 text-lg flex-shrink-0 mt-1" aria-hidden="true">›</span>
                  </div>
                </Card>
              )
            }),
          ]
        })}
      </div>

      <p className="text-center text-ink-60 text-xs font-display pt-2">
        {SUBJECTS.length} subjects · {questions.length} questions in the bank
      </p>
    </div>
  )
}

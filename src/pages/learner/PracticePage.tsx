import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  SUBJECT_MAP, accuracyOf, getMasteryLevel, masteryColor, subjectTopics, topicAverageOf,
  weakestSkills,
} from '@/data'
import { useAppStore } from '@/store/AppStore'
import {
  Card, EmptyState, FilterRail, MasteryBadge, Pill, ProgressBar, ScoreChip, SectionLabel,
} from '@/components/ui'
import LessonLinkButton from '@/components/lessons/LessonLinkButton'

export default function PracticePage() {
  const navigate = useNavigate()
  const { activeSubjectId, skills, questions, quizzes } = useAppStore()
  const [filter, setFilter] = useState('All')

  const subject = SUBJECT_MAP[activeSubjectId]
  const accent = subject.color

  const subjectSkills = useMemo(
    () => skills.filter(s => s.subjectId === activeSubjectId),
    [skills, activeSubjectId],
  )
  const topics = useMemo(() => subjectTopics(activeSubjectId), [activeSubjectId])

  const view = useMemo(() => {
    const weakest = weakestSkills(subjectSkills, 1)[0] ?? null
    // Diagnostics live on the Tests page, where they are grouped as such. The
    // practice hub is for drilling, so only untimed practice papers belong here.
    const available = quizzes.filter(
      q => q.subjectId === activeSubjectId && q.kind === 'practice',
    )

    // Only surface skills that actually have questions to practise against.
    const withQuestions = subjectSkills.filter(
      skill => questions.some(q => q.skillId === skill.id),
    )
    const pool = withQuestions.length ? withQuestions : subjectSkills

    return { weakest, available, pool }
  }, [subjectSkills, questions, quizzes, activeSubjectId])

  const filtered = useMemo(() => {
    const list = filter === 'All' ? view.pool : view.pool.filter(s => s.topic === filter)
    // Unassessed skills sort last rather than to the top: with no measurement
    // there is no basis for calling one the weakest, and floating them to the
    // front would imply the app knows something it does not.
    return [...list].sort((a, b) => {
      if (a.current === null) return b.current === null ? 0 : 1
      if (b.current === null) return -1
      return a.current - b.current
    })
  }, [view.pool, filter])

  if (!subjectSkills.length) {
    return (
      <EmptyState
        icon="◉"
        title={`No ${subject.shortName} skills yet`}
        body="Upload a question bank from the teacher portal and the practice hub will build itself around it."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-ink-70 text-xs font-semibold tracking-widest uppercase font-display">Targeted Practice</p>
        <h2 className="font-display text-2xl font-bold text-ink mt-0.5">Practice Hub</h2>
      </div>

      {view.weakest && view.weakest.current !== null && (
        <Card
          onClick={() => navigate(`/learner/practice/session/${view.weakest!.id}`)}
          className="p-5"
          style={{
            background: `linear-gradient(135deg, ${accent}26 0%, ${accent}0d 100%)`,
            border: `1px solid ${accent}40`,
          }}
        >
          <p className="text-xs font-semibold tracking-widest uppercase font-display mb-2" style={{ color: accent }}>
            ◉ Recommended for you
          </p>
          <p className="font-display text-xl font-bold text-ink">{view.weakest.name}</p>
          <p className="text-ink-70 text-sm mt-1">{view.weakest.topic}</p>

          <div className="flex items-center gap-3 mt-3 text-sm font-mono-data" style={{ color: `${accent}cc` }}>
            <span>Easy → Hard</span>
            <span>·</span>
            <span>Instant feedback</span>
          </div>

          <div className="flex items-center gap-3 mt-4">
            <ProgressBar
              value={view.weakest.current}
              color={masteryColor(getMasteryLevel(view.weakest.current))}
              className="flex-1 h-1.5"
            />
            <ScoreChip score={view.weakest.current} size="sm" />
          </div>

          <div
            className="mt-4 inline-flex items-center gap-2 text-sm font-display font-bold px-5 py-3 rounded-xl text-ink min-h-[48px]"
            style={{ background: accent }}
          >
            Start session →
          </div>

          <LessonLinkButton skillId={view.weakest!.id} className="mt-2" />
        </Card>
      )}

      {view.available.length > 0 && (
        <div>
          <SectionLabel>Timed Practice</SectionLabel>
          <div className="space-y-2">
            {view.available.map(quiz => (
              <Card
                key={quiz.id}
                hover
                className="p-4 flex items-center gap-4"
                onClick={() => navigate(`/learner/tests/${quiz.id}`)}
              >
                <span
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: `${accent}1a`, color: accent }}
                  aria-hidden="true"
                >
                  ⏱
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-display font-bold text-ink text-sm truncate">{quiz.title}</span>
                  <span className="block text-ink-70 text-xs mt-0.5 font-mono-data">
                    {quiz.questionIds.length} questions
                    {quiz.timeLimitMin ? ` · ${quiz.timeLimitMin} min` : ' · untimed'}
                  </span>
                </span>
                <span className="text-ink-60 text-lg flex-shrink-0" aria-hidden="true">›</span>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Topic filter — swipeable */}
      <FilterRail
        options={[{ value: 'All', label: 'All' }, ...topics.map(t => ({ value: t.name, label: t.name }))]}
        value={filter}
        onChange={setFilter}
        accent={accent}
      />

      {/* Skills */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <p className="text-ink-70 text-sm text-center py-8 font-display">
            No questions for {filter} yet.
          </p>
        ) : (
          filtered.map(skill => {
            const skillLevel = getMasteryLevel(skill.current)
            const accuracy = accuracyOf(skill)
            const count = questions.filter(q => q.skillId === skill.id).length
            return (
              <Card
                key={skill.id}
                hover
                className="p-4"
                onClick={() => navigate(`/learner/practice/session/${skill.id}`)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="font-display font-semibold text-ink text-sm truncate">{skill.name}</p>
                        <p className="text-ink-60 text-xs font-mono-data truncate">{skill.topic}</p>
                      </div>
                      <MasteryBadge score={skill.current} />
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <ProgressBar value={skill.current} color={masteryColor(skillLevel)} className="flex-1" />
                      <ScoreChip score={skill.current} size="xs" />
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2 text-xs font-mono-data">
                      <span className="text-ink-60 truncate">
                        {count} question{count === 1 ? '' : 's'} · {accuracy === null ? 'not yet attempted' : `${accuracy}% accuracy`}
                      </span>
                      {count > 0 && <Pill color={accent}>ready</Pill>}
                    </div>
                  </div>
                  <span className="text-ink-60 text-xl mt-1 flex-shrink-0" aria-hidden="true">›</span>
                </div>
              </Card>
            )
          })
        )}
      </div>

      {topics.length > 1 && (
        <p className="text-center text-ink-60 text-xs font-display">
          {filter === 'All' ? `${topics.length} topics` : filter} · {filtered.length} skill
          {filtered.length === 1 ? '' : 's'}
        </p>
      )}
    </div>
  )
}

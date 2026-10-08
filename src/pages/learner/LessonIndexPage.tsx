import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { LESSONS, SUBJECT_MAP, getMasteryLevel, masteryColor } from '@/data'
import { useAppStore } from '@/store/AppStore'
import { EmptyState, Pill, ProgressBar, ScoreChip, SectionLabel } from '@/components/ui'

/**
 * The 11 modules as a table of contents.
 *
 * Reachable from the Marks Map so a learner can read ahead of the diagnostic
 * or revisit a module they have already been assessed on.
 */
export default function LessonIndexPage() {
  const navigate = useNavigate()
  const { skills } = useAppStore()

  const rows = useMemo(
    () => LESSONS.map(lesson => {
      const moduleSkills = skills.filter(
        s => s.subjectId === lesson.subjectId && s.topicId === lesson.topicId,
      )
      const assessed = moduleSkills.filter(s => s.current !== null)
      const average = assessed.length
        ? Math.round(assessed.reduce((sum, s) => sum + s.current!, 0) / assessed.length)
        : null
      const weakest = [...assessed].sort((a, b) => a.current! - b.current!)[0]
      return { lesson, average, weakest, skillCount: moduleSkills.length, assessed: assessed.length }
    }),
    [skills],
  )

  if (!LESSONS.length) {
    return (
      <EmptyState
        icon="◈"
        title="No lessons yet"
        body="Lessons are built from the study guide. Once your curriculum has lesson content it will appear here."
      />
    )
  }

  const accent = SUBJECT_MAP[LESSONS[0].subjectId].color

  return (
    <div className="space-y-5">
      <div>
        <button
          type="button"
          onClick={() => navigate('/learner/marks-map')}
          className="text-ink-70 text-sm font-display active:text-ink-80 transition-colors"
        >
          ‹ Marks Map
        </button>
        <h2 className="font-display text-2xl font-bold text-ink mt-2">Lessons</h2>
        <p className="text-ink-70 text-sm mt-1 leading-relaxed">
          {LESSONS.length} modules, {LESSONS.reduce((n, l) => n + l.concepts.length, 0)} concepts and{' '}
          {LESSONS.reduce((n, l) => n + l.workedExamples.length, 0)} worked examples.
        </p>
      </div>

      <div>
        <SectionLabel>Modules</SectionLabel>
        <div className="space-y-2 mt-2">
          {rows.map(({ lesson, average, weakest, skillCount }) => {
            const level = getMasteryLevel(average)
            const color = masteryColor(level)
            return (
              // `Card` renders a real <button> whenever it is given an onClick, so the
              // "weakest skill" button used to sit inside another button. The browser
              // hoists the inner one out, which broke the card's own click target and
              // left the DOM unlike the React tree. The card is a plain container here
              // and the two actions are siblings.
              <div
                key={lesson.moduleNumber}
                className="w-full rounded-2xl bg-surface border border-line-hover p-3.5"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/learner/lessons/${lesson.moduleNumber}`)}
                  className="w-full text-left pressable cursor-pointer hover:border-line-strong rounded-2xl"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-ink-70 text-[11px] font-semibold uppercase tracking-widest font-display">
                        Module {lesson.moduleNumber}
                      </p>
                      <h3 className="text-ink text-sm font-bold font-display mt-0.5 truncate">
                        {lesson.title}
                      </h3>
                    </div>
                    {/* A module with no assessed skills averages to null, and every
                        module renders here. `{average}%` printed a literal "null%". */}
                    <ScoreChip score={average} size="sm" />
                  </div>
                </button>

                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <Pill color="rgba(5,31,46,0.55)">{lesson.termLabel}</Pill>
                  <Pill color="rgba(5,31,46,0.55)">{skillCount} skills</Pill>
                </div>

                <div className="mt-2.5">
                  <ProgressBar value={average} color={color} />
                </div>

                {weakest && (
                  <button
                    type="button"
                    onClick={() => navigate(`/learner/lessons/${lesson.moduleNumber}/skill/${weakest.id}`)}
                    className="mt-2.5 text-[11px] font-display active:opacity-70 transition-opacity text-left"
                    style={{ color }}
                  >
                    Weakest here: {weakest.name} ({weakest.current}%) →
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-ink-60 text-xs text-center leading-relaxed" style={{ color: `${accent}55` }}>
        Tap a module to read it, or tap a weak skill to jump straight to the concept that teaches it.
      </p>
    </div>
  )
}

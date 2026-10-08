import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  LESSONS, SUBJECT_MAP, accuracyOf, getMasteryLevel, masteryColor, masteryLabel,
  subjectTopics, topicAverageOf, topicName, type MasteryLevel,
} from '@/data'
import { useAppStore } from '@/store/AppStore'
import {
  Card, DeltaBadge, EmptyState, MasteryBadge, MasteryDot, ProgressBar, ScoreChip,
} from '@/components/ui'
import LessonLinkButton from '@/components/lessons/LessonLinkButton'

const LEVELS: MasteryLevel[] = ['mastered', 'developing', 'weak', 'major-gap']

/**
 * "Today" / "3 days ago" / "never", from a real timestamp.
 *
 * The old version was a hardcoded string on each skill ("2h ago", "1w ago",
 * "Never") describing a study history that did not exist. With no practice, the
 * answer is "never", and that is a real statement about this learner.
 */
function relativeDate(iso: string | null): string {
  if (!iso) return 'Never practised'
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return 'Unknown'

  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000)
  if (days <= 0) {
    const hours = Math.floor((Date.now() - then.getTime()) / 3_600_000)
    return hours <= 0 ? 'Just now' : `${hours}h ago`
  }
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default function MarksMapPage() {
  const navigate = useNavigate()
  const { activeSubjectId, skills } = useAppStore()
  const [topicId, setTopicId] = useState<string | null>(null)
  const [skillId, setSkillId] = useState<string | null>(null)

  const accent = SUBJECT_MAP[activeSubjectId].color
  const topics = useMemo(() => subjectTopics(activeSubjectId), [activeSubjectId])
  const subjectSkills = useMemo(
    () => skills.filter(s => s.subjectId === activeSubjectId),
    [skills, activeSubjectId],
  )

  const skill = subjectSkills.find(s => s.id === skillId)

  const topicRows = useMemo(
    () =>
      topics.map(topic => {
        const members = subjectSkills.filter(s => s.topicId === topic.id)
        const avg = topicAverageOf(subjectSkills, activeSubjectId, topic.id)
        const base = topicAverageOf(subjectSkills, activeSubjectId, topic.id, 'baseline')
        return {
          topic,
          members,
          avg,
          base,
          // A topic with nothing assessed has no movement to report.
          delta: avg === null || base === null ? null : avg - base,
          strongCount: members.filter(s => getMasteryLevel(s.current) === 'mastered').length,
        }
      }),
    [topics, subjectSkills, activeSubjectId],
  )
  if (!subjectSkills.length) {
    return (
      <EmptyState
        icon="▦"
        title="No skills mapped"
        body={`${SUBJECT_MAP[activeSubjectId].name} has no skills in your curriculum yet.`}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-ink-70 text-xs font-semibold tracking-widest uppercase font-display">Skill Intelligence</p>
        <h2 className="font-display text-2xl font-bold text-ink mt-0.5">Marks Map</h2>
        <p className="text-ink-60 text-xs font-mono-data mt-1">
          {subjectSkills.length} skills across {topics.length} topics
        </p>
      </div>

      {/* Legend */}
      <div className="flex gap-3 flex-wrap">
        {LEVELS.map(level => (
          <span key={level} className="flex items-center gap-1.5">
            <MasteryDot level={level} size="xs" />
            <span className="text-xs text-ink-70 font-display">{masteryLabel(level)}</span>
          </span>
        ))}
      </div>

      {/* Lessons: the step between "this is weak" and "here is the method" */}
      {LESSONS.length > 0 && (
        <Card hover className="p-3.5" onClick={() => navigate('/learner/lessons')}>
          <div className="flex items-center gap-3">
            <span className="text-ink-70 text-lg" aria-hidden="true">◈</span>
            <div className="min-w-0 flex-1">
              <p className="text-ink font-display font-bold text-sm">Lessons</p>
              <p className="text-ink-70 text-xs mt-0.5">
                {LESSONS.length} modules with worked examples, matched to your weak skills
              </p>
            </div>
            <span className="text-ink-60 text-sm" aria-hidden="true">›</span>
          </div>
        </Card>
      )}

      {/* Skill detail */}
      {skill && (
        <div className="rounded-2xl bg-surface border p-5" style={{ borderColor: `${accent}40` }}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <p className="text-xs font-display uppercase tracking-widest mb-1" style={{ color: accent }}>Skill Detail</p>
              <h3 className="font-display font-bold text-ink text-lg break-anywhere leading-tight">{skill.name}</h3>
              <p className="text-ink-70 text-sm">{skill.topic}</p>
            </div>
            <button
              type="button"
              onClick={() => setSkillId(null)}
              aria-label="Close skill detail"
              className="w-10 h-10 rounded-xl text-ink-60 active:text-ink-80 active:bg-tint-press flex items-center justify-center flex-shrink-0 -mt-1 -mr-1"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Baseline', node: <ScoreChip score={skill.baseline} size="lg" /> },
              { label: 'Current', node: <ScoreChip score={skill.current} size="lg" /> },
              { label: 'Attempts', node: <p className="font-mono-data font-bold text-ink text-xl">{skill.attempts}</p> },
              {
                label: 'Accuracy',
                node: <p className="font-mono-data font-bold text-ink text-xl">
                  {accuracyOf(skill) === null ? '—' : `${accuracyOf(skill)}%`}
                </p>,
              },
            ].map(({ label, node }) => (
              <div key={label} className="rounded-xl bg-tint-strong p-3 text-center border border-line">
                <p className="text-ink-70 text-xs font-display mb-1">{label}</p>
                {node}
              </div>
            ))}
          </div>

          <div className="space-y-1.5 mb-4">
            {(['Baseline', 'Current'] as const).map((label, i) => {
              const value = i === 0 ? skill.baseline : skill.current
              return (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-ink-60 text-xs font-mono-data w-16 text-right">{label.toLowerCase()}</span>
                  <ProgressBar
                    value={value}
                    color={masteryColor(getMasteryLevel(value))}
                    className={`flex-1 ${i === 0 ? 'opacity-40' : ''}`}
                  />
                  <span className="text-ink-70 font-mono-data text-xs w-8">{value}%</span>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between gap-2 text-xs font-mono-data text-ink-70 mb-4">
            <span className="truncate">
              Last practised: {relativeDate(skill.lastPracticedAt)}
            </span>
            <DeltaBadge baseline={skill.baseline} current={skill.current} />
          </div>

          <button
            type="button"
            onClick={() => navigate(`/learner/practice/session/${skill.id}`)}
            className="w-full rounded-xl text-white font-display font-bold py-3.5 text-sm min-h-[48px] pressable"
            style={{ background: accent }}
          >
            Practise this skill
          </button>
          <LessonLinkButton skillId={skill.id} className="mt-1.5" />
        </div>
      )}

      {/* Topic list */}
      {!topicId && (
        <div className="space-y-2.5">
          {topicRows.map(({ topic, members, avg, base, delta, strongCount }) => {
            const level = getMasteryLevel(avg)
            return (
              <Card key={topic.id} hover className="p-4" onClick={() => setTopicId(topic.id)}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <MasteryDot level={level} />
                    <span className="font-display font-bold text-ink truncate">{topic.name}</span>
                  </span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-ink-60 text-xs font-mono-data">
                      {base === null ? '—' : `${base}%`}
                    </span>
                    <span className="text-ink-60 text-xs" aria-hidden="true">→</span>
                    <ScoreChip score={avg} size="sm" />
                  </span>
                </div>

                <div className="relative h-2 rounded-full bg-tint-press overflow-hidden">
                  <div className="absolute inset-y-0 left-0 rounded-full opacity-30"
                    style={{ width: `${base ?? 0}%`, backgroundColor: masteryColor(level) }} />
                  <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                    style={{ width: `${avg ?? 0}%`, backgroundColor: masteryColor(level) }} />
                </div>

                <div className="flex items-center justify-between gap-2 mt-2 text-xs font-mono-data">
                  <span className="text-ink-60 truncate">
                    {members.length} skill{members.length === 1 ? '' : 's'}
                    {avg === null
                      ? ' · not assessed'
                      : ` · ${strongCount} strong`}
                  </span>
                  {delta !== null && (
                    <span className={delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {delta >= 0 ? '+' : ''}{delta} pp
                    </span>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Skill drill-down */}
      {topicId && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setTopicId(null); setSkillId(null) }}
              className="flex items-center gap-2 text-navy text-sm font-display active:text-blue transition-colors min-h-[44px] -ml-2 px-2"
            >
              ← All topics
            </button>
            <h3 className="font-display text-lg font-bold text-ink truncate">{topicName(topicId)}</h3>
          </div>

          {subjectSkills.filter(s => s.topicId === topicId).map(s => {
            const level = getMasteryLevel(s.current)
            const accuracy = accuracyOf(s)
            return (
              <Card
                key={s.id}
                hover
                className={`p-4 transition-all ${skillId === s.id ? 'border-blue/20' : ''}`}
                onClick={() => setSkillId(skillId === s.id ? null : s.id)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-display font-semibold text-ink text-sm break-anywhere">{s.name}</span>
                  <MasteryBadge score={s.current} />
                </div>

                <div className="space-y-1.5">
                  {(['base', 'now'] as const).map((label, i) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-ink-60 text-xs w-10 text-right font-mono-data">{label}</span>
                      <ProgressBar
                        value={i === 0 ? s.baseline : s.current}
                        color={masteryColor(level)}
                        className={`flex-1 ${i === 0 ? 'opacity-35' : ''}`}
                      />
                      <span className="font-mono-data text-xs w-8" style={{ color: masteryColor(level) }}>
                        {(i === 0 ? s.baseline : s.current) === null
                          ? '—'
                          : `${i === 0 ? s.baseline : s.current}%`}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 mt-2 text-xs font-mono-data text-ink-60 flex-wrap">
                  {s.current === null ? (
                    <span>Not yet assessed</span>
                  ) : (
                    <>
                      <span>{s.attempts} attempt{s.attempts === 1 ? '' : 's'}</span>
                      {accuracy !== null && <span>{accuracy}% accuracy</span>}
                      {s.baseline !== null && (
                        <span className={s.current - s.baseline >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {s.current - s.baseline >= 0 ? '+' : ''}{s.current - s.baseline} pp
                        </span>
                      )}
                    </>
                  )}
                  <span className="ml-auto">{relativeDate(s.lastPracticedAt)}</span>
                </div>
              </Card>
            )
          })}

          <button
            type="button"
            onClick={() => navigate('/learner/practice')}
            className="w-full rounded-xl border border-line-hover text-ink-70 font-display font-semibold py-3.5 text-sm min-h-[48px] active:bg-tint-press transition-colors"
          >
            Practise these skills
          </button>
        </div>
      )}

      {/* The prescribed assessment plan for this subject — where the learner's
          practice ends and CAPS's own programme begins. */}
      {!topicId && (
        <Card
          hover
          onClick={() => navigate('/learner/programme')}
          className="flex items-center gap-3"
        >
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: `${accent}18`, color: accent }}
            aria-hidden="true"
          >
            ▤
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-ink text-sm">Programme of Assessment</p>
            <p className="text-ink-60 text-xs mt-0.5">
              What CAPS assesses, when, and how it counts
            </p>
          </div>
          <span className="text-ink-60 text-lg flex-shrink-0" aria-hidden="true">›</span>
        </Card>
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  SUBJECT_MAP, getMasteryLevel, masteryColor, masteryLabel,
  subjectAverageOf, subjectTopics, topicAverageOf, weakestSkills, type MasteryLevel,
} from '@/data'
import { useAppStore } from '@/store/AppStore'
import {
  Card, DeltaBadge, EmptyState, MasteryDot, ProgressBar, ScoreChip, SectionLabel, Segmented,
} from '@/components/ui'

const LEVELS: MasteryLevel[] = ['mastered', 'developing', 'weak', 'major-gap']

export default function DiagnosticPage() {
  const navigate = useNavigate()
  const { activeSubjectId, skills } = useAppStore()
  const [tab, setTab] = useState<'results' | 'comparison'>('results')
  const [openTopic, setOpenTopic] = useState<string | null>(null)

  const accent = SUBJECT_MAP[activeSubjectId].color

  const subjectSkills = useMemo(
    () => skills.filter(s => s.subjectId === activeSubjectId),
    [skills, activeSubjectId],
  )
  const topics = useMemo(() => subjectTopics(activeSubjectId), [activeSubjectId])

  const baseline = subjectAverageOf(subjectSkills, activeSubjectId, 'baseline')
  const current = subjectAverageOf(subjectSkills, activeSubjectId)

  const distribution = useMemo(
    () =>
      LEVELS.map(level => ({
        level,
        count: subjectSkills.filter(s => getMasteryLevel(s.baseline) === level).length,
      })),
    [subjectSkills],
  )

  // Weakest by baseline, assessed only. An unassessed skill has no baseline to
  // be weak relative to, so it is not a recommendation.
  const recommendations = useMemo(
    () => weakestSkills(subjectSkills, 4),
    [subjectSkills],
  )

  if (!subjectSkills.length) {
    return (
      <EmptyState
        icon="◈"
        title="No diagnostic data"
        body={`There is no baseline assessment for ${SUBJECT_MAP[activeSubjectId].name} yet.`}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-ink-70 text-xs font-semibold tracking-widest uppercase font-display">Assessment</p>
        <h2 className="font-display text-2xl font-bold text-ink mt-0.5">Diagnostic Report</h2>
        <p className="text-ink-60 text-xs font-mono-data mt-1">
          {SUBJECT_MAP[activeSubjectId].name} · CAPS
        </p>
      </div>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-ink-70 text-xs font-display uppercase tracking-widest mb-1">Baseline</p>
            <ScoreChip score={baseline} size="xl" />
            <p className="text-ink-60 text-xs mt-1 font-mono-data">
              {subjectSkills.length} skills assessed
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-ink-70 text-xs font-display uppercase tracking-widest mb-2">Now</p>
            <ScoreChip score={current} size="lg" />
            <div className="mt-1">
              <DeltaBadge baseline={baseline} current={current} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {distribution.map(({ level, count }) => {
            const color = masteryColor(level)
            return (
              <div key={level} className="rounded-xl p-3 border border-line-hover" style={{ background: `${color}08` }}>
                <div className="flex items-center gap-2 mb-1">
                  <MasteryDot level={level} />
                  <span className="text-xs font-display text-ink-70 truncate">{masteryLabel(level)}</span>
                </div>
                <span className="font-mono-data font-bold" style={{ color }}>{count}</span>
                <span className="text-ink-60 text-xs font-mono-data"> skills</span>
              </div>
            )
          })}
        </div>

        <ProgressBar value={baseline} color={accent} height="h-2" />
      </Card>

      <Segmented
        options={[
          { value: 'results', label: 'Baseline' },
          { value: 'comparison', label: 'Progress' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* Baseline by topic */}
      {tab === 'results' && (
        <div className="space-y-2.5">
          {topics.map(topic => {
            const members = subjectSkills.filter(s => s.topicId === topic.id)
            if (!members.length) return null
            const avg = topicAverageOf(subjectSkills, activeSubjectId, topic.id, 'baseline')
            const level = getMasteryLevel(avg)
            const isOpen = openTopic === topic.id

            return (
              <Card key={topic.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenTopic(isOpen ? null : topic.id)}
                  className="w-full p-4 flex items-center gap-3 text-left min-h-[56px] pressable"
                >
                  <MasteryDot level={level} />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-display font-semibold text-ink truncate">{topic.name}</span>
                      <ScoreChip score={avg} size="sm" />
                    </span>
                    <ProgressBar value={avg} color={masteryColor(level)} />
                  </span>
                  <span className="text-ink-60 text-sm flex-shrink-0" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-line divide-y divide-line">
                    {members.map(skill => {
                      const skillLevel = getMasteryLevel(skill.baseline)
                      return (
                        <div key={skill.id} className="px-4 py-3 flex items-center gap-3">
                          <MasteryDot level={skillLevel} size="xs" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-ink text-sm truncate">{skill.name}</span>
                              {/* `ScoreChip` renders "not assessed" for null. `{skill.baseline}%`
                                  printed the literal text "null%" for every unassessed skill in
                                  the topic, because a topic's members are not filtered to
                                  those with evidence. */}
                              <ScoreChip score={skill.baseline} size="sm" />
                            </div>
                            <ProgressBar value={skill.baseline} color={masteryColor(skillLevel)} className="mt-1.5" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Progress comparison */}
      {tab === 'comparison' && (
        <div className="space-y-2.5">
          {topics.map(topic => {
            const members = subjectSkills.filter(s => s.topicId === topic.id)
            if (!members.length) return null
            const base = topicAverageOf(subjectSkills, activeSubjectId, topic.id, 'baseline')
            const now = topicAverageOf(subjectSkills, activeSubjectId, topic.id)
            const level = getMasteryLevel(now)
            const delta = now === null || base === null ? null : now - base

            return (
              <Card key={topic.id} className="p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="font-display font-semibold text-ink truncate">{topic.name}</span>
                  {delta === null ? (
                    <span className="font-mono-data text-xs text-ink-60">not assessed</span>
                  ) : (
                    <span className={`font-mono-data text-sm font-semibold ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {delta >= 0 ? '+' : ''}{delta} pp
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {(['baseline', 'current'] as const).map((label, i) => {
                    const value = i === 0 ? base : now
                    // `topicAverageOf` returns null when a topic holds no measurements,
                    // and this block is rendered for every topic in the subject.
                    // `{value}%` printed the literal "null%" in that case.
                    if (value === null) {
                      return (
                        <div key={label} className="flex items-center gap-2">
                          <span className="text-ink-60 text-xs font-mono-data w-16 text-right">{label}</span>
                          <ProgressBar
                            value={null}
                            color={masteryColor(level)}
                            className={`flex-1 ${i === 0 ? 'opacity-35' : ''}`}
                          />
                          <span className="font-mono-data text-xs w-8 text-right text-ink-60">—</span>
                        </div>
                      )
                    }
                    return (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-ink-60 text-xs font-mono-data w-16 text-right">{label}</span>
                        <ProgressBar
                          value={value}
                          color={masteryColor(level)}
                          className={`flex-1 ${i === 0 ? 'opacity-35' : ''}`}
                        />
                        <span className="font-mono-data text-xs w-8" style={{ color: masteryColor(level) }}>{value}%</span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card className="p-4">
          <SectionLabel>Recommended Focus</SectionLabel>
          <div className="space-y-3">
            {recommendations.map((skill, i) => (
              <div key={skill.id} className="flex items-center gap-3">
                <span className="font-mono-data text-xs text-ink-60 w-4 flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-ink text-sm truncate">{skill.name}</span>
                    <ScoreChip score={skill.baseline} size="xs" />
                  </div>
                  <ProgressBar value={skill.baseline} color={masteryColor(getMasteryLevel(skill.baseline))} />
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigate('/learner/practice')}
            className="mt-4 w-full rounded-xl text-white font-display font-bold py-3.5 text-sm min-h-[48px] pressable"
            style={{ background: accent }}
          >
            Go to targeted practice →
          </button>
        </Card>
      )}
    </div>
  )
}

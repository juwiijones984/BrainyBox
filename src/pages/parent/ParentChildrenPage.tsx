import { useMemo, useState } from 'react'
import {
  SUBJECTS, accuracyOf, getMasteryLevel, masteryColor, subjectAverageOf, subjectTopics,
  topicAverageOf, weakestSkills, type SubjectId,
} from '@/data'
import { useChildView } from '@/lib/useChildView'
import {
  Card, DeltaBadge, EmptyState, NotAssessed, ProgressBar, ScoreChip, SectionLabel, Segmented,
} from '@/components/ui'

export default function ParentChildrenPage() {
  const { status, activeChild } = useChildView()
  // The subject list comes from the catalogue; the child's enrolment decides
  // which are switched on, and an unassessed child has no enrolment claim yet.
  const [chosen, setChosen] = useState<SubjectId | null>(null)

  const skills = activeChild?.skills ?? []
  const childSubjects = useMemo(
    () => activeChild?.profile.subjects ?? [],
    [activeChild],
  )

  // The default is the child's first enrolled subject, not a hard-coded
  // Mathematics. A learner taking only Physical Sciences would otherwise open a
  // Mathematics page with no segment selected, describing a subject they are
  // not enrolled in. A stored choice wins, so switching subjects and coming
  // back does not reset the page.
  const subjectId = useMemo<SubjectId>(() => {
    if (chosen && childSubjects.includes(chosen)) return chosen
    return childSubjects[0] ?? 'mathematics'
  }, [chosen, childSubjects])

  const subject = SUBJECTS.find(s => s.id === subjectId) ?? SUBJECTS[0]
  const accent = subject.color

  const subjectSkills = useMemo(
    () => skills.filter(s => s.subjectId === subjectId),
    [skills, subjectId],
  )
  const topics = useMemo(() => subjectTopics(subjectId), [subjectId])

  const avg = subjectAverageOf(skills, subjectId)
  const base = subjectAverageOf(skills, subjectId, 'baseline')

  const ranked = useMemo(() => weakestSkills(subjectSkills), [subjectSkills])

  if (status === 'loading' || status === 'idle') {
    return <div className="py-12 text-center text-ink-60 text-sm font-display">Loading…</div>
  }

  if (!activeChild) {
    return (
      <EmptyState
        icon="◇"
        title="No child linked"
        body="Link a child to this parent account and their subject detail appears here."
      />
    )
  }

  if (!subjectSkills.length) {
    return (
      <EmptyState
        icon="◌"
        title="Nothing to show yet"
        body={`There is no skill data for ${subject.name} yet. This page lists real results only, so it stays empty until something has actually been assessed.`}
      />
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-ink-70 text-xs font-semibold tracking-widest uppercase font-display">Parent Portal</p>
        <h2 className="font-display text-2xl font-bold text-ink mt-0.5">Subject Detail</h2>
        <p className="text-ink-60 text-xs font-mono-data mt-1">
          {activeChild.profile.name}
          {activeChild.profile.grade ? ` · Grade ${activeChild.profile.grade}` : ''}
        </p>
      </div>

      {childSubjects.length > 0 ? (
        <Segmented
          options={childSubjects.flatMap(id => {
            const option = SUBJECTS.find(s => s.id === id)
            return option ? [{ value: id, label: option.shortName }] : []
          })}
          value={subjectId}
          onChange={setChosen}
        />
      ) : (
        <NotAssessed
          what={`${activeChild.profile.name}'s subjects`}
          body="No subject has been set on this learner's profile yet, so there is nothing to break down."
        />
      )}

      {/* Headline */}
      <Card className="p-5" style={{ borderColor: `${accent}33` }}>
        <div className="flex items-start gap-3 mb-4">
          <span
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: `${accent}1f`, color: accent }}
            aria-hidden="true"
          >
            {subject.glyph}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-ink text-lg truncate">{subject.name}</p>
            <p className="text-ink-60 text-xs font-mono-data">
              {subject.code} · {subjectSkills.length} skills · {topics.length} topics
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <ScoreChip score={avg} size="lg" />
            <DeltaBadge baseline={base} current={avg} className="block mt-0.5" />
          </div>
        </div>
        <ProgressBar value={avg} color={accent} height="h-2" />
      </Card>

      {/* Topics */}
      <div>
        <SectionLabel>Topics</SectionLabel>
        <div className="space-y-2">
          {topics.map(topic => {
            const members = subjectSkills.filter(s => s.topicId === topic.id)
            if (!members.length) return null
            const topicAvg = topicAverageOf(skills, subjectId, topic.id)
            const topicBase = topicAverageOf(skills, subjectId, topic.id, 'baseline')
            const level = getMasteryLevel(topicAvg)
            // "Best in topic" needs a measurement; with none it is omitted
            // rather than naming whichever skill happened to sort first.
            const best = strongestIn(members)

            return (
              <Card key={topic.id} className="p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="font-display font-bold text-ink truncate">{topic.name}</span>
                  <ScoreChip score={topicAvg} size="sm" />
                </div>
                <ProgressBar value={topicAvg} color={masteryColor(level)} />
                <div className="flex items-center justify-between gap-2 mt-2 text-xs font-mono-data">
                  <span className="text-ink-60 truncate">
                    {best
                      ? `Best: ${best.name} (${best.current}%)`
                      : 'Not yet assessed'}
                  </span>
                  <DeltaBadge baseline={topicBase} current={topicAvg} />
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Every assessed skill, weakest first */}
      {ranked.length > 0 && (
        <div>
          <SectionLabel>Assessed Skills · Weakest First</SectionLabel>
          <div className="space-y-2">
            {ranked.map(skill => {
              const level = getMasteryLevel(skill.current)
              const accuracy = accuracyOf(skill)
              return (
                <Card key={skill.id} className="p-3.5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-display font-semibold text-ink text-sm truncate">{skill.name}</span>
                    <ScoreChip score={skill.current} size="xs" />
                  </div>
                  <div className="space-y-1">
                    {(['Diagnostic', 'Current'] as const).map((label, i) => {
                      const value = i === 0 ? skill.baseline : skill.current
                      return (
                        <div key={label} className="flex items-center gap-2">
                          <span className="text-ink-60 text-xs font-mono-data w-16 text-right">{label}</span>
                          <ProgressBar
                            value={value}
                            color={masteryColor(level)}
                            className={`flex-1 ${i === 0 ? 'opacity-35' : ''}`}
                          />
                          <span className="font-mono-data text-xs w-8 flex-shrink-0" style={{ color: masteryColor(level) }}>
                            {value === null ? '—' : `${value}%`}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-ink-60 text-xs font-mono-data mt-2">
                    {skill.attempts} attempt{skill.attempts === 1 ? '' : 's'}
                    {accuracy === null ? '' : ` · ${accuracy}% accuracy`}
                  </p>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      <p className="text-center text-ink-60 text-xs font-display">
        Real results from the learner's account
      </p>
    </div>
  )
}

/** Highest measured skill in a topic, or null when none has been assessed. */
function strongestIn(members: { id: string; name: string; current: number | null }[]) {
  const assessed = members.filter(m => m.current !== null)
  if (!assessed.length) return null
  return assessed.reduce((best, m) => (m.current! > best.current! ? m : best))
}

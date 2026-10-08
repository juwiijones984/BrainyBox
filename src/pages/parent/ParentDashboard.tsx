import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  SUBJECTS, attemptAverageOf, getMasteryLevel, masteryColor, masteryLabel,
  overallSkillAverageOf, strongestSkills, subjectAverageOf, subjectTopics, topicAverageOf,
} from '@/data'
import { useChildView } from '@/lib/useChildView'
import { Card, DeltaBadge, EmptyState, NcsRatingBadge, NotAssessed, ProgressBar, ScoreChip, SectionLabel, Segmented } from '@/components/ui'

type Tab = 'overview' | 'skills' | 'activity'

export default function ParentDashboard() {
  const navigate = useNavigate()
  const { status, error, children, activeChild, childNeedsDiagnostic, setActiveChildUid } = useChildView()

  const [tab, setTab] = useState<Tab>('overview')
  const [subjectFilter, setSubjectFilter] = useState<string>('all')

  // The child's data, not the parent's own. A parent has no skills of their own.
  const skills = activeChild?.skills ?? []
  const attempts = activeChild?.attempts ?? []
  const revision = activeChild?.revision ?? []

  const now = overallSkillAverageOf(skills)
  const base = overallSkillAverageOf(skills, 'baseline')

  const ranked = useMemo(() => strongestSkills(skills, 1), [skills])
  const strongest = ranked[0] ?? null
  const weakest = useMemo(
    () => {
      const assessed = skills.filter(s => s.current !== null)
      return assessed.length
        ? [...assessed].sort((a, b) => a.current! - b.current!)[0]
        : null
    },
    [skills],
  )

  const totalMinutes = useMemo(
    () => attempts.reduce((sum, a) => sum + a.durationMin, 0),
    [attempts],
  )

  const subjects = useMemo(
    () => SUBJECTS.filter(s => skills.some(skill => skill.subjectId === s.id)),
    [skills],
  )

  const visibleTopics = useMemo(() => {
    if (subjectFilter === 'all') return subjects
    return subjects.filter(s => s.id === subjectFilter)
  }, [subjects, subjectFilter])

  const upcoming = revision.filter(item => !item.complete).slice(0, 3)

  // ── States with no child, or no permission ───────────────────────────────
  if (status === 'unauthorised') {
    return (
      <EmptyState
        icon="⚿"
        title="Parent account required"
        body="This page reads a linked child's real results, so it is only available to an account whose role is parent."
      />
    )
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="py-12 text-center text-ink-60 text-sm font-display">Loading…</div>
    )
  }

  if (status === 'error') {
    return (
      <EmptyState
        icon="⚠"
        title="Could not load your children"
        body={error ?? 'Something went wrong reading Firestore.'}
      />
    )
  }

  if (status === 'no-children' || !activeChild) {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-ink-70 text-xs font-semibold tracking-widest uppercase font-display">Parent Portal</p>
          <h1 className="font-display text-2xl font-bold text-ink mt-0.5">No children linked</h1>
        </div>
        <EmptyState
          icon="◇"
          title="No child is linked to this account"
          body="A child appears here once a parentLinks document connects your account to theirs. Until then there is nothing to show — and nothing is shown in its place."
        />
      </div>
    )
  }

  const child = activeChild.profile
  const assessed = skills.filter(s => s.current !== null).length

  return (
    <div className="space-y-5">
      <div>
        <p className="text-ink-70 text-xs font-semibold tracking-widest uppercase font-display">Parent Portal</p>
        <h1 className="font-display text-2xl font-bold text-ink mt-0.5">{child.name}</h1>
        <p className="text-ink-70 text-xs font-mono-data mt-1">
          {child.grade ? `Grade ${child.grade} · ` : ''}{subjects.length} subject{subjects.length === 1 ? '' : 's'} · CAPS
        </p>
      </div>

      {children.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scroll-x -mx-4 px-4 py-1">
          {children.map(entry => (
            <button
              key={entry.uid}
              type="button"
              // Switching children has to change which child is loaded, not just
              // which button looks pressed. The subject filter is reset with it,
              // because a subject the previous child takes may not be one this
              // child has, and an empty filtered list would read as a gap in
              // their work.
              onClick={() => { setActiveChildUid(entry.uid); setSubjectFilter('all') }}
              aria-pressed={entry.uid === activeChild.uid}
              className="px-3 min-h-[40px] rounded-full text-xs font-display font-semibold whitespace-nowrap flex-shrink-0 transition-colors"
              style={{
                background: entry.uid === activeChild.uid ? 'rgba(2,127,196,0.15)' : 'rgba(5,31,46,0.06)',
                color: entry.uid === activeChild.uid ? '#fff' : 'rgba(5,31,46,0.55)',
              }}
            >
              {entry.profile.name}
            </button>
          ))}
        </div>
      )}

      {/* Summary */}
      <div
        className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #14213d 0%, #1e1b4b 60%, #14213d 100%)' }}
      >
        <div
          className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-15 pointer-events-none"
          style={{ background: '#027FC4', filter: 'blur(50px)', transform: 'translate(30%,-30%)' }}
        />
        <p className="text-ink-70 text-xs font-display uppercase tracking-widest mb-2">Progress</p>

        {now === null ? (
          <NotAssessed what={`${child.name}'s progress`} />
        ) : (
          <>
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <p className="text-ink-70 text-xs font-mono-data">Diagnostic</p>
                <span className="font-display text-xl font-bold" style={{ color: masteryColor(getMasteryLevel(base)) }}>
                  {base === null ? '—' : `${base}%`}
                </span>
              </div>
              <span className="text-ink-60 mb-1" aria-hidden="true">→</span>
              <div>
                <p className="text-ink-70 text-xs font-mono-data">Current</p>
                <span className="font-display text-4xl font-black text-ink">{now}%</span>
              </div>
              <DeltaBadge baseline={base} current={now} className="mb-1.5 ml-auto" />
            </div>
            <ProgressBar value={now} color={masteryColor(getMasteryLevel(now))} height="h-2" className="mt-3" />

            {/* The guide's four Marks Map bands drive every colour in the app. The
                NCS six-point rating is the official reporting scale, so it is shown
                beside them and labelled, never folded into one figure. */}
            <div className="flex items-center gap-3 flex-wrap mt-3 text-ink-70">
              <span className="text-xs font-display">{masteryLabel(getMasteryLevel(now))}</span>
              <span aria-hidden="true">·</span>
              <NcsRatingBadge score={now} />
            </div>
          </>
        )}

        <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-line-hover">
          {[
            { label: 'Sessions', value: attempts.length ? String(attempts.length) : '—' },
            { label: 'Time studied', value: attempts.length ? `${totalMinutes}m` : '—' },
            { label: 'Streak', value: child.streak ? `${child.streak}d` : '—' },
          ].map(item => (
            <div key={item.label} className="text-center min-w-0">
              <p className="text-ink font-mono-data font-bold text-lg">{item.value}</p>
              <p className="text-ink-70 text-[11px] font-display mt-0.5 leading-tight break-anywhere">
                {item.label}
              </p>
            </div>
          ))}
        </div>
        <p className="text-ink-60 text-xs font-mono-data mt-2">
          {assessed} of {skills.length} skills assessed
        </p>
      </div>

      {/* The summary above already reports an unassessed child in its own terms.
          This says the one thing a parent can act on: there is nothing to report
          because the child has not sat the diagnostic yet, and that is the
          child's step to take, not something this portal can do for them. */}
      {childNeedsDiagnostic && (
        <Card className="p-4">
          <p className="text-ink-80 text-sm leading-relaxed">
            {child.name} has not completed the diagnostic yet, so there is no progress to
            report. Everything on this page — the Marks Map, the revision plan and the focus
            areas — is built from real answers, and there are none yet. Once {child.name} sits
            it, their results appear here.
          </p>
        </Card>
      )}

      {/* Key signals */}
      {strongest && weakest && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card className="p-4">
            <p className="text-emerald-400 text-xs font-display uppercase tracking-widest mb-2">Strongest</p>
            <p className="font-display font-bold text-ink text-sm break-anywhere">{strongest.name}</p>
            <p className="text-ink-60 text-xs font-mono-data mt-0.5 truncate">
              {SUBJECTS.find(s => s.id === strongest.subjectId)?.shortName}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <ScoreChip score={strongest.current} size="sm" />
              <DeltaBadge baseline={strongest.baseline} current={strongest.current} />
            </div>
            <ProgressBar value={strongest.current} color="#047857" className="mt-2" />
          </Card>

          <Card className="p-4" style={{ borderColor: 'rgba(244,63,94,0.2)' }}>
            <p className="text-rose-400 text-xs font-display uppercase tracking-widest mb-2">Needs attention</p>
            <p className="font-display font-bold text-ink text-sm break-anywhere">{weakest.name}</p>
            <p className="text-ink-60 text-xs font-mono-data mt-0.5 truncate">
              {SUBJECTS.find(s => s.id === weakest.subjectId)?.shortName}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <ScoreChip score={weakest.current} size="sm" />
              <DeltaBadge baseline={weakest.baseline} current={weakest.current} />
            </div>
            <ProgressBar value={weakest.current} color="#f43f5e" className="mt-2" />
          </Card>
        </div>
      )}

      <Segmented
        options={[
          { value: 'overview', label: 'Subjects' },
          { value: 'skills', label: 'Skills' },
          { value: 'activity', label: 'Activity' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* Subjects */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {visibleTopics.map(subject => {
            const subjectSkills = skills.filter(s => s.subjectId === subject.id)
            const avg = subjectAverageOf(skills, subject.id)
            const subjectBase = subjectAverageOf(skills, subject.id, 'baseline')
            const subjectAttempts = attempts.filter(a => a.subjectId === subject.id)
            const topics = subjectTopics(subject.id)

            return (
              <Card key={subject.id} className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold"
                    style={{ background: `${subject.color}1f`, color: subject.color }}
                    aria-hidden="true"
                  >
                    {subject.glyph}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-ink text-sm truncate">{subject.name}</p>
                    <p className="text-ink-60 text-xs font-mono-data">
                      {subjectAttempts.length} sessions · {subjectSkills.length} skills
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <ScoreChip score={avg} size="sm" />
                    <p className="text-ink-60 text-xs font-mono-data">
                      {subjectBase === null ? 'no baseline' : `${subjectBase}% baseline`}
                    </p>
                  </div>
                </div>

                <ProgressBar value={avg} color={subject.color} />

                <div className="mt-3 space-y-1.5">
                  {topics.map(topic => {
                    const topicAvg = topicAverageOf(skills, subject.id, topic.id)
                    const level = getMasteryLevel(topicAvg)
                    return (
                      <div key={topic.id} className="flex items-center gap-2">
                        <span className="text-ink-70 text-xs font-display w-28 flex-shrink-0 truncate">
                          {topic.name}
                        </span>
                        <ProgressBar value={topicAvg} color={masteryColor(level)} className="flex-1" />
                        <span className="font-mono-data text-xs w-9 text-right flex-shrink-0" style={{ color: masteryColor(level) }}>
                          {topicAvg === null ? '—' : `${topicAvg}%`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          })}

          {upcoming.length > 0 && (
            <Card className="p-4">
              <SectionLabel>Planned This Week</SectionLabel>
              <div className="space-y-2">
                {upcoming.map(item => (
                  <div key={item.id} className="flex items-center gap-2.5">
                    <span className="text-ink-60 text-xs font-mono-data w-16 flex-shrink-0">{item.day}</span>
                    <span className="text-ink-80 text-sm truncate flex-1">{item.topic}</span>
                    <span className="text-ink-60 text-xs font-mono-data flex-shrink-0">{item.durationMin}m</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Skills */}
      {tab === 'skills' && (
        <div className="space-y-2">
          <div className="flex gap-2 overflow-x-auto scroll-x -mx-4 px-4 py-1">
            {[{ id: 'all', shortName: 'All', color: '#014E8C', glyph: '◈' }, ...subjects].map(subject => {
              const active = subjectFilter === subject.id
              return (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => setSubjectFilter(subject.id)}
                  aria-pressed={active}
                  className="px-3 min-h-[40px] rounded-full text-xs font-display font-semibold whitespace-nowrap flex-shrink-0 transition-colors"
                  style={{
                    background: active ? `${subject.color}26` : 'rgba(5,31,46,0.06)',
                    color: active ? '#fff' : 'rgba(5,31,46,0.55)',
                  }}
                >
                  {subject.shortName}
                </button>
              )
            })}
          </div>

          {skills
            .filter(skill => subjectFilter === 'all' || skill.subjectId === subjectFilter)
            .map(skill => {
              const level = getMasteryLevel(skill.current)
              return (
                <Card key={skill.id} className="p-3.5">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-ink text-sm truncate">{skill.name}</p>
                      <p className="text-ink-60 text-xs font-mono-data truncate">
                        {SUBJECTS.find(s => s.id === skill.subjectId)?.shortName} · {skill.topic}
                      </p>
                    </div>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-display" style={{ color: masteryColor(level) }}>
                        {masteryLabel(level)}
                      </span>
                      <ScoreChip score={skill.current} size="xs" />
                    </span>
                  </div>
                  <ProgressBar value={skill.current} color={masteryColor(level)} />
                  <div className="flex items-center justify-between gap-2 mt-1.5 text-xs font-mono-data text-ink-60">
                    <span>{skill.baseline === null ? 'Not yet assessed' : `Diagnostic ${skill.baseline}%`}</span>
                    <DeltaBadge baseline={skill.baseline} current={skill.current} />
                  </div>
                </Card>
              )
            })}
        </div>
      )}

      {/* Activity */}
      {tab === 'activity' && (
        <div className="space-y-3">
          <SectionLabel>Recent Sessions</SectionLabel>
          {attempts.slice(0, 8).map(attempt => {
            const pct = attempt.total ? Math.round((attempt.correct / attempt.total) * 100) : 0
            const level = getMasteryLevel(pct)
            const subject = SUBJECTS.find(s => s.id === attempt.subjectId)
            return (
              <Card key={attempt.id} className="p-3.5 flex items-center gap-3">
                <span
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-mono-data text-xs font-bold"
                  style={{ background: `${masteryColor(level)}18`, color: masteryColor(level) }}
                >
                  {pct}%
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-ink font-display font-semibold text-sm truncate">{attempt.quizTitle}</p>
                  <p className="text-ink-60 text-xs font-mono-data mt-0.5">
                    {attempt.correct}/{attempt.total} correct · {attempt.durationMin} min
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-ink-60 text-xs font-mono-data">{attempt.date.slice(5)}</p>
                  {subject && <p className="text-ink-60 text-[10px] font-mono-data">{subject.shortName}</p>}
                </div>
              </Card>
            )
          })}

          {!attempts.length && (
            <p className="text-ink-60 text-sm text-center py-6">
              {child.name} has not completed any sessions yet.
            </p>
          )}

          <Card className="p-4">
            <SectionLabel>Accuracy by Subject</SectionLabel>
            <div className="space-y-2.5">
              {subjects.map(subject => {
                const subjectAttempts = attempts.filter(a => a.subjectId === subject.id)
                const avg = attemptAverageOf(subjectAttempts)
                return (
                  <div key={subject.id} className="flex items-center gap-2">
                    <span className="text-ink-70 text-xs font-display w-24 flex-shrink-0 truncate">
                      {subject.shortName}
                    </span>
                    <ProgressBar value={avg} color={subject.color} className="flex-1" />
                    <span className="font-mono-data text-xs w-9 text-right text-ink-70 flex-shrink-0">
                      {avg === null ? '—' : `${avg}%`}
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>

          {weakest && (
            <Card className="p-4">
              <p className="text-ink-70 text-xs leading-relaxed">
                Short daily sessions of 15–20 minutes build more mastery than one long session a week. The
                weakest area right now is <span className="text-ink">{weakest.name}</span> — a few focused
                attempts there will move the overall average fastest.
              </p>
            </Card>
          )}
        </div>
      )}

      <button
        type="button"
        // The child lives in the query string, so the link has to carry it. A
        // bare path drops `?child=`, and the detail page would then fall back to
        // the first linked child — showing a parent another child's marks after
        // they had just read this one.
        onClick={() => activeChild && navigate(`/parent/children?child=${activeChild.uid}`)}
        className="w-full rounded-xl border border-line-hover text-ink-80 font-display font-semibold py-3.5 text-sm min-h-[48px] active:bg-tint-press transition-colors"
      >
        View subject detail →
      </button>
    </div>
  )
}

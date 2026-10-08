import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  SUBJECT_MAP, getMasteryLevel, masteryColor, masteryLabel,
  subjectTopics, type TrendDir,
} from '@/data'
import { useAppStore } from '@/store/AppStore'
import { useRoster } from '@/lib/useRoster'
import {
  Card, EmptyState, NcsRatingBadge, NotAssessed, ProgressBar, ScoreChip, SectionLabel, Segmented,
} from '@/components/ui'

const TREND_ICON: Record<TrendDir, string> = { improving: '↑', stable: '→', declining: '↓' }
const TREND_COLOR: Record<TrendDir, string> = { improving: '#047857', stable: '#027FC4', declining: '#f43f5e' }

type Tab = 'class' | 'skills' | 'support'
type Sort = 'score' | 'name' | 'trend'

export default function TeacherDashboard() {
  const navigate = useNavigate()
  const { activeSubjectId, subjects } = useAppStore()
  const roster = useRoster(activeSubjectId)

  const [tab, setTab] = useState<Tab>('class')
  const [sortBy, setSortBy] = useState<Sort>('score')
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)

  const subject = SUBJECT_MAP[activeSubjectId]
  const accent = subject.color

  // Topic and skill figures come from `roster`, which averages over the class's
  // real mastery. They deliberately do not read the signed-in teacher's own
  // `AppStore.skills`: a teacher has no learner progress of their own, so that
  // list is empty and every topic would render as unassessed — a claim about
  // the class that is merely an artefact of who is logged in.
  const topics = useMemo(() => subjectTopics(activeSubjectId), [activeSubjectId])
  const topicStats = roster.topicStats

  const classLearners = roster.learners
  const classAvg = roster.classAverage

  const improving = classLearners.filter(l => l.trend === 'improving').length
  const needsSupport = classLearners.filter(l => getMasteryLevel(l.overallScore) === 'major-gap').length
  // A real count from the attempt history: enrolled learners with no attempt
  // for a week or more. A learner who has never attempted anything is excluded,
  // because they have not gone quiet, they have not started.
  const inactive = roster.inactive

  const sorted = useMemo(() => {
    const list = [...classLearners]
    if (sortBy === 'name') return list.sort((a, b) => a.name.localeCompare(b.name))
    if (sortBy === 'score') {
      return list.sort((a, b) => {
        if (a.overallScore === null) return 1
        if (b.overallScore === null) return -1
        return b.overallScore - a.overallScore
      })
    }
    const order = { improving: 0, stable: 1, declining: 2 }
    return list.sort((a, b) => order[a.trend] - order[b.trend])
  }, [classLearners, sortBy])

  // ── No classes ───────────────────────────────────────────────────────────
  if (roster.status === 'unauthorised') {
    return (
      <EmptyState
        icon="⚿"
        title="Teacher account required"
        body="This page reads real enrolment, so it is only available to an account whose role is teacher."
      />
    )
  }

  if (roster.status === 'loading' && !roster.classes.length) {
    return (
      <div className="py-12 text-center text-ink-60 text-sm font-display">
        Loading your classes…
      </div>
    )
  }

  if (roster.status === 'error') {
    return (
      <EmptyState
        icon="⚠"
        title="Could not load your classes"
        body={roster.error ?? 'Something went wrong reading Firestore.'}
      />
    )
  }

  if (!roster.classes.length) {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-ink-70 text-xs font-semibold tracking-widest uppercase font-display">Teacher Portal</p>
          <h1 className="font-display text-2xl font-bold text-ink mt-0.5">No classes yet</h1>
        </div>
        <EmptyState
          icon="◇"
          title="You are not teaching any classes"
          body="A class appears here once you are set as its teacher in Firestore, and learners appear once they are enrolled. Nothing is shown until both are true, so this list is never a placeholder."
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ink-70 text-xs font-semibold tracking-widest uppercase font-display">Teacher Portal</p>
          <h1 className="font-display text-2xl font-bold text-ink mt-0.5 truncate">
            {roster.activeClass?.name ?? 'Class'}
          </h1>
          <p className="text-ink-70 text-xs font-mono-data mt-1">
            {roster.activeClass?.grade ? `Grade ${roster.activeClass.grade} · ` : ''}{subject.name} · CAPS
          </p>
        </div>
        <span
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: `${accent}1f`, color: accent }}
          aria-hidden="true"
        >
          {subject.glyph}
        </span>
      </div>

      {/* Class summary */}
      <div
        className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, #0f172a 0%, ${accent}22 60%, #0f172a 100%)` }}
      >
        <div
          className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-15 pointer-events-none"
          style={{ background: accent, filter: 'blur(50px)', transform: 'translate(30%,-30%)' }}
        />
        <p className="text-ink-70 text-xs font-display uppercase tracking-widest mb-2">Class Average</p>

        {classAvg === null ? (
          <NotAssessed what={`this class's ${subject.shortName} progress`} />
        ) : (
          <>
            <div className="flex items-end gap-3">
              <span className="font-display text-4xl sm:text-5xl font-black text-ink">{classAvg}%</span>
              <span className="mb-1.5 font-mono-data text-xs" style={{ color: masteryColor(getMasteryLevel(classAvg)) }}>
                {masteryLabel(getMasteryLevel(classAvg))}
              </span>
            </div>
            <ProgressBar value={classAvg} color={accent} height="h-2" className="mt-3" />
            {/* Official NCS rating, kept separate from the guide's Marks Map band. */}
            <div className="mt-3">
              <NcsRatingBadge score={classAvg} />
            </div>
          </>
        )}

        <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-line-hover">
          {[
            { label: 'Learners', value: classLearners.length, color: '#fff' },
            { label: 'Improving', value: improving, color: '#047857' },
            { label: 'Support', value: needsSupport, color: '#f43f5e' },
            { label: 'Inactive', value: inactive, color: '#B45309' },
          ].map(item => (
            <div key={item.label} className="text-center min-w-0">
              <p className="font-mono-data font-bold text-lg" style={{ color: item.color }}>{item.value}</p>
              <p className="text-ink-70 text-[11px] font-display mt-0.5 leading-tight break-anywhere">
                {item.label}
              </p>
            </div>
          ))}
        </div>
        {roster.unassessed > 0 && (
          <p className="text-ink-60 text-xs font-mono-data mt-2">
            Averaged over {roster.assessed} assessed learner{roster.assessed === 1 ? '' : 's'}; {roster.unassessed} not yet assessed.
          </p>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { to: '/teacher/upload', label: 'Upload', glyph: '↑' },
          { to: '/teacher/builder', label: 'Build quiz', glyph: '✎' },
          { to: '/teacher/library', label: 'Library', glyph: '▤' },
        ].map(action => (
          <button
            key={action.to}
            type="button"
            onClick={() => navigate(action.to)}
            className="rounded-xl bg-surface border border-line-hover py-4 flex flex-col items-center gap-1.5 pressable"
          >
            <span className="text-lg" style={{ color: accent }} aria-hidden="true">{action.glyph}</span>
            <span className="text-xs font-display font-semibold text-ink-80">{action.label}</span>
          </button>
        ))}
      </div>

      <Segmented
        options={[
          { value: 'class', label: 'Class' },
          { value: 'skills', label: 'Skills' },
          { value: 'support', label: 'Support' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {/* Class list */}
      {tab === 'class' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-ink-70 text-xs font-display">Sort</span>
            {(['score', 'name', 'trend'] as const).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setSortBy(option)}
                aria-pressed={sortBy === option}
                className="px-3 min-h-[36px] rounded-full text-xs font-display capitalize transition-colors"
                style={{
                  background: sortBy === option ? `${accent}26` : 'rgba(5,31,46,0.06)',
                  color: sortBy === option ? '#fff' : 'rgba(5,31,46,0.55)',
                }}
              >
                {option}
              </button>
            ))}
          </div>

          {classLearners.length === 0 ? (
            <EmptyState
              icon="◇"
              title="No learners enrolled"
              body="Nobody is enrolled in this class yet. Enrolled learners appear here as soon as they are added to the class in Firestore."
            />
          ) : (
            <div className="space-y-2">
              {sorted.map(learner => {
                const level = getMasteryLevel(learner.overallScore)
                return (
                  <Card key={learner.uid} hover className="p-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-xs"
                        style={{ background: `${masteryColor(level)}18`, color: masteryColor(level) }}
                        aria-hidden="true"
                      >
                        {learner.avatar}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="font-display font-semibold text-ink text-sm truncate">{learner.name}</p>
                          <span className="flex items-center gap-2 flex-shrink-0">
                            {learner.overallScore !== null && (
                              <span className="font-mono-data text-xs font-semibold" style={{ color: TREND_COLOR[learner.trend] }}>
                                {TREND_ICON[learner.trend]}
                              </span>
                            )}
                            <ScoreChip score={learner.overallScore} size="xs" />
                          </span>
                        </div>
                        <ProgressBar value={learner.overallScore} color={masteryColor(level)} />
                        <div className="flex items-center justify-between gap-2 mt-1.5 text-xs font-mono-data text-ink-60">
                          <span className="truncate">
                            {learner.weakTopic ? `Weak: ${learner.weakTopic}` : 'Not yet assessed'}
                          </span>
                          <span className="flex-shrink-0">{learner.sessions} sessions</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Skills */}
      {tab === 'skills' && (
        <div className="space-y-3">
          {!selectedTopic ? (
            <>
              <SectionLabel>Topics · class average</SectionLabel>
              {topicStats.map(stat => (
                <Card key={stat.id} hover className="p-4" onClick={() => setSelectedTopic(stat.id)}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-display font-bold text-ink truncate">{stat.name}</span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      {stat.struggling > 0 && (
                        <span className="text-ember text-xs font-mono-data">{stat.struggling} struggling</span>
                      )}
                      <ScoreChip score={stat.average} size="sm" />
                    </span>
                  </div>
                  <ProgressBar value={stat.average} color={masteryColor(getMasteryLevel(stat.average))} />
                  <div className="flex items-center justify-between gap-2 mt-1.5 text-xs font-mono-data text-ink-60">
                    <span>
                      {stat.assessed} of {stat.assessed + stat.unassessed} assessed
                      {stat.baseline === null ? '' : ` · from ${stat.baseline}%`}
                    </span>
                    <span>{masteryLabel(getMasteryLevel(stat.average))}</span>
                  </div>
                </Card>
              ))}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSelectedTopic(null)}
                className="flex items-center gap-2 min-h-[44px] -ml-2 px-2 font-display text-sm active:opacity-70 transition-opacity"
                style={{ color: accent }}
              >
                ← All topics
              </button>
              <h3 className="font-display text-lg font-bold text-ink">
                {topics.find(t => t.id === selectedTopic)?.name}
              </h3>
              {/* Per-skill class detail is not derived here. Showing it would need
                  one aggregate per skill, and a teacher reading a single class
                  average per topic can act on it; a per-skill figure averaged
                  over an arbitrary subset of the class would look more precise
                  than the underlying evidence is. The topic view above and the
                  support list below are the honest granularity. */}
              <EmptyState
                icon="▤"
                title="Per-skill class detail"
                body="Class-level figures are shown per topic above. Individual learners' skill-level results live on each learner's own record, so nothing here can be averaged without deciding how to weight the learners who have evidence and the ones who do not."
              />
              <button
                type="button"
                onClick={() => navigate('/teacher/builder')}
                className="w-full rounded-xl text-white font-display font-bold py-3.5 text-sm min-h-[48px] pressable"
                style={{ background: accent }}
              >
                Build a quiz on this topic →
              </button>
            </>
          )}
        </div>
      )}

      {/* Support */}
      {tab === 'support' && (
        <div className="space-y-4">
          <Card className="p-4 border-orange/13">
            <p className="text-ember text-xs font-display uppercase tracking-widest mb-2">Attention Needed</p>
            <p className="text-ink-80 text-sm leading-relaxed">
              {needsSupport === 0
                ? 'No enrolled learner is below 40% in this class.'
                : `${needsSupport} learner${needsSupport !== 1 ? 's are' : ' is'} below 40%.`}
            </p>
          </Card>

          <SectionLabel>Lowest Scores</SectionLabel>
          {(() => {
            // Only assessed learners can be "lowest": an unassessed learner has
            // no score to be low.
            const struggling = sorted
              .filter(l => l.overallScore !== null && l.overallScore < 60)
              .reverse()
            return struggling.length ? (
              <div className="space-y-2">
                {struggling.map(learner => {
                  const level = getMasteryLevel(learner.overallScore)
                  return (
                    <Card key={learner.uid} className="p-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-xs"
                          style={{ background: `${masteryColor(level)}18`, color: masteryColor(level) }}
                          aria-hidden="true"
                        >
                          {learner.avatar}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <p className="font-display font-semibold text-ink text-sm truncate">{learner.name}</p>
                            <ScoreChip score={learner.overallScore} size="xs" />
                          </div>
                          <ProgressBar value={learner.overallScore} color={masteryColor(level)} />
                          <p className="text-ink-60 text-xs font-mono-data mt-1.5 truncate">
                            {learner.weakTopic ?? 'No weak topic recorded'}
                          </p>
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                icon="✓"
                title={classLearners.length ? 'No learner is below 60%' : 'No learners yet'}
                body={
                  classLearners.length
                    ? 'Nobody enrolled in this class has a measured score below 60% in this subject.'
                    : 'Enrol a learner and their real results will appear here.'
                }
              />
            )
          })()}
        </div>
      )}

      <p className="text-center text-ink-60 text-xs font-display pt-1">
        {subjects.length} subjects available · currently viewing {subject.shortName}
      </p>
    </div>
  )
}

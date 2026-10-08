import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import {
  SUBJECT_MAP, attemptAverageOf, getMasteryLevel, isSkillDrillId, masteryColor,
  subjectAverageOf, subjectQuestions, subjectTopics, topicAverageOf, topicAveragesOf,
  weakestSkills,
} from '@/data'
import { useAppStore } from '@/store/AppStore'
import { useAuth } from '@/store/AuthStore'
import {
  Card, DeltaBadge, EmptyState, MasteryDot, NotAssessed, Pill, ProgressBar, ScoreChip,
  SectionLabel, StatTile,
} from '@/components/ui'
import LessonLinkButton from '@/components/lessons/LessonLinkButton'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { activeSubjectId, skills, quizzes, attempts, resources, status, needsDiagnostic } = useAppStore()
  const { profile } = useAuth()

  const subject = SUBJECT_MAP[activeSubjectId]
  const accent = subject.color

  const view = useMemo(() => {
    const subjectSkillList = skills.filter(s => s.subjectId === activeSubjectId)
    const topics = subjectTopics(activeSubjectId)
    const questions = subjectQuestions(activeSubjectId)

    // Weakest and strongest are chosen from measured skills only. A brand-new
    // learner has neither, and the page says so instead of inventing a focus.
    const weakest = weakestSkills(subjectSkillList, 1)[0] ?? null
    const rankedTopics = topicAveragesOf(skills, activeSubjectId)
    const strongestTopic = rankedTopics.length ? rankedTopics[rankedTopics.length - 1] : null

    const subjectAttempts = attempts.filter(a => a.subjectId === activeSubjectId)
    const minutes = subjectAttempts.reduce((sum, a) => sum + a.durationMin, 0)
    const accuracy = attemptAverageOf(subjectAttempts)

    // Recommend the shortest unattempted diagnostic first. A 10-question module
    // diagnostic gives a usable signal in minutes, where the full baseline is
    // better once the learner knows the short one has not caught everything.
    const unattempted = quizzes.filter(
      q => q.subjectId === activeSubjectId && !subjectAttempts.some(a => a.quizId === q.id),
    )
    const nextQuiz = [...unattempted].sort((a, b) => {
      const kindWeight = (q: typeof a) => (q.kind === 'diagnostic' ? 0 : 1)
      return kindWeight(a) - kindWeight(b) || a.questionIds.length - b.questionIds.length
    })[0] ?? quizzes.find(q => q.subjectId === activeSubjectId)

    const assessed = subjectSkillList.filter(s => s.current !== null).length

    return {
      skills: subjectSkillList, topics, questions, weakest, strongestTopic,
      minutes, accuracy, subjectAttempts, nextQuiz, assessed,
      subjectResources: resources.filter(r => r.subjectId === activeSubjectId),
    }
  }, [skills, quizzes, attempts, resources, activeSubjectId])

  const now = subjectAverageOf(skills, activeSubjectId)
  const base = subjectAverageOf(skills, activeSubjectId, 'baseline')
  const level = getMasteryLevel(now)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = profile?.name.split(' ')[0]

  if (!view.skills.length) {
    return (
      <EmptyState
        icon="📚"
        title="No content yet"
        body={`There are no skills mapped to ${subject.name} yet. A teacher can add a question bank from the teacher portal.`}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-ink-70 text-sm font-medium">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </p>
        <h1 className="font-display text-2xl font-bold text-ink leading-tight mt-0.5">
          {subject.name}
        </h1>
        <p className="text-ink-60 text-xs font-mono-data mt-1">
          {profile?.grade ? `Grade ${profile.grade} · ` : ''}{subject.code} · {view.skills.length} skills
        </p>
      </div>

      {/* Hero */}
      <div
        className="relative overflow-hidden rounded-2xl border border-[#0A67B3] bg-gradient-to-br from-[#082C69] via-[#0754A6] to-[#0789D1] p-5 text-white shadow-[0_12px_32px_rgba(2,75,145,0.20)]"
      >
        <div className="absolute inset-0 opacity-[0.12] pointer-events-none" aria-hidden="true" style={{ backgroundImage: 'linear-gradient(135deg, transparent 48%, #68D8FF 48.2%, transparent 48.8%), linear-gradient(25deg, transparent 70%, #FFFFFF 70.2%, transparent 70.8%)' }} />
        <p className="relative text-xs font-semibold tracking-widest uppercase font-display text-sky-200">
          Overall Progress
        </p>

        {now === null ? (
          <NotAssessed what={`your ${subject.name} progress`} className="mt-3" />
        ) : (
          <div className="flex items-end gap-3 mt-2">
            <span className="font-display text-5xl font-extrabold text-white leading-none">{now}%</span>
            <div className="mb-1 flex flex-col gap-0.5">
              <DeltaBadge baseline={base} current={now} />
              <span className="text-white/70 text-xs">since diagnostic</span>
            </div>
          </div>
        )}

        <ProgressBar
          value={now}
          color={level ? masteryColor(level) : accent}
          height="h-2"
          className="mt-3"
        />
        <div className="flex justify-between mt-1.5 text-xs font-mono-data text-ink-70">
          <span className="text-white/75">
            {view.assessed} of {view.skills.length} skills assessed
            {base !== null && ` · baseline ${base}%`}
          </span>
          <span className="text-white/75">Target 80%</span>
        </div>

        <div className="relative grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/20">
          <div>
            <p className="text-white/70 text-xs font-display">Sessions</p>
            <p className="text-white font-mono-data text-sm font-semibold">{view.subjectAttempts.length}</p>
          </div>
          <div>
            <p className="text-white/70 text-xs font-display">Time</p>
            <p className="text-white font-mono-data text-sm font-semibold">
              {view.subjectAttempts.length ? `${view.minutes} min` : '—'}
            </p>
          </div>
          <div>
            <p className="text-white/70 text-xs font-display">Accuracy</p>
            <p className="text-white font-mono-data text-sm font-semibold">
              {view.accuracy === null ? '—' : `${view.accuracy}%`}
            </p>
          </div>
        </div>
      </div>

      {/* Focus area — only once something has been measured */}
      {view.weakest && view.weakest.current !== null && (
        <Card
          onClick={() => navigate(`/learner/practice/session/${view.weakest!.id}`)}
          className="p-4 border-rose-500/20"
          style={{ borderColor: 'rgba(244,63,94,0.2)', background: 'rgba(244,63,94,0.05)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-rose-400 text-xs" aria-hidden="true">⚠</span>
            <span className="text-rose-400 text-xs font-semibold tracking-widest uppercase font-display">Focus Area</span>
          </div>
          <p className="font-display font-bold text-ink text-lg">{view.weakest.name}</p>
          <div className="flex items-center gap-2 mt-1 mb-3 flex-wrap">
            <ScoreChip score={view.weakest.current} size="sm" />
            <span className="text-ink-60 text-xs">{view.weakest.topic}</span>
            <DeltaBadge baseline={view.weakest.baseline} current={view.weakest.current} />
          </div>
          <ProgressBar
            value={view.weakest.current}
            color={masteryColor(getMasteryLevel(view.weakest.current)!)}
          />
          <div
            className="mt-3 inline-flex items-center gap-2 text-sm font-display font-bold px-4 py-3 rounded-xl text-ink min-h-[48px]"
            style={{ background: accent }}
          >
            Practise this skill →
          </div>

          <LessonLinkButton
            skillId={view.weakest!.id}
            className="mt-1.5"
            label="Not sure why you keep getting it wrong? Read the lesson"
          />
        </Card>
      )}

      {/* Diagnostic prompt for a learner with no evidence at all */}
      {needsDiagnostic && status === 'ready' && (
        <NotAssessed what="any of this subject" diagnosticHref="/learner/diagnostic" />
      )}

      {/* Topics */}
      <div>
        <SectionLabel>Skills by Topic</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          {view.topics.map(topic => {
            const avg = topicAverageOf(skills, activeSubjectId, topic.id)
            const topicBase = topicAverageOf(skills, activeSubjectId, topic.id, 'baseline')
            const topicLevel = getMasteryLevel(avg)
            const count = view.skills.filter(s => s.topicId === topic.id).length
            const assessedHere = view.skills.filter(s => s.topicId === topic.id && s.current !== null).length
            return (
              <Card
                key={topic.id}
                hover
                className="p-4"
                onClick={() => navigate('/learner/marks-map')}
              >
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="text-xs text-ink-70 font-display font-semibold truncate">{topic.name}</span>
                  <MasteryDot level={topicLevel} />
                </div>
                <ScoreChip score={avg} size="lg" />
                <ProgressBar value={avg} color={topicLevel ? masteryColor(topicLevel) : accent} className="mt-2" />
                <p className="text-ink-60 text-xs mt-1 font-mono-data">
                  {avg === null
                    ? `${count} skill${count === 1 ? '' : 's'} · not assessed`
                    // A topic can hold current practice without a baseline ever having
                    // been taken, so these two are null independently. `was ${topicBase}%`
                    // printed "was null%" for anyone who practised before diagnosing.
                    : `${assessedHere}/${count} assessed · ${
                      topicBase === null ? 'no baseline yet' : `was ${topicBase}%`
                    }`}
                </p>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Next test */}
      {view.nextQuiz && (
        <Card onClick={() => navigate(`/learner/tests/${view.nextQuiz!.id}`)} className="p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ink-70 text-xs font-display uppercase tracking-widest">Next Test</p>
            <p className="text-ink font-display font-semibold mt-0.5 truncate">{view.nextQuiz.title}</p>
            <p className="text-ink-70 text-xs mt-0.5 font-mono-data">
              {view.nextQuiz.questionIds.length} questions
              {view.nextQuiz.timeLimitMin ? ` · ${view.nextQuiz.timeLimitMin} min` : ' · untimed'}
            </p>
          </div>
          <span
            className="w-11 h-11 rounded-full flex items-center justify-center text-ink font-bold text-lg flex-shrink-0"
            style={{ background: accent }}
            aria-hidden="true"
          >
            →
          </span>
        </Card>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile
          label="Streak"
          value={profile?.streak ? `${profile.streak} days` : '—'}
          sub={profile?.streak ? 'keep going' : 'no sessions yet'}
          accent="#B45309"
        />
        <StatTile
          label="Strongest"
          value={view.strongestTopic ? `${view.strongestTopic.average}%` : '—'}
          sub={view.strongestTopic?.name ?? 'not assessed'}
          accent="#047857"
        />
        <StatTile
          label="Bank"
          value={`${view.questions.length}`}
          sub="questions"
          accent={accent}
        />
      </div>

      {/* Resources */}
      {view.subjectResources.length > 0 && (
        <div>
          <SectionLabel>Your Files</SectionLabel>
          <div className="space-y-2">
            {view.subjectResources.slice(0, 3).map(resource => (
              <Card key={resource.id} hover className="p-3.5 flex items-center gap-3" onClick={() => navigate('/learner/library')}>
                <Pill color={accent}>{resource.kind.replace('-', ' ')}</Pill>
                <span className="text-ink text-sm font-display truncate flex-1 min-w-0">{resource.title}</span>
                <span className="text-ink-60 text-xs font-mono-data flex-shrink-0">
                  {Math.round(resource.size / 1024)} KB
                </span>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {view.subjectAttempts.length > 0 && (
        <div>
          <SectionLabel>Recent Activity</SectionLabel>
          <div className="space-y-2">
            {view.subjectAttempts.slice(0, 5).map(attempt => {
              const pct = Math.round((attempt.correct / attempt.total) * 100)
              const attemptLevel = getMasteryLevel(pct)
              // A skill drill records its attempt against `skill-<skillId>`, which is
              // not a quiz. Sending that to /learner/tests landed on "Test not found",
              // so a learner who drilled a weak skill could not get back to it from
              // their own history.
              const drill = isSkillDrillId(attempt.quizId)
              const target = drill
                ? `/learner/practice/session/${attempt.quizId.slice('skill-'.length)}`
                : `/learner/tests/${attempt.quizId}`
              return (
                <Card
                  key={attempt.id}
                  hover
                  className="p-3 flex items-center gap-3"
                  onClick={() => navigate(target)}
                >
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-mono-data font-bold"
                    style={{ background: `${masteryColor(attemptLevel!)}18`, color: masteryColor(attemptLevel!) }}
                  >
                    {pct}%
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-ink text-sm font-display font-semibold truncate">{attempt.quizTitle}</span>
                    <span className="block text-ink-60 text-xs font-mono-data">
                      {attempt.correct}/{attempt.total} correct · {attempt.durationMin} min
                      {drill && ' · skill drill'}
                    </span>
                  </span>
                  <span className="text-ink-60 text-xs font-mono-data flex-shrink-0">{attempt.date.slice(5)}</span>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {level && (
        <p className="text-center text-ink-60 text-xs font-display">
          {level === 'mastered' ? 'Mastered' : level === 'developing' ? 'Developing' : level === 'weak' ? 'Weak' : 'Major gap'} in {subject.name} · {subject.pairing}
        </p>
      )}
    </div>
  )
}

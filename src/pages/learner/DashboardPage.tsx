import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import {
  SUBJECT_MAP, getMasteryLevel, lessonForSkill, masteryColor, masteryCoverage,
  subjectAverageOf, weakestSkills,
  type AssessmentKind, type Question, type Quiz, type RevisionItem, type SkillProgress,
} from '@/data'
import { useAppStore } from '@/store/AppStore'
import { useAuth } from '@/store/AuthStore'
import { readSession, resumePath, type SavedSession } from '@/lib/session'
import {
  Button, Card, DeltaBadge, EmptyState, MasteryBadge, Pill, ProgressBar, ScoreChip,
  SectionLabel, StatTile,
} from '@/components/ui'
import LessonLinkButton from '@/components/lessons/LessonLinkButton'

const KIND_LABEL: Record<AssessmentKind, string> = {
  diagnostic: 'Diagnostic',
  practice: 'Practice',
  quiz: 'Quiz',
  test: 'Test',
  exam: 'Exam',
}

const PLAN_STYLE: Record<RevisionItem['type'], { glyph: string; label: string; bg: string; color: string }> = {
  practice: { glyph: '◉', label: 'Practice', bg: 'rgba(16,185,129,0.12)', color: '#047857' },
  lesson: { glyph: '◈', label: 'Lesson', bg: 'rgba(2,127,196,0.12)', color: '#014E8C' },
  'mini-test': { glyph: '⏱', label: 'Mini-test', bg: 'rgba(244,63,94,0.12)', color: '#f43f5e' },
  revision: { glyph: '◷', label: 'Revision', bg: 'rgba(245,158,11,0.12)', color: '#B45309' },
}

/** Where a planned activity actually opens. */
function planTarget(item: RevisionItem): string {
  if (item.type === 'lesson') {
    const lesson = lessonForSkill(item.skillId)
    if (lesson) return `/learner/lessons/${lesson.moduleNumber}/skill/${item.skillId}`
  }
  return `/learner/practice/session/${item.skillId}`
}

/** A stored session only counts if it still points at content the learner has. */
function sessionIsValid(
  session: SavedSession,
  quizzes: Quiz[],
  skills: SkillProgress[],
  questions: Question[],
): boolean {
  if (session.skillId) {
    return skills.some(s => s.id === session.skillId)
      && questions.some(q => q.skillId === session.skillId)
  }
  return quizzes.some(q => q.id === session.quizId)
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { activeSubjectId, skills, quizzes, questions, attempts, revision, status } = useAppStore()
  const { profile, user } = useAuth()

  const subject = SUBJECT_MAP[activeSubjectId]
  const accent = subject.color

  // Device state, read once per mount: the paper the learner left unfinished.
  const storedSession = useMemo(() => readSession(user?.uid ?? null), [user?.uid])

  const view = useMemo(() => {
    const subjectSkills = skills.filter(s => s.subjectId === activeSubjectId)
    const subjectAttempts = attempts.filter(a => a.subjectId === activeSubjectId)

    const hasQuestions = (skill: SkillProgress) => questions.some(q => q.skillId === skill.id)
    const weak = weakestSkills(subjectSkills, 3)
    const unassessed = subjectSkills.filter(s => s.current === null)

    const diagnosticQuiz =
      quizzes
        .filter(q => q.subjectId === activeSubjectId && q.kind === 'diagnostic')
        .sort((a, b) => a.questionIds.length - b.questionIds.length)[0] ?? null

    return {
      subjectSkills,
      coverage: masteryCoverage(subjectSkills),
      baseline: subjectAverageOf(skills, activeSubjectId, 'baseline'),
      current: subjectAverageOf(skills, activeSubjectId),
      minutes: subjectAttempts.reduce((sum, a) => sum + a.durationMin, 0),
      sessions: subjectAttempts.length,
      weak,
      unassessed,
      // A weak skill with no questions cannot be drilled, so practice goes to it
      // only when the bank can actually answer for it.
      practiceTarget: weak.find(hasQuestions) ?? subjectSkills.filter(hasQuestions)[0] ?? null,
      diagnosticQuiz,
      plan: revision.filter(item => item.subjectId === activeSubjectId).slice(0, 3),
      session:
        storedSession && sessionIsValid(storedSession, quizzes, skills, questions)
          ? storedSession
          : null,
    }
  }, [skills, quizzes, questions, attempts, revision, activeSubjectId, storedSession])

  // The single most useful next action, in priority order: finish what is
  // already started, establish a baseline, then work the weakest measured skill.
  const nextStep = useMemo(() => {
    const { session, coverage, diagnosticQuiz, practiceTarget } = view

    if (session) {
      const total = session.questionIds.length
      return {
        cta: 'Continue Learning',
        title: session.quizTitle,
        topic: SUBJECT_MAP[session.subjectId].name,
        why: 'You started this and have not finished it yet, so resuming is the quickest way back into real work.',
        activityType: KIND_LABEL[session.kind],
        duration: `Question ${Math.min(session.index + 1, total)} of ${total}`,
        href: resumePath(session),
      }
    }

    if (coverage.assessed === 0 && diagnosticQuiz) {
      return {
        cta: 'Take Diagnostic',
        title: diagnosticQuiz.title,
        topic: subject.name,
        why: `Nothing has been measured in ${subject.name} yet, so your progress, plan and focus areas have no evidence to build from.`,
        activityType: 'Diagnostic',
        duration: diagnosticQuiz.timeLimitMin
          ? `${diagnosticQuiz.timeLimitMin} min`
          : `${diagnosticQuiz.questionIds.length} questions · untimed`,
        href: `/learner/tests/${diagnosticQuiz.id}`,
      }
    }

    if (practiceTarget) {
      const count = questions.filter(q => q.skillId === practiceTarget.id).length
      const measured = practiceTarget.current !== null
      return {
        cta: 'Start Practice',
        title: practiceTarget.name,
        topic: practiceTarget.topic,
        why: measured
          ? `${practiceTarget.name} is your lowest measured skill at ${practiceTarget.current}%, so it is holding your ${subject.name} average back the most.`
          : `${practiceTarget.name} is the next ${subject.name} skill with questions ready, so it is where practice starts.`,
        activityType: 'Skill practice',
        duration: count
          ? `≈ ${count} min · ${count} question${count === 1 ? '' : 's'}`
          : 'No questions yet',
        href: `/learner/practice/session/${practiceTarget.id}`,
      }
    }

    if (diagnosticQuiz) {
      return {
        cta: 'Take Diagnostic',
        title: diagnosticQuiz.title,
        topic: subject.name,
        why: `A diagnostic would give your ${subject.name} progress and plan a real starting point.`,
        activityType: 'Diagnostic',
        duration: diagnosticQuiz.timeLimitMin
          ? `${diagnosticQuiz.timeLimitMin} min`
          : `${diagnosticQuiz.questionIds.length} questions`,
        href: `/learner/tests/${diagnosticQuiz.id}`,
      }
    }

    return null
  }, [view, subject.name, questions])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = profile?.name.split(' ')[0]

  if (status === 'error') {
    return (
      <EmptyState
        icon="⚠"
        title="Could not load your progress"
        body="Check your connection and reload the page. Your work is safe and will appear here once your progress loads."
      />
    )
  }

  // The store starts from the shipped catalogue, which describes nobody. Holding
  // here is what stops the page flashing "not assessed" before the real data lands.
  if (status !== 'ready') {
    return <div className="py-16 text-center text-ink-60 text-sm font-display">Loading your progress…</div>
  }

  if (!view.subjectSkills.length) {
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
      {/* 1 — Welcome header */}
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={() => navigate('/learner/profile')}
          aria-label="Open your profile"
          className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky to-blue flex items-center justify-center flex-shrink-0 pressable"
        >
          <span className="font-display font-bold text-ink text-base">{profile?.avatar ?? '?'}</span>
        </button>
        <div className="min-w-0">
          <p className="text-ink-70 text-sm font-medium truncate">
            {greeting}{firstName ? `, ${firstName}` : ''}
          </p>
          <h1 className="font-display text-2xl font-bold text-ink leading-tight truncate mt-0.5">
            {subject.name}
          </h1>
          <p className="text-ink-60 text-xs font-mono-data mt-1">
            {profile?.grade ? `Grade ${profile.grade} · ` : ''}{subject.code}
          </p>
        </div>
      </div>

      {/* 2 — Your Next Step */}
      {nextStep && (
        <Card
          className="p-5"
          style={{
            background: `linear-gradient(135deg, ${accent}1f 0%, ${accent}0a 100%)`,
            border: `1px solid ${accent}40`,
          }}
        >
          <p className="text-xs font-semibold tracking-widest uppercase font-display" style={{ color: accent }}>
            Your Next Step
          </p>
          <p className="font-display text-xl font-bold text-ink mt-2 break-anywhere">{nextStep.title}</p>
          <p className="text-ink-70 text-sm mt-1">{nextStep.topic}</p>
          <p className="text-ink-70 text-sm mt-2 leading-relaxed">{nextStep.why}</p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Pill color={accent}>{nextStep.activityType}</Pill>
            <span className="text-ink-60 text-xs font-mono-data">{nextStep.duration}</span>
          </div>
          <Button full size="lg" className="mt-4" onClick={() => navigate(nextStep.href)}>
            {nextStep.cta} →
          </Button>
        </Card>
      )}

      {/* 3 — Your Progress */}
      <div>
        <SectionLabel>Your Progress</SectionLabel>
        <Card className="p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-tint-strong border border-line-hover p-3">
              <p className="text-ink-70 text-xs font-display">Baseline</p>
              <div className="mt-0.5"><ScoreChip score={view.baseline} size="lg" /></div>
            </div>
            <div className="rounded-xl bg-tint-strong border border-line-hover p-3">
              <p className="text-ink-70 text-xs font-display">Latest</p>
              <div className="mt-0.5 flex items-baseline gap-2 flex-wrap">
                <ScoreChip score={view.current} size="lg" />
                <DeltaBadge baseline={view.baseline} current={view.current} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-3">
            <StatTile
              label="Assessed"
              value={`${view.coverage.assessed}/${view.coverage.total}`}
              sub="skills"
              accent={accent}
            />
            <StatTile
              label="Study time"
              value={view.minutes ? `${view.minutes} min` : '—'}
              sub="active"
              accent="#B45309"
            />
            <StatTile
              label="Sessions"
              value={`${view.sessions}`}
              sub="completed"
              accent="#047857"
            />
          </div>

          <Button
            full
            variant="ghost"
            size="sm"
            className="mt-4"
            onClick={() => navigate('/learner/marks-map')}
          >
            View Full Progress →
          </Button>
        </Card>
      </div>

      {/* 4 — Skills to Improve */}
      <div>
        <SectionLabel>Skills to Improve</SectionLabel>

        {view.weak.length > 0 ? (
          <div className="space-y-2.5">
            {view.weak.map(skill => (
              <Card key={skill.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-ink text-sm break-anywhere">{skill.name}</p>
                    <p className="text-ink-60 text-xs font-mono-data mt-0.5">{skill.topic}</p>
                  </div>
                  <MasteryBadge score={skill.current} />
                </div>
                <div className="flex items-center gap-2 mt-2.5">
                  <ProgressBar
                    value={skill.current}
                    color={masteryColor(getMasteryLevel(skill.current))}
                    className="flex-1"
                  />
                  <ScoreChip score={skill.current} size="xs" />
                </div>
                <Button
                  full
                  size="sm"
                  className="mt-3"
                  onClick={() => navigate(`/learner/practice/session/${skill.id}`)}
                >
                  Practise this skill →
                </Button>
                <LessonLinkButton skillId={skill.id} className="mt-1.5" label="Read the lesson" />
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-4">
            <p className="text-ink-70 text-sm leading-relaxed">
              No weak skills have been measured in {subject.name} yet.
            </p>
          </Card>
        )}

        {/* Unassessed skills are kept apart: no evidence is not the same as weak. */}
        {view.unassessed.length > 0 && (
          <Card className="p-4 mt-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-2 h-2 rounded-full border border-dashed border-line-strong flex-shrink-0"
                aria-hidden="true"
              />
              <p className="font-display font-semibold text-ink text-sm">
                {view.unassessed.length} skill{view.unassessed.length === 1 ? '' : 's'} not yet assessed
              </p>
            </div>
            <p className="text-ink-70 text-xs mt-1.5 leading-relaxed">
              These have no assessment evidence, so they are listed separately rather than assumed
              to be weak. A diagnostic is what turns them into a measured score.
            </p>
            <Button
              full
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => navigate('/learner/tests')}
            >
              Take a diagnostic →
            </Button>
          </Card>
        )}
      </div>

      {/* 5 — Today's Study Plan */}
      <div>
        <SectionLabel>Today&rsquo;s Study Plan</SectionLabel>

        {view.plan.length > 0 ? (
          <div className="space-y-2">
            {view.plan.map(item => {
              const style = PLAN_STYLE[item.type]
              const skillName = skills.find(s => s.id === item.skillId)?.name
              return (
                <Card key={item.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: style.bg, color: style.color }}
                      aria-hidden="true"
                    >
                      {style.glyph}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-semibold text-ink text-sm truncate">
                        {skillName ?? item.topic}
                      </p>
                      <p className="text-ink-60 text-xs font-mono-data mt-0.5 truncate">
                        {style.label} · {item.durationMin} min · {item.day} {item.date}
                      </p>
                    </div>
                    <Pill color={item.complete ? '#047857' : '#6b7280'}>
                      {item.complete ? 'Complete' : 'Not started'}
                    </Pill>
                  </div>
                  {!item.complete && (
                    <button
                      type="button"
                      onClick={() => navigate(planTarget(item))}
                      className="mt-2.5 -ml-1 px-1 text-xs font-display min-h-[36px] pressable"
                      style={{ color: accent }}
                    >
                      Start this activity →
                    </button>
                  )}
                </Card>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon="◷"
            title="Nothing planned yet"
            body={view.coverage.assessed === 0
              ? `A study plan is built from your assessed skills. Take the ${subject.name} diagnostic and it will fill in.`
              : `Nothing is scheduled for ${subject.name} right now. Practise a skill and the plan rebuilds around it.`}
          />
        )}
      </div>

      {/* 6 — Continue Learning */}
      {view.session && (
        <div>
          <SectionLabel>Continue Learning</SectionLabel>
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display font-bold text-ink text-sm break-anywhere">
                  {view.session.quizTitle}
                </p>
                <p className="text-ink-60 text-xs font-mono-data mt-0.5">
                  {KIND_LABEL[view.session.kind]} · Question{' '}
                  {Math.min(view.session.index + 1, view.session.questionIds.length)} of{' '}
                  {view.session.questionIds.length}
                </p>
              </div>
              <Pill color={accent}>{SUBJECT_MAP[view.session.subjectId].shortName}</Pill>
            </div>
            <ProgressBar
              value={((view.session.index + 1) / view.session.questionIds.length) * 100}
              color={accent}
              className="mt-3"
            />
            <Button full size="lg" className="mt-3" onClick={() => navigate(resumePath(view.session!))}>
              Resume →
            </Button>
          </Card>
        </div>
      )}
    </div>
  )
}

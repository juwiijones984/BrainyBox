import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  SUBJECTS, attemptAverageOf, masteryCoverage, overallSkillAverageOf,
} from '@/data'
import { parseQuestionBank } from '@/lib/importQuestionBank'
import { useAppStore } from '@/store/AppStore'
import { useAuth } from '@/store/AuthStore'
import { Card, ProgressBar, SectionLabel, Segmented } from '@/components/ui'
import { SignOutButton } from '@/components/layout/SignOutButton'

type Notice = { tone: 'ok' | 'warn' | 'busy'; text: string }

export default function ProfilePage() {
  const navigate = useNavigate()
  const {
    subjects, activeSubjectId, attempts, questions, quizzes, resources, skills,
    setActiveSubject, importQuestions, clearMyData,
  } = useAppStore()
  const { profile, user, isAdmin } = useAuth()

  const [tab, setTab] = useState<'overview' | 'data'>('overview')
  const [notice, setNotice] = useState<Notice | null>(null)

  const totalMinutes = useMemo(
    () => attempts.reduce((sum, a) => sum + a.durationMin, 0),
    [attempts],
  )

  const coverage = useMemo(() => masteryCoverage(skills), [skills])
  const overall = overallSkillAverageOf(skills)

  const bySubject = useMemo(
    () =>
      subjects.map(subject => {
        const subjectAttempts = attempts.filter(a => a.subjectId === subject.id)
        return {
          subject,
          sessions: subjectAttempts.length,
          avg: attemptAverageOf(subjectAttempts),
        }
      }),
    [subjects, attempts],
  )

  // ── Import ───────────────────────────────────────────────────────────────
  const handleImport = async (file: File) => {
    const text = await file.text()
    const result = parseQuestionBank(text, file.name, { subjectId: activeSubjectId })

    if (!result.questions.length) {
      setNotice({
        tone: 'warn',
        text: result.issues[0]?.message ?? 'No questions could be read from that file.',
      })
      return
    }

    // The bank attaches itself to the active subject; the store matches each
    // question onto an existing skill by id or name, and creates one when the
    // bank names a skill the app doesn't have.
    const outcome = importQuestions({
      questions: result.questions,
      subjectId: activeSubjectId,
      topicName: undefined,
      skillName: undefined,
      quizTitle: file.name.replace(/\.[^.]+$/, ''),
      quizKind: 'quiz',
      timeLimitMin: null,
    })

    const skipped = result.issues.length
    const summary = skipped
      ? `Imported ${outcome.added} questions, skipped ${skipped} row${skipped === 1 ? '' : 's'}: ${result.issues[0]?.message}`
      : `Imported ${outcome.added} questions${outcome.newSkills.length ? ` and created ${outcome.newSkills.length} skill(s)` : ''}.`

    setNotice({ tone: 'busy', text: 'Saving your question bank…' })

    // Held in memory the moment it is parsed, but only stored once this
    // resolves. Reporting success over a failed write would produce a quiz that
    // renders empty after a reload, with nothing to indicate why.
    try {
      await outcome.persisted
      setNotice({ tone: skipped ? 'warn' : 'ok', text: summary })
    } catch (error) {
      setNotice({
        tone: 'warn',
        text: `Could not save to the cloud: ${(error as Error).message}. Nothing was stored, so try the import again.`,
      })
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <span className="w-14 h-14 rounded-2xl bg-blue/10 text-navy flex items-center justify-center font-display font-bold text-lg flex-shrink-0">
          {profile?.avatar ?? '?'}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold text-ink truncate">{profile?.name ?? 'Signed in'}</h2>
          <p className="text-ink-60 text-xs font-mono-data mt-0.5 truncate">
            {profile?.grade ? `Grade ${profile.grade} · ` : ''}
            {user?.email}
            {profile?.streak ? ` · ${profile.streak} day streak` : ''}
          </p>
        </div>
      </div>

      <Segmented
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'data', label: 'Data' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {notice && (
        <div
          role="status"
          className={`rounded-xl p-3.5 border text-sm leading-relaxed ${
            notice.tone === 'ok'
              ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-300'
              : notice.tone === 'busy'
                ? 'border-blue/13 bg-blue/5 text-navy'
                : 'border-orange/13 bg-orange/5 text-ember'
          }`}
        >
          {notice.text}
        </div>
      )}

      {tab === 'overview' ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Overall average', value: overall === null ? '—' : `${overall}%` },
              { label: 'Sessions', value: String(attempts.length) },
              { label: 'Study time', value: attempts.length ? `${totalMinutes}m` : '—' },
              // "Assessed" rather than "tracked": the catalogue is the same size
              // for everyone, and reporting it as achievement would be a lie.
              { label: 'Skills assessed', value: `${coverage.assessed}/${coverage.total}` },
            ].map(({ label, value }) => (
              <Card key={label} className="p-3.5 text-center">
                <p className="font-mono-data font-bold text-ink text-xl">{value}</p>
                <p className="text-ink-70 text-xs font-display mt-1">{label}</p>
              </Card>
            ))}
          </div>

          <Card className="p-4">
            <SectionLabel>Active Subject</SectionLabel>
            <div className="space-y-2">
              {subjects.map(subject => {
                const active = activeSubjectId === subject.id
                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => setActiveSubject(subject.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all min-h-[56px] pressable"
                    style={{
                      background: active ? `${subject.color}14` : 'rgba(5,31,46,0.03)',
                      border: `1px solid ${active ? `${subject.color}50` : '#E6EAEB'}`,
                    }}
                  >
                    <span
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold"
                      style={{ background: `${subject.color}1f`, color: subject.color }}
                      aria-hidden="true"
                    >
                      {subject.glyph}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-ink font-display font-semibold text-sm truncate">
                        {subject.name}
                      </span>
                      <span className="block text-ink-60 text-xs font-mono-data">
                        {skills.filter(s => s.subjectId === subject.id).length} skills
                      </span>
                    </span>
                    {active && (
                      <span className="text-xs font-display font-semibold flex-shrink-0" style={{ color: subject.color }}>
                        Active
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </Card>

          <Card className="p-4">
            <SectionLabel>Attempts by Subject</SectionLabel>
            <div className="space-y-3">
              {bySubject.map(({ subject, sessions, avg }) => (
                <div key={subject.id}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-ink-80 text-sm truncate flex items-center gap-2 min-w-0">
                      <span style={{ color: subject.color }} aria-hidden="true">{subject.glyph}</span>
                      <span className="truncate">{subject.shortName}</span>
                    </span>
                    <span className="text-ink-70 font-mono-data text-xs flex-shrink-0">
                      {avg === null ? 'not assessed' : `${avg}%`}
                    </span>
                  </div>
                  <ProgressBar value={avg} color={subject.color} />
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : (
        <>
          <Card className="p-4">
            <SectionLabel>In Your Account</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Questions', value: questions.length },
                { label: 'Quizzes', value: quizzes.length },
                { label: 'Resources', value: resources.length },
                { label: 'Attempts', value: attempts.length },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl bg-tint-strong p-3 text-center border border-line">
                  <p className="font-mono-data font-bold text-ink text-lg">{value}</p>
                  <p className="text-ink-70 text-xs font-display mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            <p className="text-ink-60 text-xs font-mono-data mt-3 leading-relaxed">
              Saved to your account, not to this device. Sign in on another phone or laptop and your
              progress, uploads and revision plan are all here. Clearing this browser's data does not
              affect any of it.
            </p>
          </Card>

          <Card className="p-4 space-y-3">
            <SectionLabel>Import a Question Bank</SectionLabel>
            <p className="text-ink-70 text-xs leading-relaxed">
              Add your own questions to{' '}
              <span className="text-ink-80">{SUBJECTS.find(s => s.id === activeSubjectId)?.name}</span>. A CSV or
              JSON file works; columns named <code className="text-ink-80">question</code>,{' '}
              <code className="text-ink-80">a</code>–<code className="text-ink-80">f</code>,{' '}
              <code className="text-ink-80">answer</code>, <code className="text-ink-80">explanation</code>,{' '}
              <code className="text-ink-80">marks</code>, <code className="text-ink-80">topic</code> and{' '}
              <code className="text-ink-80">skill</code> are all recognised.
            </p>
            <FilePick
              label="Choose a CSV or JSON file"
              accept=".csv,.json,text/csv,application/json"
              onPick={file => void handleImport(file)}
            />
            <p className="text-ink-60 text-xs leading-relaxed">
              Imported questions are grouped into a new quiz you can run immediately. Matching{' '}
              <code className="text-ink-70">skill</code> values attach to your existing skills and move their
              mastery.
            </p>
          </Card>

          <Card className="p-4 space-y-3">
            <SectionLabel>Sign Out</SectionLabel>
            <p className="text-ink-70 text-xs leading-relaxed">
              Your progress stays in your account. Signing in again on any device brings it all back.
            </p>
            <SignOutButton />
          </Card>

          {/* Operator entry point. Rendered only when the `admin` claim is on the
              ID token, so an ordinary learner never sees it. It lives on the
              profile page rather than in the learner header on purpose: the
              header is already carrying the streak chip, the avatar and sign-out,
              and this is not something a student should be one accidental tap
              away from. */}
          {isAdmin && (
            <Card className="p-4 border-orange/10 space-y-2">
              <SectionLabel>Operator</SectionLabel>
              <p className="text-ink-70 text-xs leading-relaxed">
                This account holds the <code className="text-ink-70">admin</code> claim, so it can
                manage classes, enrolment and parent links. Your learner portal is unaffected.
              </p>
              <Link
                to="/admin"
                className="inline-block text-xs font-display font-semibold text-ember active:text-ember min-h-[40px] leading-[40px]"
              >
                Open the admin portal →
              </Link>
            </Card>
          )}

          <Card className="p-4 border-rose-500/20">
            <SectionLabel>Reset</SectionLabel>
            <p className="text-ink-70 text-xs mb-3 leading-relaxed">
              Deletes your attempts, revision progress, imported questions and uploaded files from your
              account. Your sign-in and the study guide's own content are kept, and every assessed skill
              returns to "not yet assessed". This cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => {
                void clearMyData().then(() =>
                  setNotice({ tone: 'warn', text: 'Your attempts and uploads have been deleted.' }),
                )
              }}
              className="w-full rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 font-display font-bold py-3.5 text-sm min-h-[48px] active:bg-rose-500/20 transition-colors"
            >
              Delete my data
            </button>
          </Card>
        </>
      )}

      <button
        type="button"
        onClick={() => navigate('/learner')}
        className="w-full text-ink-60 active:text-ink-80 text-sm font-display min-h-[44px]"
      >
        ← Back to Dashboard
      </button>
    </div>
  )
}

// ── File input as a button ─────────────────────────────────────────────────
function FilePick({
  label, accept, onPick, className = '',
}: {
  label: string
  accept: string
  onPick: (file: File) => void
  className?: string
}) {
  return (
    <label
      className={`rounded-xl border border-dashed border-line-strong p-4 text-center cursor-pointer active:bg-tint-press transition-colors ${className}`}
    >
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={event => {
          const file = event.target.files?.[0]
          if (file) onPick(file)
          // Reset so choosing the same file twice still fires onChange.
          event.target.value = ''
        }}
      />
      <span className="text-ink-70 text-sm font-display">{label}</span>
    </label>
  )
}

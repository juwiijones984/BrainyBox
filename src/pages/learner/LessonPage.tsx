import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  SUBJECT_MAP, getMasteryLevel, lessonForModule, masteryColor,
  moduleDiagnosticQuestions, moduleQuestions,
  type Concept, type WorkedExample,
} from '@/data'
import { useAppStore } from '@/store/AppStore'
import { Button, Card, EmptyState, Pill, SectionLabel } from '@/components/ui'

/**
 * The lesson reader.
 *
 * This is the step the core loop was missing: diagnose, then a weak skill has
 * to send the learner somewhere they can actually read the method, and that
 * page has to send them on to practice. A skill deep-links straight to the
 * concept that teaches it, and every concept links to its own drill.
 */
export default function LessonPage() {
  const { module: moduleParam, skill: skillParam } = useParams<{ module: string; skill?: string }>()
  const navigate = useNavigate()
  const { activeSubjectId, questions, skills } = useAppStore()

  const moduleNumber = Number(moduleParam)
  const lesson = Number.isFinite(moduleNumber) ? lessonForModule(moduleNumber) : undefined
  const focusSkillId = skillParam ?? null

  // Highlight the concept the learner arrived for, and scroll it into view.
  // Tapping a card calls setFocused directly, which this effect leaves alone
  // because the route param has not changed.
  const [focused, setFocused] = useState<string | null>(focusSkillId)
  useEffect(() => setFocused(focusSkillId), [focusSkillId])

  const highlight = useMemo(() => {
    if (!focused) return null
    const concept = lesson?.concepts.find(c => c.skillId === focused)
    if (concept) return { id: concept.id, title: concept.title }
    const example = lesson?.workedExamples.find(w => w.skillId === focused)
    return example ? { id: example.id, title: example.title } : null
  }, [focused, lesson])

  // ── Every hook runs before the not-found branch ───────────────────────────
  // A conditional hook is a hard React error, not a warning: navigating from a
  // real module to a missing one would render one hook fewer than the previous
  // render and unmount the whole tree. The lesson itself is validated below,
  // once no more hooks are pending.
  const subjectId = lesson?.subjectId ?? activeSubjectId

  // Per-skill mastery, so the learner can see which parts of this module are
  // still shaky while they read.
  const skillById = useMemo(
    () => new Map(skills.filter(s => s.subjectId === subjectId).map(s => [s.id, s])),
    [skills, subjectId],
  )

  // A skill can exist in the curriculum and still have no questions written
  // for it, which is what the drill link needs to know.
  const drilledSkills = useMemo(() => {
    const withQuestions = new Set<string>()
    for (const q of questions) withQuestions.add(q.skillId)
    return withQuestions
  }, [questions])

  const highlightRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (focused) highlightRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focused])

  if (!lesson) {
    return (
      <EmptyState
        icon="◈"
        title="Lesson not found"
        body="That module is not in your curriculum. Mathematics has 11 modules, numbered 1 to 11."
        action={<Button className="mt-2" onClick={() => navigate('/learner/marks-map')}>Back to Marks Map</Button>}
      />
    )
  }

  const accent = SUBJECT_MAP[lesson.subjectId].color
  const moduleQs = moduleQuestions(lesson.moduleNumber)
  const diagnostic = moduleDiagnosticQuestions(lesson.moduleNumber)

  const masteryPct = (skillId: string) => {
    const s = skillById.get(skillId)
    return s ? s.current : null
  }

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
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Pill color={accent}>Module {lesson.moduleNumber} of 11</Pill>
          <Pill color="rgba(5,31,46,0.6)">{lesson.termLabel}</Pill>
        </div>
        <h2 className="font-display text-2xl font-bold text-ink mt-2">{lesson.title}</h2>
        <p className="text-ink-70 text-sm mt-1 leading-relaxed">
          {lesson.concepts.length} concepts and {lesson.workedExamples.length} worked examples. Work through the
          examples, then drill the concept you found hardest.
        </p>
      </div>

      {highlight && (
        <Card className="p-3.5 border-l-2" style={{ borderLeftColor: accent }}>
          <p className="text-ink-70 text-xs font-semibold uppercase tracking-widest font-display">
            You came here for
          </p>
          <p className="text-ink text-sm font-semibold font-display mt-1">{highlight.title}</p>
        </Card>
      )}

      <div>
        <SectionLabel>Key vocabulary</SectionLabel>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {lesson.vocabulary.map(v => (
            <span
              key={v}
              className="text-[11px] px-2 py-1 rounded-md bg-tint-strong text-ink-70 font-display"
            >
              {v}
            </span>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Concepts</SectionLabel>
        <div className="space-y-2.5 mt-2">
          {lesson.concepts.map(concept => (
            <div key={concept.id} ref={highlight?.id === concept.id ? highlightRef : undefined}>
              <ConceptCard
                concept={concept}
                accent={accent}
                mastery={masteryPct(concept.skillId)}
                focused={highlight?.id === concept.id}
                onFocus={() => setFocused(concept.skillId)}
                onDrill={() => navigate(`/learner/practice/session/${concept.skillId}`)}
                hasQuestions={drilledSkills.has(concept.skillId)}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Worked examples</SectionLabel>
        <p className="text-ink-70 text-xs mt-1 leading-relaxed">
          Cover the answer and try each one on your own first. The guide is explicit that you should
          not read the memo before you have written your own steps.
        </p>
        <div className="space-y-2.5 mt-2">
          {lesson.workedExamples.map(example => (
            <div key={example.id} ref={highlight?.id === example.id ? highlightRef : undefined}>
              <WorkedExampleCard
                example={example}
                accent={accent}
                mastery={masteryPct(example.skillId)}
                focused={highlight?.id === example.id}
                hasQuestions={drilledSkills.has(example.skillId)}
                onFocus={() => setFocused(example.skillId)}
                onDrill={() => navigate(`/learner/practice/session/${example.skillId}`)}
              />
            </div>
          ))}
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <SectionLabel>Test yourself</SectionLabel>
        <p className="text-ink-70 text-xs leading-relaxed">
          Module {lesson.moduleNumber} has {moduleQs.length} questions: {diagnostic.length} in the
          diagnostic and {moduleQs.length - diagnostic.length} held back for an equivalent retest.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => navigate(`/learner/tests/q-math-drill-m${lesson.moduleNumber}`)}>
            Drill {moduleQs.length - diagnostic.length} questions
          </Button>
          <Button onClick={() => navigate(`/learner/tests/q-math-diag-m${lesson.moduleNumber}`)}>
            Module diagnostic
          </Button>
        </div>
      </Card>

      {activeSubjectId !== lesson.subjectId && (
        <p className="text-ink-60 text-xs text-center">
          You are viewing {SUBJECT_MAP[lesson.subjectId].name} while your active subject is{' '}
          {SUBJECT_MAP[activeSubjectId].name}.
        </p>
      )}
    </div>
  )
}

function ConceptCard({
  concept, accent, mastery, focused, onFocus, onDrill, hasQuestions,
}: {
  concept: Concept
  accent: string
  mastery: number | null
  focused: boolean
  onFocus: () => void
  onDrill: () => void
  hasQuestions: boolean
}) {
  const level = mastery === null ? null : getMasteryLevel(mastery)
  const color = level ? masteryColor(level) : 'rgba(5,31,46,0.12)'

  return (
    // A clickable `Card` renders a <button>, and the drill action below is a button
    // too. `stopPropagation` hid the bubbling click but not the invalid nesting:
    // keyboard activation of the inner control can also fire the outer button's
    // default action, which marked the concept focused when the learner asked to
    // drill it. The card is a plain container and the two actions are siblings.
    <div
      className={`w-full rounded-2xl bg-surface border border-line-hover p-4 transition-colors ${focused ? 'bg-tint-strong border-line-strong' : ''}`}
    >
      <button
        type="button"
        onClick={onFocus}
        className="w-full text-left pressable cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-ink text-sm font-bold font-display leading-snug">{concept.title}</h3>
          {level && (
            <span className="text-[11px] font-display font-semibold shrink-0" style={{ color }}>
              {mastery}%
            </span>
          )}
        </div>
        <p className="text-ink-70 text-xs leading-relaxed mt-2 whitespace-pre-line">{concept.body}</p>
      </button>
      <button
        type="button"
        onClick={onDrill}
        disabled={!hasQuestions}
        className="mt-3 text-xs font-display font-semibold active:opacity-70 transition-opacity disabled:opacity-30 min-h-[32px]"
        style={{ color: accent }}
      >
        {hasQuestions ? 'Practise this →' : 'No questions yet'}
      </button>
    </div>
  )
}

function WorkedExampleCard({
  example, accent, mastery, focused, hasQuestions, onFocus, onDrill,
}: {
  example: WorkedExample
  accent: string
  mastery: number | null
  focused: boolean
  hasQuestions: boolean
  onFocus: () => void
  onDrill: () => void
}) {
  const [revealed, setRevealed] = useState(false)

  // Opening the memo once a learner has read it should not hide it again, so
  // this only ever reveals. Seeding from `focused` in useState was not enough:
  // the initial value is read on mount only, so an example that became focused
  // later by a tap would highlight without ever showing its steps.
  useEffect(() => {
    if (focused) setRevealed(true)
  }, [focused])

  const level = mastery === null ? null : getMasteryLevel(mastery)
  const color = level ? masteryColor(level) : 'rgba(5,31,46,0.12)'

  return (
    // See ConceptCard: a clickable Card is a <button>, so the reveal and drill
    // controls were nested inside another button. The card is a plain container
    // and each action is its own control.
    <div
      className={`w-full rounded-2xl bg-surface border border-line-hover p-4 transition-colors ${focused ? 'bg-tint-strong border-line-strong' : ''}`}
    >
      <button
        type="button"
        onClick={onFocus}
        className="w-full text-left pressable cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-ink text-sm font-bold font-display leading-snug">{example.title}</h3>
          {level && (
            <span className="text-[11px] font-display font-semibold shrink-0" style={{ color }}>
              {mastery}%
            </span>
          )}
        </div>
        <p className="text-ink-80 text-xs mt-1.5 font-mono leading-relaxed">{example.prompt}</p>
      </button>

      {revealed ? (
        <div className="mt-3 space-y-2">
          <ol className="space-y-1.5">
            {example.steps.map((step, i) => (
              <li key={i} className="text-ink-80 text-xs leading-relaxed flex gap-2">
                <span className="text-ink-60 font-display shrink-0">{i + 1}.</span>
                <span className="font-mono">{step}</span>
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-ink-70 leading-relaxed border-t border-line pt-2">
            {example.rationale}
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-3 text-xs font-display font-semibold active:opacity-70 transition-opacity"
          style={{ color: accent }}
        >
          Show the working →
        </button>
      )}

      <button
        type="button"
        onClick={onDrill}
        disabled={!hasQuestions}
        className="mt-3 block text-xs font-display font-semibold active:opacity-70 transition-opacity disabled:opacity-30"
        style={{ color: accent }}
      >
        {hasQuestions ? 'Practise this →' : 'No questions yet'}
      </button>
    </div>
  )
}

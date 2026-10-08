import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  SUBJECTS, SUBJECT_MAP, subjectTopics, totalMarksOf, topicName,
  type AssessmentKind, type Difficulty, type Question, type Quiz, type SubjectId,
} from '@/data'
import { useAppStore } from '@/store/AppStore'
import { Button, Card, EmptyState, FilterRail, Pill, SectionLabel, Segmented, difficultyColor } from '@/components/ui'
import { newId } from '@/lib/storage'

const KIND_LABEL: Record<AssessmentKind, string> = {
  diagnostic: 'Diagnostic',
  practice: 'Practice',
  quiz: 'Quiz',
  test: 'Timed test',
  exam: 'Mock exam',
}

const KIND_NOTE: Record<AssessmentKind, string> = {
  diagnostic: 'Untimed baseline. Marks are recorded per skill to set the starting position.',
  practice: 'Untimed, with feedback after every question.',
  quiz: 'Answers hidden until the whole paper is submitted.',
  test: 'On the clock. No going back once an answer is submitted.',
  exam: 'Full exam conditions. Leaving early submits the paper.',
}

const TIME_PRESETS: { label: string; value: number | null }[] = [
  { label: 'None', value: null },
  { label: '10m', value: 10 },
  { label: '20m', value: 20 },
  { label: '30m', value: 30 },
  { label: '60m', value: 60 },
  { label: '120m', value: 120 },
]

export default function QuizBuilderPage() {
  const navigate = useNavigate()
  const { activeSubjectId, setActiveSubject, questions, skills, createQuiz, createQuizWithQuestions, deleteQuiz } = useAppStore()

  const [subjectId, setSubjectId] = useState<SubjectId>(activeSubjectId)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<AssessmentKind>('quiz')
  const [timeLimitMin, setTimeLimitMin] = useState<number | null>(null)
  const [topicFilter, setTopicFilter] = useState('all')
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all')
  const [picked, setPicked] = useState<string[]>([])
  const [authorOpen, setAuthorOpen] = useState(false)
  const [authorFormat, setAuthorFormat] = useState<'quiz' | 'long'>('quiz')
  const [authorText, setAuthorText] = useState('')
  const [authorChoices, setAuthorChoices] = useState(['', '', '', ''])
  const [authorCorrect, setAuthorCorrect] = useState(0)
  const [authorAnswer, setAuthorAnswer] = useState('')
  const [authorExplanation, setAuthorExplanation] = useState('')
  const [authorMarks, setAuthorMarks] = useState(1)
  const [authorDifficulty, setAuthorDifficulty] = useState<Difficulty>('medium')
  const [authorTopicId, setAuthorTopicId] = useState('')
  const [authorSkillId, setAuthorSkillId] = useState('')
  const [authoredQuestions, setAuthoredQuestions] = useState<Question[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const subject = SUBJECT_MAP[subjectId]
  const accent = subject.color
  const topics = useMemo(() => subjectTopics(subjectId), [subjectId])
  const subjectSkills = useMemo(() => skills.filter(skill => skill.subjectId === subjectId), [skills, subjectId])
  const allQuestions = useMemo(() => [...authoredQuestions, ...questions], [authoredQuestions, questions])

  const pool = useMemo(() => {
    const base = allQuestions.filter(q => q.subjectId === subjectId)
    return base.filter(q => {
      if (topicFilter !== 'all' && q.topicId !== topicFilter) return false
      if (difficulty !== 'all' && q.difficulty !== difficulty) return false
      return true
    })
  }, [allQuestions, subjectId, topicFilter, difficulty])

  const pickedQuestions = useMemo(
    () => picked.map(id => allQuestions.find(q => q.id === id)).filter(Boolean),
    [picked, allQuestions],
  )

  const marks = totalMarksOf(allQuestions, picked)
  const valid = title.trim().length > 1 && picked.length > 0

  const toggle = (id: string) =>
    setPicked(current =>
      current.includes(id) ? current.filter(value => value !== id) : [...current, id],
    )

  const addAuthoredQuestion = () => {
    const text = authorText.trim()
    const choices = authorChoices.map(choice => choice.trim())
    if (!text || (authorFormat === 'quiz' && choices.some(choice => !choice)) || (authorFormat === 'long' && !authorAnswer.trim())) return
    const question: Question = {
      id: newId('q'),
      subjectId,
      topicId: authorTopicId || topics[0]?.id || '',
      skillId: authorSkillId,
      type: authorFormat === 'quiz' ? 'mcq' : 'short',
      difficulty: authorDifficulty,
      text,
      options: authorFormat === 'quiz' ? choices : [],
      correct: authorCorrect,
      accepted: authorFormat === 'long' ? [authorAnswer.trim()] : [],
      explanation: authorExplanation.trim(),
      marks: authorMarks,
      source: 'Teacher authored',
    }
    setAuthoredQuestions(current => [...current, question])
    setPicked(current => [...current, question.id])
    setAuthorText('')
    setAuthorChoices(['', '', '', ''])
    setAuthorAnswer('')
    setAuthorExplanation('')
  }

  const save = async () => {
    if (saving || !valid) return
    setSaving(true)
    setSaveError('')
    const includedAuthored = authoredQuestions.filter(question => picked.includes(question.id))
    const input: Omit<Quiz, 'id' | 'source' | 'createdAt'> = {
      title: title.trim(),
      description: description.trim() || `${picked.length} questions · ${SUBJECT_MAP[subjectId].name}`,
      subjectId,
      kind,
      timeLimitMin: kind === 'practice' ? null : timeLimitMin,
      // A teacher-built quiz is practice or a class test. It does not become an
      // official CAPS task by being written here: doing that requires building
      // it against a prescribed task, which the builder does not yet do.
      capsStatus: 'formative',
      questionIds: picked,
      topicIds: [...new Set(pickedQuestions.map(q => q!.topicId).filter(Boolean))],
      skillIds: [...new Set(pickedQuestions.map(q => q!.skillId).filter(Boolean))],
    }
    try {
      const quiz = includedAuthored.length
        ? await createQuizWithQuestions(input, includedAuthored)
        : createQuiz(input)
      setPicked([])
      setAuthoredQuestions([])
      setTitle('')
      setDescription('')
      navigate(`/learner/tests/${quiz.id}`)
    } catch {
      setSaveError('The paper could not be saved. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div>
        <p className="text-ink-70 text-xs font-semibold tracking-widest uppercase font-display">Teacher Portal</p>
        <h2 className="font-display text-2xl font-bold text-ink mt-0.5">Quiz Builder</h2>
        <p className="text-ink-60 text-xs font-mono-data mt-1">Assemble a paper from the question bank</p>
      </div>

      {/* Subject */}
      <div>
        <SectionLabel>Subject</SectionLabel>
        <div className="flex gap-2 overflow-x-auto scroll-x -mx-4 px-4 py-1">
          {SUBJECTS.map(option => {
            const active = option.id === subjectId
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setSubjectId(option.id)
                  setActiveSubject(option.id)
                  setTopicFilter('all')
                  setPicked([])
                  setAuthorTopicId('')
                  setAuthorSkillId('')
                }}
                aria-pressed={active}
                className="flex items-center gap-2 pl-1.5 pr-3.5 min-h-[44px] rounded-full border flex-shrink-0 transition-colors"
                style={{
                  background: active ? `${option.color}1f` : 'rgba(5,31,46,0.06)',
                  borderColor: active ? `${option.color}66` : '#E6EAEB',
                }}
              >
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                  style={{ background: active ? option.color : 'rgba(5,31,46,0.4)', color: active ? '#fff' : option.color }}
                  aria-hidden="true"
                >
                  {option.glyph}
                </span>
                <span className="text-xs font-display font-bold whitespace-nowrap"
                  style={{ color: active ? '#fff' : 'rgba(5,31,46,0.55)' }}>
                  {option.shortName}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Details */}
      <Card className="p-4 space-y-3">
        <input
          type="text"
          value={title}
          onChange={event => setTitle(event.target.value)}
          placeholder="Paper title, e.g. Algebra Revision Test"
          maxLength={80}
          className="w-full rounded-xl bg-tint-strong border border-line-hover px-3.5 min-h-[48px] font-display font-semibold text-white placeholder:text-ink-60 outline-none focus:border-line-strong transition-colors"
        />
        <input
          type="text"
          value={description}
          onChange={event => setDescription(event.target.value)}
          placeholder="Optional instructions for the learner"
          maxLength={160}
          className="w-full rounded-xl bg-tint-strong border border-line-hover px-3.5 min-h-[44px] text-sm text-white placeholder:text-ink-60 outline-none focus:border-line-strong transition-colors"
        />

        <div>
          <p className="text-ink-70 text-xs font-display uppercase tracking-widest mb-2">Type</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(KIND_LABEL) as AssessmentKind[]).map(option => (
              <button
                key={option}
                type="button"
                onClick={() => setKind(option)}
                aria-pressed={kind === option}
                className="rounded-xl p-3 text-left transition-colors border"
                style={{
                  background: kind === option ? `${accent}1a` : 'rgba(5,31,46,0.06)',
                  borderColor: kind === option ? `${accent}55` : '#E6EAEB',
                }}
              >
                <span className="block font-display font-bold text-xs text-ink">{KIND_LABEL[option]}</span>
                <span className="block text-ink-70 text-[11px] mt-0.5 leading-snug">{KIND_NOTE[option]}</span>
              </button>
            ))}
          </div>
        </div>

        {kind !== 'practice' && (
          <div>
            <p className="text-ink-70 text-xs font-display uppercase tracking-widest mb-2">Time limit</p>
            <div className="flex gap-2 flex-wrap">
              {TIME_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setTimeLimitMin(preset.value)}
                  aria-pressed={timeLimitMin === preset.value}
                  className="px-3 min-h-[40px] rounded-full text-xs font-display font-semibold transition-colors"
                  style={{
                    background: timeLimitMin === preset.value ? accent : 'rgba(5,31,46,0.06)',
                    color: timeLimitMin === preset.value ? '#fff' : 'rgba(5,31,46,0.55)',
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {timeLimitMin === null && (
              <p className="text-ember/80 text-xs mt-2 leading-relaxed">
                No limit set — this will run untimed like a quiz.
              </p>
            )}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <button
          type="button"
          onClick={() => setAuthorOpen(open => !open)}
          aria-expanded={authorOpen}
          className="w-full flex items-center justify-between gap-3 p-4 text-left"
        >
          <span>
            <span className="block font-display font-bold text-ink text-sm">Write your own questions</span>
            <span className="block text-ink-60 text-xs mt-1">Add original items to this paper</span>
          </span>
          <span className="text-blue text-lg" aria-hidden="true">{authorOpen ? '−' : '+'}</span>
        </button>

        {authorOpen && (
          <div className="border-t border-line-hover p-4 space-y-4">
            <div>
              <SectionLabel>Question format</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {([{ id: 'quiz', label: 'Quiz question', note: 'Multiple choice' }, { id: 'long', label: 'Long question', note: 'Written response' }] as const).map(format => (
                  <button
                    key={format.id}
                    type="button"
                    onClick={() => setAuthorFormat(format.id)}
                    aria-pressed={authorFormat === format.id}
                    className="rounded-lg border p-3 text-left transition-colors"
                    style={{ borderColor: authorFormat === format.id ? accent : '#D7E0DC', background: authorFormat === format.id ? `${accent}12` : '#fff' }}
                  >
                    <span className="block font-display font-bold text-sm text-ink">{format.label}</span>
                    <span className="block text-xs text-ink-60 mt-1">{format.note}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-xs font-display font-semibold text-ink-70">
              Question
              <textarea
                value={authorText}
                onChange={event => setAuthorText(event.target.value)}
                rows={authorFormat === 'long' ? 5 : 3}
                maxLength={1600}
                placeholder={authorFormat === 'long' ? 'Write the full problem and any instructions…' : 'Write the question…'}
                className="mt-2 w-full resize-y rounded-lg border border-line-hover bg-white px-3 py-3 text-sm text-ink placeholder:text-ink-60 focus:border-blue focus:outline-none"
              />
            </label>

            {authorFormat === 'quiz' ? (
              <div className="space-y-2">
                <SectionLabel>Answer options · select the correct one</SectionLabel>
                {authorChoices.map((choice, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="author-correct-answer"
                      checked={authorCorrect === index}
                      onChange={() => setAuthorCorrect(index)}
                      aria-label={`Mark option ${index + 1} correct`}
                      className="accent-blue"
                    />
                    <input
                      value={choice}
                      onChange={event => setAuthorChoices(current => current.map((value, i) => i === index ? event.target.value : value))}
                      maxLength={240}
                      placeholder={`Option ${String.fromCharCode(65 + index)}`}
                      className="min-h-11 flex-1 rounded-lg border border-line-hover bg-white px-3 text-sm text-ink placeholder:text-ink-60 focus:border-blue focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-display font-semibold text-ink-70" htmlFor="author-answer">Accepted answer</label>
                <textarea
                  id="author-answer"
                  value={authorAnswer}
                  onChange={event => setAuthorAnswer(event.target.value)}
                  rows={3}
                  maxLength={600}
                  placeholder="Enter the exact answer used for automatic checking"
                  className="w-full resize-y rounded-lg border border-line-hover bg-white px-3 py-3 text-sm text-ink placeholder:text-ink-60 focus:border-blue focus:outline-none"
                />
                <p className="text-xs leading-relaxed text-ink-60">Written answers are checked against this answer. For essays or answers requiring method marks, review learners’ work with them; automatic checking cannot assess equivalent working.</p>
              </div>
            )}

            <label className="block text-xs font-display font-semibold text-ink-70">
              Explanation (optional)
              <textarea
                value={authorExplanation}
                onChange={event => setAuthorExplanation(event.target.value)}
                rows={2}
                maxLength={800}
                placeholder="Add feedback shown during practice"
                className="mt-2 w-full resize-y rounded-lg border border-line-hover bg-white px-3 py-3 text-sm text-ink placeholder:text-ink-60 focus:border-blue focus:outline-none"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-display font-semibold text-ink-70">
                Topic
                <select value={authorTopicId || topics[0]?.id || ''} onChange={event => setAuthorTopicId(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-line-hover bg-white px-3 text-sm text-ink">
                  {topics.map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
                </select>
              </label>
              <label className="text-xs font-display font-semibold text-ink-70">
                Skill (optional)
                <select value={authorSkillId} onChange={event => setAuthorSkillId(event.target.value)} className="mt-2 min-h-11 w-full rounded-lg border border-line-hover bg-white px-3 text-sm text-ink">
                  <option value="">Not linked</option>
                  {subjectSkills.map(skill => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
                </select>
              </label>
              <label className="text-xs font-display font-semibold text-ink-70">
                Difficulty
                <select value={authorDifficulty} onChange={event => setAuthorDifficulty(event.target.value as Difficulty)} className="mt-2 min-h-11 w-full rounded-lg border border-line-hover bg-white px-3 text-sm text-ink">
                  <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
                </select>
              </label>
              <label className="text-xs font-display font-semibold text-ink-70">
                Marks
                <input type="number" min={1} max={100} value={authorMarks} onChange={event => setAuthorMarks(Math.min(100, Math.max(1, Number(event.target.value) || 1)))} className="mt-2 min-h-11 w-full rounded-lg border border-line-hover bg-white px-3 text-sm text-ink" />
              </label>
            </div>

            <Button
              full
              variant="secondary"
              disabled={!authorText.trim() || (authorFormat === 'quiz' ? authorChoices.some(choice => !choice.trim()) : !authorAnswer.trim())}
              onClick={addAuthoredQuestion}
            >
              Add question to paper
            </Button>
          </div>
        )}
      </Card>

      {/* Filters */}
      <div className="space-y-2">
        <FilterRail
          options={[
            { value: 'all', label: `All topics (${allQuestions.filter(q => q.subjectId === subjectId).length})` },
            ...topics.map(topic => ({
              value: topic.id,
              label: `${topic.name} (${allQuestions.filter(q => q.topicId === topic.id).length})`,
            })),
          ]}
          value={topicFilter}
          onChange={setTopicFilter}
          accent={accent}
        />
        <Segmented
          options={[
            { value: 'all', label: 'Any' },
            { value: 'easy', label: 'Easy' },
            { value: 'medium', label: 'Medium' },
            { value: 'hard', label: 'Hard' },
          ]}
          value={difficulty}
          onChange={setDifficulty}
        />
      </div>

      {/* Picker */}
      <div className="flex items-center justify-between gap-2">
        <SectionLabel className="mb-0">
          {pool.length} question{pool.length === 1 ? '' : 's'} available
        </SectionLabel>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPicked(pool.map(q => q.id))}
            className="text-xs font-display active:opacity-60 transition-opacity text-ink-70 min-h-[36px] px-2"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={() => setPicked([])}
            className="text-xs font-display active:opacity-60 transition-opacity text-ink-70 min-h-[36px] px-2"
          >
            Clear
          </button>
        </div>
      </div>

      {!pool.length ? (
        <EmptyState
          icon="◌"
          title="No questions match"
          body="Upload a question bank for this subject, or widen the filters."
          action={
            <Button className="mt-2" variant="secondary" onClick={() => navigate('/teacher/upload')}>
              Upload questions
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {pool.map(question => {
            const selected = picked.includes(question.id)
            const colour = difficultyColor(question.difficulty)
            return (
              <button
                key={question.id}
                type="button"
                onClick={() => toggle(question.id)}
                aria-pressed={selected}
                className="w-full text-left rounded-2xl p-3.5 border transition-colors pressable"
                style={{
                  background: selected ? `${accent}14` : '#FFFFFF',
                  borderColor: selected ? `${accent}55` : '#E6EAEB',
                }}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      borderColor: selected ? accent : 'rgba(5,31,46,0.12)',
                      background: selected ? accent : 'transparent',
                    }}
                    aria-hidden="true"
                  >
                    {selected && <span className="text-ink text-[10px]">✓</span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-ink text-sm leading-snug break-anywhere">{question.text}</span>
                    <span className="flex items-center gap-2 mt-2 flex-wrap">
                      <span
                        className="text-[10px] font-mono-data px-1.5 py-0.5 rounded"
                        style={{ background: colour.bg, color: colour.color }}
                      >
                        {question.difficulty}
                      </span>
                      <span className="text-ink-60 text-[10px] font-mono-data">
                        {question.type === 'mcq' ? 'multiple choice' : question.type === 'true-false' ? 'true/false' : 'short answer'}
                      </span>
                      {question.source === 'Teacher authored' && <span className="text-blue text-[10px] font-mono-data">your question</span>}
                      <span className="text-ink-60 text-[10px] font-mono-data">{question.marks} marks</span>
                      {question.topicId && (
                        <span className="text-ink-60 text-[10px] font-mono-data truncate">{topicName(question.topicId)}</span>
                      )}
                    </span>
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Sticky summary */}
      <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-surface/95 backdrop-blur-xl border-t border-line-hover sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-3 mb-2.5">
          <span className="flex items-center gap-2 flex-wrap">
            <Pill color={accent}>{picked.length} selected</Pill>
            <Pill color="#94a3b8">{marks} marks</Pill>
            {timeLimitMin !== null && kind !== 'practice' && <Pill color="#B45309">{timeLimitMin} min</Pill>}
          </span>
          {picked.length > 0 && (
            <button
              type="button"
              onClick={() => setPicked([])}
              className="ml-auto text-xs font-display text-ink-60 active:text-ink-80 min-h-[36px] px-2"
            >
              Reset
            </button>
          )}
        </div>
        {saveError && <p role="alert" className="mb-2 text-sm text-rose-600">{saveError}</p>}
        <Button full size="lg" disabled={!valid || saving} onClick={() => void save()} style={{ background: accent }}>
          {saving ? 'Saving paper…' : valid ? 'Save & preview paper' : picked.length ? 'Give the paper a title' : 'Select questions'}
        </Button>
      </div>

      <p className="text-ink-60 text-xs font-display text-center">
        {skills.filter(s => s.subjectId === subjectId).length} skills mapped in {subject.shortName}
      </p>

      <ExistingQuizzes onDelete={deleteQuiz} />
    </div>
  )
}

// ── Already-built papers ───────────────────────────────────────────────────
function ExistingQuizzes({ onDelete }: { onDelete: (id: string) => void }) {
  const navigate = useNavigate()
  const { quizzes } = useAppStore()
  const [open, setOpen] = useState(false)

  const custom = quizzes.filter(q => q.source !== 'seed')
  if (!custom.length) return null

  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 min-h-[48px] pressable"
      >
        <span className="font-display font-bold text-ink text-sm">
          Your papers ({custom.length})
        </span>
        <span className="text-ink-60 text-sm" aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="space-y-2 mt-2">
          {custom.map(quiz => (
            <div
              key={quiz.id}
              className="rounded-xl bg-surface border border-line-hover p-3.5 flex items-center gap-3"
            >
              <button
                type="button"
                onClick={() => navigate(`/learner/tests/${quiz.id}`)}
                className="flex-1 min-w-0 text-left pressable min-h-[40px]"
              >
                <span className="block text-ink text-sm font-display font-semibold truncate">{quiz.title}</span>
                <span className="block text-ink-60 text-xs font-mono-data truncate">
                  {KIND_LABEL[quiz.kind]} · {quiz.questionIds.length} questions
                  {quiz.timeLimitMin ? ` · ${quiz.timeLimitMin} min` : ''}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(quiz.id)}
                aria-label={`Delete ${quiz.title}`}
                className="w-10 h-10 rounded-xl text-rose-400/50 active:text-rose-400 active:bg-rose-500/10 flex items-center justify-center flex-shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

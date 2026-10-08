import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { Question, Quiz } from '@/data'
import { skillQuizId } from '@/data'
import { useAppStore } from '@/store/AppStore'
import QuizRunner from '@/components/quiz/QuizRunner'
import { Button, EmptyState } from '@/components/ui'

/**
 * Ad-hoc practice on a single skill.
 *
 * The quiz is synthesised in memory rather than saved, so a learner can drill
 * a skill as often as they like without flooding the tests list. Attempts
 * still update mastery, because the attempt records its own question order.
 */
export default function SkillPracticePage() {
  const { skillId } = useParams<{ skillId: string }>()
  const navigate = useNavigate()
  const { skills, questions } = useAppStore()

  const skill = skills.find(s => s.id === skillId)
  const pool = useMemo(
    () => questions.filter(q => q.skillId === skillId),
    [questions, skillId],
  )

  // Order easy → hard so a drill builds from the foundations up.
  const ranked = useMemo(() => {
    const weight = { easy: 0, medium: 1, hard: 2 } as const
    return [...pool].sort((a, b) => weight[a.difficulty] - weight[b.difficulty])
  }, [pool])

  if (!skill) {
    return (
      <EmptyState
        icon="◌"
        title="Skill not found"
        body="This skill is no longer in your curriculum. Head back to the practice hub and pick another."
        action={<Button className="mt-2" onClick={() => navigate('/learner/practice')}>Back to Practice</Button>}
      />
    )
  }

  if (!ranked.length) {
    return (
      <EmptyState
        icon="📄"
        title={`No questions for ${skill.name} yet`}
        body="This skill is in your curriculum but has no questions in the bank. A teacher can upload a question bank to fill it."
        action={<Button className="mt-2" onClick={() => navigate('/learner/practice')}>Back to Practice</Button>}
      />
    )
  }

  const adHoc: Quiz = {
    // Mirrors the id `SkillPracticePage` records drills under, so Recent Activity
    // can tell a drill from a real quiz and route back here rather than to a
    // `/learner/tests/{id}` page that would render "Test not found".
    id: skillQuizId(skill.id),
    title: skill.name,
    description: skill.topic,
    subjectId: skill.subjectId,
    topicIds: [skill.topicId],
    skillIds: [skill.id],
    questionIds: ranked.map(q => q.id),
    kind: 'practice',
    timeLimitMin: null,
    capsStatus: 'formative',
    source: 'seed',
    createdAt: '',
  }

  const byId = new Map<string, Question>(questions.map(q => [q.id, q]))
  const ordered = ranked.map(q => byId.get(q.id)!).filter(Boolean)

  return (
    <QuizRunner
      quiz={adHoc}
      questions={ordered}
      mode="practice"
      onExit={() => navigate('/learner/practice')}
      footer={
        <div className="space-y-2">
          <Button full variant="ghost" onClick={() => navigate('/learner/practice')}>
            More practice
          </Button>
          <button
            type="button"
            onClick={() => navigate('/learner')}
            className="w-full text-center text-ink-60 active:text-ink-80 text-sm font-display transition-colors min-h-[44px]"
          >
            Back to Dashboard
          </button>
        </div>
      }
    />
  )
}

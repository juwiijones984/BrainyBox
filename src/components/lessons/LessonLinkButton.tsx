import { useNavigate } from 'react-router'
import { lessonForSkill } from '@/data'

/**
 * The "read the lesson first" affordance for a weak skill.
 *
 * Renders nothing when the subject has no lesson content yet, so subjects that
 * are still seeded placeholders do not get a dead link.
 */
export default function LessonLinkButton({
  skillId,
  className = '',
  label = 'Read the lesson first',
}: {
  skillId: string
  className?: string
  label?: string
}) {
  const navigate = useNavigate()
  const lesson = lessonForSkill(skillId)

  if (!lesson) return null

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        navigate(`/learner/lessons/${lesson.moduleNumber}/skill/${skillId}`)
      }}
      className={`w-full rounded-xl text-ink-80 font-display font-semibold py-2.5 text-xs min-h-[44px] pressable active:text-white ${className}`}
    >
      {label} →
    </button>
  )
}

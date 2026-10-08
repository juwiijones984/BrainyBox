import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { SUBJECT_MAP, getMasteryLevel, masteryColor, type RevisionItem } from '@/data'
import { useAppStore } from '@/store/AppStore'
import { Card, EmptyState, SectionLabel } from '@/components/ui'

const TYPE_STYLE: Record<RevisionItem['type'], { bg: string; color: string; glyph: string; label: string }> = {
  'practice':  { bg: 'rgba(16,185,129,0.12)',  color: '#047857', glyph: '◉', label: 'Practice' },
  'lesson':    { bg: 'rgba(2,127,196,0.12)',   color: '#014E8C', glyph: '◈', label: 'Lesson' },
  'mini-test': { bg: 'rgba(244,63,94,0.12)',    color: '#f43f5e', glyph: '⏱', label: 'Mini-test' },
  'revision':  { bg: 'rgba(245,158,11,0.12)',   color: '#B45309', glyph: '◷', label: 'Revision' },
}

export default function RevisionPage() {
  const navigate = useNavigate()
  const { revision, skills, toggleRevisionItem, activeSubjectId } = useAppStore()

  const accent = SUBJECT_MAP[activeSubjectId].color

  const done = revision.filter(i => i.complete).length
  const totalMinutes = revision.reduce((sum, i) => sum + i.durationMin, 0)
  const percent = revision.length ? Math.round((done / revision.length) * 100) : 0

  // Split on the first incomplete day: everything up to it is "this week".
  const splitIndex = revision.findIndex(i => !i.complete)
  const thisWeek = splitIndex === -1 ? revision : revision.slice(0, splitIndex)
  const nextUp = splitIndex === -1 ? [] : revision.slice(splitIndex)

  const planSkills = useMemo(() => {
    const ids = [...new Set(revision.map(i => i.skillId))]
    return ids
      .map(id => skills.find(s => s.id === id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
  }, [revision, skills])

  if (!revision.length) {
    return (
      <EmptyState
        icon="◷"
        title="No revision plan"
        body="A revision plan is generated from your skill data. Practise a few skills and it will build itself."
      />
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-ink-70 text-xs font-semibold tracking-widest uppercase font-display">Study Schedule</p>
        <h2 className="font-display text-2xl font-bold text-ink mt-0.5">Revision Plan</h2>
        <p className="text-ink-60 text-xs font-mono-data mt-1">Built from your weakest skills</p>
      </div>

      {/* Progress */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-ink-70 text-xs font-display uppercase tracking-widest">Overall</p>
            <p className="font-display font-bold text-ink text-lg mt-0.5">
              {done} of {revision.length} sessions
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <span className="font-mono-data text-3xl font-black text-ink">{percent}%</span>
            <p className="text-ink-60 text-xs font-mono-data">{totalMinutes} min planned</p>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-tint-press overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${percent}%`, background: accent }}
          />
        </div>
      </Card>

      {/* This week */}
      {thisWeek.length > 0 && (
        <div>
          <SectionLabel>Completed & In Progress</SectionLabel>
          <div className="space-y-2">
            {thisWeek.map(item => (
              <PlanRow key={item.id} item={item} onToggle={toggleRevisionItem} onOpen={navigate} />
            ))}
          </div>
        </div>
      )}

      {/* Next up */}
      {nextUp.length > 0 && (
        <div>
          <SectionLabel>Coming Up</SectionLabel>
          <div className="space-y-2">
            {nextUp.map(item => (
              <PlanRow key={item.id} item={item} onToggle={toggleRevisionItem} onOpen={navigate} />
            ))}
          </div>
        </div>
      )}

      {/* Skills in the plan */}
      {planSkills.length > 0 && (
        <Card className="p-4">
          <SectionLabel>Skills in This Plan</SectionLabel>
          <div className="space-y-2">
            {planSkills.map(skill => {
              const level = getMasteryLevel(skill.current)
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => navigate(`/learner/practice/session/${skill.id}`)}
                  className="w-full flex items-center gap-3 text-left pressable min-h-[40px]"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: masteryColor(level) }}
                  />
                  <span className="text-ink-80 text-sm truncate flex-1">{skill.name}</span>
                  <span className="text-ink-60 text-xs font-mono-data flex-shrink-0">
                    {SUBJECT_MAP[skill.subjectId]?.shortName}
                  </span>
                  <span className="font-mono-data text-xs flex-shrink-0" style={{ color: masteryColor(level) }}>
                    {skill.current}%
                  </span>
                </button>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Row ────────────────────────────────────────────────────────────────────
function PlanRow({
  item,
  onToggle,
  onOpen,
}: {
  item: RevisionItem
  onToggle: (id: string) => void
  onOpen: ReturnType<typeof useNavigate>
}) {
  const style = TYPE_STYLE[item.type]
  const subject = SUBJECT_MAP[item.subjectId]

  return (
    <div
      className="rounded-xl bg-surface border overflow-hidden transition-all"
      style={{ borderColor: item.complete ? 'rgba(16,185,129,0.2)' : '#E6EAEB' }}
    >
      <div className="p-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onToggle(item.id)}
          aria-label={item.complete ? `Mark ${item.topic} incomplete` : `Mark ${item.topic} complete`}
          aria-pressed={item.complete}
          className="w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all pressable"
          style={{
            borderColor: item.complete ? '#047857' : '#C3D0D5',
            background: item.complete ? '#047857' : 'transparent',
          }}
        >
          {item.complete && <span className="text-ink text-xs" aria-hidden="true">✓</span>}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-display font-bold text-ink-60 text-xs uppercase tracking-widest">{item.day}</span>
            <span className="text-ink-60 text-xs font-mono-data">{item.date}</span>
            {subject && (
              <span className="text-[10px] font-mono-data px-1.5 rounded" style={{ background: `${subject.color}1f`, color: subject.color }}>
                {subject.shortName}
              </span>
            )}
          </div>
          <p className={`font-display font-semibold text-sm break-anywhere ${item.complete ? 'text-ink-60 line-through' : 'text-ink'}`}>
            {item.topic}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-ink-60 text-xs font-mono-data">{item.durationMin}m</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-display font-semibold whitespace-nowrap"
            style={{ background: style.bg, color: style.color }}
          >
            {style.glyph} {style.label}
          </span>
        </div>
      </div>

      {!item.complete && (
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => onOpen(`/learner/practice/session/${item.skillId}`)}
            className="text-xs font-display active:text-navy transition-colors min-h-[36px] -ml-1 px-1"
            style={{ color: SUBJECT_MAP[item.subjectId]?.color ?? '#0291D3' }}
          >
            Start session →
          </button>
        </div>
      )}
    </div>
  )
}

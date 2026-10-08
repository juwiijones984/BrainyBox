import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { SUBJECTS, SUBJECT_MAP, type Resource } from '@/data'
import { useAppStore } from '@/store/AppStore'
import { NoResources, ResourceRow, ResourceSheet } from '@/components/library'
import { Card, FilterRail, Pill, SectionLabel, Segmented } from '@/components/ui'

export default function TeacherLibraryPage() {
  const navigate = useNavigate()
  const { activeSubjectId, setActiveSubject, resources, deleteResource } = useAppStore()

  const [scope, setScope] = useState<'subject' | 'all'>('subject')
  const [kind, setKind] = useState<Resource['kind'] | 'all'>('all')
  const [open, setOpen] = useState<Resource | null>(null)

  const accent = SUBJECT_MAP[activeSubjectId].color

  const scoped = useMemo(
    () => (scope === 'subject' ? resources.filter(r => r.subjectId === activeSubjectId) : resources),
    [resources, scope, activeSubjectId],
  )

  const visible = useMemo(
    () => (kind === 'all' ? scoped : scoped.filter(r => r.kind === kind)).slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [scoped, kind],
  )

  const counts = useMemo(
    () => ({
      all: scoped.length,
      notes: scoped.filter(r => r.kind === 'notes').length,
      'past-paper': scoped.filter(r => r.kind === 'past-paper').length,
      worksheet: scoped.filter(r => r.kind === 'worksheet').length,
      image: scoped.filter(r => r.kind === 'image').length,
    }),
    [scoped],
  )

  return (
    <div className="space-y-5">
      <div>
        <p className="text-ink-70 text-xs font-semibold tracking-widest uppercase font-display">Teacher Portal</p>
        <h2 className="font-display text-2xl font-bold text-ink mt-0.5">Library</h2>
        <p className="text-ink-60 text-xs font-mono-data mt-1">
          {resources.length} file{resources.length === 1 ? '' : 's'} across all subjects
        </p>
      </div>

      <Segmented
        options={[
          { value: 'subject', label: SUBJECT_MAP[activeSubjectId].shortName },
          { value: 'all', label: 'All subjects' },
        ]}
        value={scope}
        onChange={setScope}
      />

      {scope === 'subject' ? (
        <div className="flex gap-2 overflow-x-auto scroll-x -mx-4 px-4 py-1">
          {SUBJECTS.map(option => (
            <button
              key={option.id}
              type="button"
              onClick={() => setActiveSubject(option.id)}
              aria-pressed={activeSubjectId === option.id}
              className="px-3 min-h-[40px] rounded-full text-xs font-display font-semibold whitespace-nowrap flex-shrink-0 transition-colors"
              style={{
                background: activeSubjectId === option.id ? `${option.color}26` : 'rgba(5,31,46,0.06)',
                color: activeSubjectId === option.id ? '#fff' : 'rgba(5,31,46,0.55)',
              }}
            >
              {option.shortName}
            </button>
          ))}
        </div>
      ) : (
        <FilterRail
          options={[
            { value: 'all', label: `All (${counts.all})` },
            { value: 'notes', label: `Notes (${counts.notes})` },
            { value: 'past-paper', label: `Past papers (${counts['past-paper']})` },
            { value: 'worksheet', label: `Worksheets (${counts.worksheet})` },
            { value: 'image', label: `Images (${counts.image})` },
          ]}
          value={kind}
          onChange={value => setKind(value as Resource['kind'] | 'all')}
          accent={accent}
        />
      )}

      {!visible.length ? (
        <NoResources subject={scope === 'subject' ? SUBJECT_MAP[activeSubjectId].name : 'any subject'} />
      ) : (
        <>
          <SectionLabel>
            {visible.length} file{visible.length === 1 ? '' : 's'}
          </SectionLabel>
          <div className="space-y-2">
            {visible.map(resource => (
              <div key={resource.id}>
                <ResourceRow
                  resource={resource}
                  onOpen={() => setOpen(resource)}
                  onDelete={() => deleteResource(resource.id)}
                />
                <div className="flex items-center gap-2 px-1 pt-1.5 flex-wrap">
                  <Pill color={SUBJECT_MAP[resource.subjectId]?.color ?? accent}>
                    {SUBJECT_MAP[resource.subjectId]?.shortName ?? resource.subjectId}
                  </Pill>
                  {resource.note && (
                    <span className="text-ink-60 text-xs font-display truncate">{resource.note}</span>
                  )}
                  <span className="text-ink-60 text-xs font-mono-data ml-auto">
                    {new Date(resource.createdAt).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Card className="p-4">
        <p className="text-ink-70 text-xs leading-relaxed">
          Deleting a file also removes its stored copy from this device. Uploaded material is not published
          anywhere — it lives in browser storage for whoever opens this app on this device.
        </p>
      </Card>

      <ResourceSheet resource={open} onClose={() => setOpen(null)} onDelete={deleteResource} />

      <button
        type="button"
        onClick={() => navigate('/teacher/upload')}
        className="w-full rounded-xl text-white font-display font-bold py-3.5 text-sm min-h-[48px] pressable"
        style={{ background: accent }}
      >
        Upload new material
      </button>
    </div>
  )
}

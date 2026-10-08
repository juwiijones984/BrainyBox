import { useMemo, useState } from 'react'
import { SUBJECT_MAP, SUBJECTS, topicName, type Resource, type SubjectId } from '@/data'
import { useAppStore } from '@/store/AppStore'
import { FilterRail, Segmented, SectionLabel } from '@/components/ui'
import { NoResources, ResourceRow, ResourceSheet, resourceKindColor } from '@/components/library'
import { Pill } from '@/components/ui'

export default function LibraryPage() {
  const { activeSubjectId, resources, deleteResource } = useAppStore()
  const [scope, setScope] = useState<'subject' | 'all'>('subject')
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState<Resource | null>(null)

  const accent = SUBJECT_MAP[activeSubjectId].color

  const visible = useMemo(() => {
    const base = scope === 'subject' ? resources.filter(r => r.subjectId === activeSubjectId) : resources
    return filter === 'all' ? base : base.filter(r => r.kind === filter)
  }, [resources, scope, activeSubjectId, filter])

  // Newest first; the store already prepends, but sorting keeps the order
  // stable if an older entry is edited.
  const ordered = useMemo(
    () => [...visible].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [visible],
  )

  const counts = useMemo(() => {
    const base = scope === 'subject' ? resources.filter(r => r.subjectId === activeSubjectId) : resources
    return {
      all: base.length,
      notes: base.filter(r => r.kind === 'notes').length,
      'past-paper': base.filter(r => r.kind === 'past-paper').length,
      worksheet: base.filter(r => r.kind === 'worksheet').length,
      image: base.filter(r => r.kind === 'image').length,
    }
  }, [resources, scope, activeSubjectId])

  return (
    <div className="space-y-5">
      <div>
        <p className="text-ink-70 text-xs font-semibold tracking-widest uppercase font-display">Study Material</p>
        <h2 className="font-display text-2xl font-bold text-ink mt-0.5">Library</h2>
        <p className="text-ink-60 text-xs font-mono-data mt-1">
          Notes, worksheets and past papers across every subject
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

      <FilterRail
        options={[
          { value: 'all', label: `All (${counts.all})` },
          { value: 'notes', label: `Notes (${counts.notes})` },
          { value: 'past-paper', label: `Past papers (${counts['past-paper']})` },
          { value: 'worksheet', label: `Worksheets (${counts.worksheet})` },
          { value: 'image', label: `Images (${counts.image})` },
        ]}
        value={filter}
        onChange={setFilter}
        accent={accent}
      />

      {!ordered.length ? (
        <NoResources subject={scope === 'subject' ? SUBJECT_MAP[activeSubjectId].name : 'any subject'} />
      ) : (
        <>
          <SectionLabel>
            {ordered.length} file{ordered.length === 1 ? '' : 's'}
          </SectionLabel>
          <div className="space-y-2">
            {ordered.map(resource => (
              <div key={resource.id}>
                <ResourceRow
                  resource={resource}
                  onOpen={() => setOpen(resource)}
                  onDelete={() => deleteResource(resource.id)}
                />
                <div className="flex items-center gap-2 px-1 pt-1.5 pb-1 flex-wrap">
                  <Pill color={resourceKindColor(resource.kind)}>
                    {SUBJECTS.find(s => s.id === resource.subjectId as SubjectId)?.shortName ?? resource.subjectId}
                  </Pill>
                  {resource.topicId && (
                    <span className="text-ink-60 text-xs font-mono-data">{topicName(resource.topicId)}</span>
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

      <p className="text-center text-ink-60 text-xs font-display pt-2">
        Files are stored on this device only
      </p>

      <ResourceSheet resource={open} onClose={() => setOpen(null)} onDelete={deleteResource} />
    </div>
  )
}

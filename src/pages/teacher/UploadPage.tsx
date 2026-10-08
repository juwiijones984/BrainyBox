import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { SUBJECTS, SUBJECT_MAP, type Resource, type SubjectId } from '@/data'
import { newId } from '@/lib/storage'
import { LARGE_FILE_BYTES, deleteResourceFile, uploadResource } from '@/lib/firebase/uploads'
import { useAuth } from '@/store/AuthStore'
import { CSV_TEMPLATE, parseQuestionBank, questionsToCsv } from '@/lib/importQuestionBank'
import { useAppStore } from '@/store/AppStore'
import { formatTitle, guessKind, resourceKindColor } from '@/components/library'
import { Button, Card, EmptyState, Pill, SectionLabel, Segmented } from '@/components/ui'

// The limit `storage.rules` enforces on the server. Checking it here as well is
// not redundancy for its own sake: the rule rejects the upload either way, and
// failing fast means the user is told the real reason instead of a generic
// permission error after the bytes have crossed the network.
const MAX_BYTES = 20 * 1024 * 1024

const KINDS: Resource['kind'][] = ['notes', 'past-paper', 'worksheet', 'image']

const ACCEPTED = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.csv,.json,application/pdf,image/*,text/plain,.md'

type Notice = { tone: 'ok' | 'warn' | 'busy'; text: string }

export default function UploadPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activeSubjectId, setActiveSubject, addResource, importQuestions, resources, questions } = useAppStore()

  const [subjectId, setSubjectId] = useState<SubjectId>(activeSubjectId)
  const [kind, setKind] = useState<Resource['kind']>('notes')
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const subject = SUBJECT_MAP[subjectId]
  const accent = subject.color

  const subjectCount = useMemo(
    () => resources.filter(r => r.subjectId === subjectId).length,
    [resources, subjectId],
  )

  // ── Study material (PDF / image / text) ───────────────────────────────────
  //
  // The bytes go to Cloud Storage and only the descriptor to Firestore, in that
  // order: a descriptor for an upload that failed would show a library row with
  // nothing behind it. If the Firestore write then fails, the object is removed
  // so it does not become an invisible orphan consuming storage.
  const uploadMaterial = async (file: File) => {
    if (!user) return
    if (file.size > MAX_BYTES) {
      setNotice({ tone: 'warn', text: `${file.name} is larger than 20 MB. Split it and try again.` })
      return
    }
    if (file.size > LARGE_FILE_BYTES) {
      setNotice({ tone: 'warn', text: `${file.name} is over 10 MB, so this may take a moment on a slow connection.` })
    }

    setBusy(true)
    setNotice({ tone: 'busy', text: `Uploading ${file.name}…` })

    const resourceId = newId('res')
    try {
      const task = uploadResource(user.uid, resourceId, file, fraction => {
        setNotice({ tone: 'busy', text: `Uploading ${file.name} · ${Math.round(fraction * 100)}%` })
      })

      await new Promise<void>((resolve, reject) => {
        task.on('state_changed', snapshot => {
          if (snapshot.state === 'success') resolve()
        }, reject, reject)
      })

      try {
        await addResource({
          id: resourceId,
          subjectId,
          topicId: '',
          kind: guessKind(file) === 'image' ? 'image' : kind,
          title: formatTitle(file.name),
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          blobKey: resourceId,
          ownerUid: user.uid,
          uploaded: true,
          note: note.trim() || undefined,
          createdAt: new Date().toISOString(),
        })
      } catch (error) {
        // The file arrived but its record did not. Remove the bytes rather than
        // leaving storage to be paid for with nothing pointing at it.
        await deleteResourceFile(user.uid, resourceId).catch(() => {})
        throw error
      }

      setNotice({ tone: 'ok', text: `${file.name} added to the ${subject.shortName} library.` })
      setNote('')
    } catch (error) {
      setNotice({ tone: 'warn', text: `Could not upload ${file.name}: ${(error as Error).message}` })
    } finally {
      setBusy(false)
    }
  }

  // ── Question bank (CSV / JSON) ────────────────────────────────────────────
  const uploadBank = async (file: File) => {
    setBusy(true)
    setNotice({ tone: 'busy', text: `Reading ${file.name}…` })

    try {
      const result = parseQuestionBank(await file.text(), file.name, { subjectId })

      if (!result.questions.length) {
        setNotice({ tone: 'warn', text: result.issues[0]?.message ?? 'No questions found in that file.' })
        return
      }

      const outcome = importQuestions({
        questions: result.questions,
        subjectId,
        quizTitle: formatTitle(file.name),
        quizKind: 'quiz',
        timeLimitMin: null,
      })

      const summary = result.issues.length
        ? `Imported ${outcome.added} questions to ${subject.shortName}, skipped ${result.issues.length} row${result.issues.length === 1 ? '' : 's'}. ${result.issues[0]?.message ?? ''}`
        : `Imported ${outcome.added} questions to ${subject.shortName}${outcome.newSkills.length ? ` and created ${outcome.newSkills.length} skill${outcome.newSkills.length === 1 ? '' : 's'}` : ''}.`

      setNotice({ tone: result.issues.length ? 'warn' : 'busy', text: `Saving ${outcome.added} questions…` })

      // The rows are in memory at this point, but they only count as imported
      // once they are stored. Saying "imported" over a failed write would leave
      // a quiz that empties itself on the next page load.
      try {
        await outcome.persisted
        setNotice({ tone: result.issues.length ? 'warn' : 'ok', text: summary })
      } catch (error) {
        setNotice({
          tone: 'warn',
          text: `Saved nothing: ${(error as Error).message}. The questions are still on this page, so try the import again.`,
        })
      }
    } catch (error) {
      setNotice({ tone: 'warn', text: `Could not read ${file.name}: ${(error as Error).message}` })
    } finally {
      setBusy(false)
    }
  }

  // One drop target, two very different pipelines: the file extension decides.
  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setSubjectId(activeSubjectId)
    for (const file of Array.from(files)) {
      if (/\.(csv|json)$/i.test(file.name)) await uploadBank(file)
      else await uploadMaterial(file)
    }
  }

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'brainybox-question-template.csv'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const downloadQuestionCsv = () => {
    const subjectQuestions = questions.filter(q => q.subjectId === subjectId)
    if (!subjectQuestions.length) {
      setNotice({ tone: 'warn', text: `No questions in ${subject.name} to export yet.` })
      return
    }
    const blob = new Blob([questionsToCsv(subjectQuestions)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${subjectId}-questions.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-ink-70 text-xs font-semibold tracking-widest uppercase font-display">Teacher Portal</p>
        <h2 className="font-display text-2xl font-bold text-ink mt-0.5">Upload</h2>
        <p className="text-ink-60 text-xs font-mono-data mt-1">
          Add study material and question banks to the library
        </p>
      </div>

      {/* Subject picker */}
      <div>
        <SectionLabel>Add to subject</SectionLabel>
        <div className="flex gap-2 overflow-x-auto scroll-x -mx-4 px-4 py-1">
          {SUBJECTS.map(option => {
            const active = option.id === subjectId
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSubjectId(option.id)}
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

      {/* Drop zone */}
      <label
        onDragOver={event => { event.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={event => {
          event.preventDefault()
          setDragOver(false)
          void handleFiles(event.dataTransfer.files)
        }}
        className={`block rounded-2xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
          dragOver ? 'bg-tint-strong' : 'bg-surface'
        }`}
        style={{ borderColor: dragOver ? accent : 'rgba(5,31,46,0.12)' }}
      >
        <input
          type="file"
          multiple
          accept={ACCEPTED}
          disabled={busy}
          className="sr-only"
          onChange={event => { void handleFiles(event.target.files); event.target.value = '' }}
        />
        <span className="text-3xl block mb-2" style={{ color: accent }} aria-hidden="true">
          {busy ? '◌' : '↑'}
        </span>
        <span className="block font-display font-bold text-ink text-sm">
          {busy ? 'Working…' : 'Tap to choose files, or drop them here'}
        </span>
        <span className="block text-ink-70 text-xs font-mono-data mt-1.5 leading-relaxed">
          PDF · PNG · JPG · TXT · CSV · JSON · up to 20 MB
        </span>
      </label>

      {/* Material options */}
      <Card className="p-4 space-y-3">
        <SectionLabel>File type & note</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {KINDS.map(option => (
            <button
              key={option}
              type="button"
              onClick={() => setKind(option)}
              aria-pressed={kind === option}
              className="px-3 min-h-[38px] rounded-full text-xs font-display font-semibold capitalize transition-colors"
              style={{
                background: kind === option ? `${resourceKindColor(option)}26` : 'rgba(5,31,46,0.06)',
                color: kind === option ? resourceKindColor(option) : 'rgba(5,31,46,0.55)',
              }}
            >
              {option.replace('-', ' ')}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={note}
          onChange={event => setNote(event.target.value)}
          placeholder="Optional note, e.g. 'Term 3 revision'"
          maxLength={140}
          className="w-full rounded-xl bg-tint-strong border border-line-hover px-3.5 min-h-[48px] text-sm text-white placeholder:text-ink-60 outline-none focus:border-line-strong transition-colors"
        />
        <p className="text-ink-60 text-xs leading-relaxed">
          Images are detected automatically. CSVs and JSON files always go to the question bank, whatever is
          selected here.
        </p>
      </Card>

      {/* Question bank tools */}
      <Card className="p-4 space-y-3">
        <SectionLabel>Question bank</SectionLabel>
        <p className="text-ink-70 text-xs leading-relaxed">
          A CSV or JSON file uploads into the {subject.name} question bank and becomes a runnable quiz. Each
          row needs a question and an answer; everything else is optional.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={downloadTemplate}>
            CSV template
          </Button>
          <Button size="sm" variant="ghost" onClick={downloadQuestionCsv}>
            Export {subject.shortName} CSV
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-tint-strong border border-line p-3">
            <p className="font-mono-data font-bold text-ink text-lg">{questions.filter(q => q.subjectId === subjectId).length}</p>
            <p className="text-ink-60 text-xs font-display mt-0.5">Questions</p>
          </div>
          <div className="rounded-xl bg-tint-strong border border-line p-3">
            <p className="font-mono-data font-bold text-ink text-lg">{subjectCount}</p>
            <p className="text-ink-60 text-xs font-display mt-0.5">Files</p>
          </div>
        </div>
      </Card>

      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => navigate('/teacher/library')} className="flex-1">
          Open library
        </Button>
        <Button variant="ghost" onClick={() => navigate('/teacher/builder')} className="flex-1">
          Build a quiz
        </Button>
      </div>
    </div>
  )
}

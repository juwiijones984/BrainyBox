import { useCallback, useEffect, useState } from 'react'
import { SUBJECTS } from '@/data'
import { Button, Card, EmptyState, Pill, SectionLabel } from '@/components/ui'
import { LoadError } from './AdminOverviewPage'
import { useAdminData, type AdminPerson } from './useAdminData'
import {
  addMember, createClass, deleteClass, readMemberships, removeMember, type Membership,
} from '@/lib/firebase/store'
import type { SubjectId } from '@/data/types'

/**
 * Classes, their owning teacher, and their roster.
 *
 * Two rule facts shape this page:
 *
 *  - Creating and deleting a class is `isAdmin()` only. A teacher may *update* a
 *    class but not create one, so an owner has to exist before a class can be
 *    pointed at it. The create form refuses to submit without a teacher rather
 *    than producing a class nobody can see — enrolment rights derive from
 *    `classes.teacherUid`, and the teacher portal queries by it, so an unowned
 *    class is invisible to everyone including this page's own teacher.
 *  - Enrolling is allowed for the class's own teacher too, so teachers can enrol
 *    without an operator. `firestore.rules` additionally requires the member row's
 *    `uid` field to equal its document id, which is why enrolment picks a person
 *    from the register instead of taking a typed uid: a hand-typed uid is the one
 *    way to get this wrong, and the rules reject it with an opaque permission
 *    error rather than a message saying so.
 */
export default function AdminClassesPage() {
  const { classes, people, nameOf, loading, error, reload } = useAdminData()
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const teachers = people.filter(p => p.role === 'teacher')

  if (error) return <LoadError message={error} />
  if (loading) return <p className="text-ink-70 text-sm font-display py-10 text-center">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display font-extrabold text-ink text-xl tracking-tight">Classes</h1>
          <p className="text-ink-70 text-xs mt-1">{classes.length} classes</p>
        </div>
        <Button size="sm" variant={creating ? 'secondary' : 'primary'} onClick={() => setCreating(!creating)}>
          {creating ? 'Close' : 'New class'}
        </Button>
      </div>

      {creating && (
        <CreateClassForm teachers={teachers} onDone={() => { setCreating(false); reload() }} />
      )}

      {classes.length === 0 ? (
        <EmptyState icon="▦" title="No classes yet" body="Create one to start enrolling learners." />
      ) : (
        <ul className="space-y-2">
          {classes.map(cls => (
            <li key={cls.id}>
              <Card className="p-3.5 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-semibold text-ink text-sm">{cls.name}</span>
                      <Pill color="#a78bfa">{SUBJECTS.find(s => s.id === cls.subjectId)?.shortName ?? cls.subjectId}</Pill>
                    </div>
                    <p className="text-ink-70 text-xs mt-1">
                      Teacher: {nameOf(cls.teacherUid)}
                      {cls.grade ? ` · Grade ${cls.grade}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(open === cls.id ? null : cls.id)}
                    aria-expanded={open === cls.id}
                    className="text-xs font-display font-semibold text-navy active:text-navy shrink-0 min-h-[40px] px-2"
                  >
                    {open === cls.id ? 'Close' : 'Roster'}
                  </button>
                </div>
                {open === cls.id && (
                  <Roster
                    classId={cls.id}
                    className={cls.name}
                    learners={people.filter(p => p.role === 'learner')}
                    onChanged={reload}
                  />
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const FIELD =
  'w-full rounded-xl bg-surface border border-line-hover text-ink px-3.5 py-3 text-sm min-h-[48px] outline-none focus:border-blue/30'
const LABEL = 'block text-ink-70 text-xs font-display mb-1.5'

function CreateClassForm({ teachers, onDone }: { teachers: AdminPerson[]; onDone: () => void }) {
  const [classId, setClassId] = useState('')
  const [name, setName] = useState('')
  const [grade, setGrade] = useState('10')
  const [subjectId, setSubjectId] = useState<SubjectId>(SUBJECTS[0].id)
  const [teacherUid, setTeacherUid] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const noTeachers = teachers.length === 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!classId.trim()) return setMsg('Give the class an id.')
    if (!teacherUid) return setMsg('Choose the teacher who will own this class.')

    setBusy(true)
    setMsg(null)
    try {
      await createClass({
        classId: classId.trim(),
        name,
        grade: Number(grade) || 10,
        subjectId,
        teacherUid,
      })
      onDone()
    } catch (err) {
      setMsg((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-4 border-blue/13">
      <form onSubmit={submit} className="space-y-3">
        <SectionLabel>New class</SectionLabel>

        {noTeachers && (
          <p className="text-ember text-xs leading-relaxed bg-orange/5 border border-orange/10 rounded-xl px-3 py-2.5">
            No account has the teacher role yet. Promote one with{' '}
            <code className="text-ink">npm run provision -- setrole &lt;uid&gt; teacher</code>{' '}
            first — a class cannot be created without an owner.
          </p>
        )}

        <div>
          <label className={LABEL} htmlFor="cls-id">Class id</label>
          <input id="cls-id" className={FIELD} value={classId} onChange={e => setClassId(e.target.value)} placeholder="gr10-math-a" />
        </div>
        <div>
          <label className={LABEL} htmlFor="cls-name">Display name <span className="text-ink-60">(optional)</span></label>
          <input id="cls-name" className={FIELD} value={name} onChange={e => setName(e.target.value)} placeholder="Grade 10 Mathematics A" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL} htmlFor="cls-grade">Grade</label>
            <input id="cls-grade" type="number" min={1} max={12} className={FIELD} value={grade} onChange={e => setGrade(e.target.value)} />
          </div>
          <div>
            <label className={LABEL} htmlFor="cls-subject">Subject</label>
            <select id="cls-subject" className={FIELD} value={subjectId} onChange={e => setSubjectId(e.target.value as SubjectId)}>
              {SUBJECTS.map(s => <option key={s.id} value={s.id}>{s.shortName ?? s.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={LABEL} htmlFor="cls-teacher">Teacher</label>
          <select id="cls-teacher" className={FIELD} value={teacherUid} onChange={e => setTeacherUid(e.target.value)}>
            <option value="">Choose a teacher…</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {msg && <p className="text-rose-300 text-xs">{msg}</p>}

        <Button type="submit" full disabled={busy || noTeachers}>
          {busy ? 'Creating…' : 'Create class'}
        </Button>
      </form>
    </Card>
  )
}

function Roster({
  classId,
  className,
  learners,
  onChanged,
}: {
  classId: string
  className: string
  learners: AdminPerson[]
  onChanged: () => void
}) {
  const [members, setMembers] = useState<Membership[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [addUid, setAddUid] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setMembers(await readMemberships(classId))
      setErr(null)
    } catch (e) {
      setErr((e as Error).message)
      setMembers([])
    }
  }, [classId])

  useEffect(() => { void load() }, [load])

  const enrol = async () => {
    if (!addUid || busy) return
    const person = learners.find(l => l.id === addUid)
    if (!person) return setErr('That learner is not on the register.')

    setBusy(true)
    setErr(null)
    try {
      await addMember(classId, addUid, 'learner', person.name)
      setAddUid('')
      await load()
      onChanged()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const unenrol = async (uid: string) => {
    if (busy) return
    setBusy(true)
    setErr(null)
    try {
      await removeMember(classId, uid)
      await load()
      onChanged()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (busy) return
    // The roster goes too — `deleteDoc` does not cascade, so `deleteClass` removes
    // the member documents explicitly and revokes the teacher's access to each
    // learner. Worth saying out loud, because unenrolling someone is exactly the
    // moment a teacher stops being able to read their work.
    if (!confirm(
      `Delete "${className}"? Its ${members?.length ?? 0} enrolment(s) are removed and the teacher loses `
      + `access to those learners' work. Learner data itself is not affected.`,
    )) return
    setBusy(true)
    setErr(null)
    try {
      await deleteClass(classId)
      onChanged()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pt-2 border-t border-line-hover space-y-3">
      {err && <p className="text-rose-300 text-xs leading-relaxed">{err}</p>}
      <p className="text-ink-70 text-xs">
        {members === null ? 'Loading roster…' : `${members.length} enrolled`}
      </p>

      {members !== null && members.length === 0 && (
        <p className="text-ink-60 text-xs">Nobody enrolled yet.</p>
      )}

      {members !== null && members.length > 0 && (
        <ul className="space-y-1.5">
          {members.map(m => (
            <li key={m.uid} className="flex items-center gap-2 text-xs">
              <Pill color="#014E8C">{m.role}</Pill>
              <span className="text-ink-80 truncate flex-1">{m.displayName || m.uid}</span>
              <span className="font-mono-data text-ink-60 truncate max-w-[9rem]" title={m.uid}>{m.uid}</span>
              <button
                type="button"
                onClick={() => void unenrol(m.uid)}
                disabled={busy}
                className="text-rose-300/80 active:text-rose-200 text-xs font-display font-semibold min-h-[36px] px-2 disabled:opacity-40"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {learners.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            className="flex-1 rounded-xl bg-surface border border-line-hover text-ink px-3.5 py-2.5 text-xs min-h-[44px] outline-none focus:border-blue/30"
            value={addUid}
            onChange={e => setAddUid(e.target.value)}
            aria-label="Learner to enrol"
          >
            <option value="">Choose a learner…</option>
            {learners.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <Button size="sm" onClick={() => void enrol()} disabled={busy || !addUid}>Enrol</Button>
        </div>
      )}

      <button
        type="button"
        onClick={() => void remove()}
        disabled={busy}
        className="text-xs font-display font-semibold text-rose-300/80 active:text-rose-200 min-h-[40px] disabled:opacity-40"
      >
        Delete class
      </button>
    </div>
  )
}

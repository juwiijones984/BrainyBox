import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react'
import {
  QUESTIONS, QUIZZES, SKILLS, SUBJECTS, importTopicId, topicName as topicLabel,
  type Attempt, type MasteryRecord, type Question, type Quiz, type Resource,
  type RevisionItem, type SkillProgress, type SubjectId,
} from '@/data'
import { useAuth } from './AuthStore'
import { newId, read, write } from '@/lib/storage'
import { answeredBySkillFrom, withMastery } from '@/lib/roster'
import { buildRevisionPlan } from '@/lib/revision'
import { deleteResourceFile } from '@/lib/firebase/uploads'
import { writeMasteryAnswers } from '@/lib/firebase/store'
import {
  advanceStreak, deleteAllLearnerData, deleteAttempt as dbDeleteAttempt,
  deleteQuiz as dbDeleteQuiz, deleteResource as dbDeleteResource,
  readAttempts, readCustomSkills, readMastery, readQuestions, readQuizzes,
  readResources, readRevision,
  rebuildMasteryForSkills, recordMasteryFromAttempt, setRevisionComplete, writeAttempt,
  writeCustomSkills, writeQuestions, writeQuiz, writeResource,
} from '@/lib/firebase/store'

// ── State ──────────────────────────────────────────────────────────────────
export interface AppState {
  activeSubjectId: SubjectId
  /**
   * The static catalogue joined to this learner's mastery.
   *
   * A learner who has assessed nothing still gets a full list — every skill is
   * real curriculum — but with `current: null` throughout, so the Marks Map
   * shows an unassessed state instead of a percentage.
   */
  skills: SkillProgress[]
  /** Shipped question bank plus anything this learner has imported. */
  questions: Question[]
  quizzes: Quiz[]
  resources: Resource[]
  attempts: Attempt[]
  /** Derived from measured mastery; empty until there is something to plan. */
  revision: RevisionItem[]
}

export interface ImportOutcome {
  added: number
  skipped: number
  /** Skills created because the bank referenced one the app didn't know. */
  newSkills: string[]
  quizId: string | null
  /**
   * Resolves once the bank is stored, or with the reason it could not be.
   *
   * The import itself is synchronous, so this promise is how a caller learns
   * the write actually landed. It is a separate field rather than a second
   * return value because the local state is already correct either way: what
   * the promise carries is whether that state survives a reload.
   */
  persisted: Promise<void>
}

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface AppStore extends AppState {
  subjects: typeof SUBJECTS
  status: LoadStatus
  error: string | null
  /** True when the learner has no mastery at all and needs the diagnostic. */
  needsDiagnostic: boolean
  setActiveSubject: (subjectId: SubjectId) => void
  importQuestions: (input: {
    questions: Question[]
    subjectId: SubjectId
    topicName?: string
    skillName?: string
    quizTitle: string
    quizKind: Quiz['kind']
    timeLimitMin: number | null
  }) => ImportOutcome

  createQuiz: (input: Omit<Quiz, 'id' | 'source' | 'createdAt'>) => Quiz
  createQuizWithQuestions: (
    input: Omit<Quiz, 'id' | 'source' | 'createdAt'>,
    questions: Question[],
  ) => Promise<Quiz>
  updateQuiz: (id: string, patch: Partial<Quiz>) => Promise<void>
  deleteQuiz: (id: string) => Promise<void>
  addResource: (resource: Resource) => Promise<void>
  updateResource: (id: string, patch: Partial<Resource>) => Promise<void>
  deleteResource: (id: string) => Promise<void>
  recordAttempt: (attempt: Attempt) => Promise<void>
  deleteAttempt: (id: string) => Promise<void>
  toggleRevisionItem: (id: string) => Promise<void>
  /** Drop every local artefact belonging to this learner. */
  clearMyData: () => Promise<void>
}

const AppStoreContext = createContext<AppStore | null>(null)

// The only thing still kept in localStorage. It is a device preference, not
// learner data: which subject was last open. Everything a person did or
// achieved lives in Firestore, so signing in on another device shows the same
// progress and clearing site data does not destroy anyone's work.
const ACTIVE_SUBJECT_KEY = 'activeSubjectId'

const DEFAULT_ACTIVE_SUBJECT: SubjectId = 'mathematics'

const initialState = (): AppState => ({
  activeSubjectId: read<SubjectId>(ACTIVE_SUBJECT_KEY, DEFAULT_ACTIVE_SUBJECT),
  skills: withMastery(SKILLS, null),
  questions: QUESTIONS,
  quizzes: QUIZZES,
  resources: [],
  attempts: [],
  revision: [],
})

/**
 * Repair stored mastery records that predate the `answered` field.
 *
 * The denominator of a skill's accuracy — questions answered — is what
 * `recordMasteryFromAttempt` adds one sitting's worth to. That function is handed a
 * single attempt, so it cannot recover a denominator it does not have and falls back
 * to `correct`, which makes every legacy skill read 100% accurate forever. The
 * attempt history is available here, so this is where the field gets filled in.
 *
 * Deliberately narrow: only a record where `answered` is absent is touched, and only
 * its `answered` and `updatedAt` change. Rewriting `current` would re-blend scores
 * that were computed over a history nobody kept, and zeroing an unrecoverable
 * denominator would report "0% answered" for a learner who answered plenty. A skill
 * whose attempts no longer exist keeps its stored value and is handled by
 * `rebuildMasteryForSkills` when an attempt is deleted.
 *
 * Fire-and-forget on purpose. This is a repair, not the load: the figures on screen
 * are already computed from the backfilled values, and a failure here costs nothing
 * but the same repair next time.
 */
async function backfillAnsweredCounts(
  uid: string,
  mastery: ReadonlyMap<string, MasteryRecord>,
  answeredBySkill: ReadonlyMap<string, number>,
): Promise<void> {
  const stale = [...mastery.values()]
    .filter(record => typeof record.answered !== 'number' && answeredBySkill.get(record.skillId))
  if (!stale.length) return

  try {
    await writeMasteryAnswers(uid, stale.map(record => ({
      ...record,
      answered: answeredBySkill.get(record.skillId) ?? 0,
    })))
  } catch {
    // Nothing to report: the load already succeeded, and the next load retries.
  }
}

// ── Provider ───────────────────────────────────────────────────────────────
export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const [state, setState] = useState<AppState>(initialState)
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const uid = user?.uid ?? null

  // Load this learner's real data. Until this resolves the app must not render
  // progress figures, because the only numbers available beforehand are the
  // shipped catalogue — which describe no one.
  useEffect(() => {
    if (!uid) {
      setState(initialState())
      setStatus('idle')
      return
    }

    let cancelled = false
    setStatus('loading')
    setError(null)

    Promise.all([
      readMastery(uid),
      readAttempts(uid),
      readQuestions(uid),
      readCustomSkills(uid),
      readQuizzes(uid),
      readResources(uid),
      readRevision(uid),
    ])
      .then(([mastery, attempts, importedQuestions, customSkills, learnerQuizzes, resources, revisionState]) => {
        if (cancelled) return
        const completed = new Set(revisionState.filter(r => r.complete).map(r => r.id))

        setState(prev => {
          // Shipped quizzes and questions are the study guide's; anything this
          // learner imported is additive, and a re-import must not duplicate it.
          const shippedQuizIds = new Set(QUIZZES.map(q => q.id))
          const own = learnerQuizzes.filter(q => !shippedQuizIds.has(q.id))
          const shippedQuestionIds = new Set(QUESTIONS.map(q => q.id))
          const ownQuestions = importedQuestions.filter(q => !shippedQuestionIds.has(q.id))
          // Imported skills rejoin the catalogue with no evidence attached: a
          // skill that was created by an import has not been assessed.
          const shippedSkillIds = new Set(SKILLS.map(s => s.id))
          const ownSkills = customSkills.filter(s => !shippedSkillIds.has(s.id))

          // Mastery records written before the `answered` field existed have no question
          // count, so it is reconstructed from the attempt history. Without this the
          // per-skill accuracy figures divide questions by sittings.
          const skillIdByQuestionId = new Map(
            [...ownQuestions, ...QUESTIONS].map(q => [q.id, q.skillId]),
          )
          const answeredBySkill = answeredBySkillFrom(attempts, skillIdByQuestionId)
          const skills = withMastery(
            [...SKILLS, ...ownSkills],
            [...mastery.values()],
            answeredBySkill,
          )

          // The server-side increment cannot backfill a missing denominator - it is
          // handed one attempt, not the history - so it falls back to `correct` and
          // reports 100% accuracy for the skill forever. This is the one place the
          // history exists, so the stored record is repaired here. Only records
          // actually missing the field are written, so this settles after the first
          // load and costs one no-op check per skill on every load after that.
          void backfillAnsweredCounts(uid, mastery, answeredBySkill)

          return {
            ...prev,
            skills,
            attempts,
            questions: [...ownQuestions, ...QUESTIONS],
            quizzes: [...own, ...QUIZZES],
            resources,
            // Completion is stored; the plan itself is generated from mastery.
            revision: buildRevisionPlan(skills, { completedIds: completed }),
          }
        })
        setStatus('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not load your progress.')
        setStatus('error')
      })

    return () => { cancelled = true }
  }, [uid])

  const setActiveSubject = useCallback((subjectId: SubjectId) => {
    setState(prev => ({ ...prev, activeSubjectId: subjectId }))
    write(ACTIVE_SUBJECT_KEY, subjectId)
  }, [])

  const importQuestions = useCallback<AppStore['importQuestions']>(input => {
    const { questions, subjectId, topicName, skillName, quizTitle, quizKind, timeLimitMin } = input

    // The parser resolves each question's own topic from the file's `topic` column,
    // but this store also mints one skill to hang them on, and a skill in the
    // sentinel topic with questions in a real one splits the same bank across two
    // buckets. Prefer the teacher-chosen topic; otherwise use the topic the
    // questions themselves landed in, when they agree on one.
    const questionTopic = questions[0]?.topicId ?? ''
    const sharedTopic = questionTopic
      && questions.every(q => q.topicId === questionTopic)
      ? questionTopic
      : ''
    const skillTopicId = topicName ? importTopicId(subjectId, topicName) : sharedTopic
      || importTopicId(subjectId)

    // Imported banks create skills that belong to the curriculum, not to one
    // learner, so they are held in state for this session and keyed by id like
    // any other skill. A new skill starts with no mastery at all.
    const newSkills: SkillProgress[] = []
    const created = new Map<string, string>()

    const resolveSkill = (question: Question): string => {
      const wanted = question.skillId?.trim()
      if (wanted) {
        const match =
          state.skills.find(s => s.id.toLowerCase() === wanted.toLowerCase()) ??
          state.skills.find(s => s.name.toLowerCase() === wanted.toLowerCase())
        if (match) return match.id
      }

      const name = skillName || topicName || 'Imported Skills'
      const key = `${topicName ?? ''}|${name}`
      const existing = created.get(key)
      if (existing) return existing

      // One skill per topic, not per question: a 40-question bank of unmatched
      // questions must not produce 40 near-identical skills.
      const id = `${subjectId.slice(0, 4).toUpperCase()}-IMP-${newId('s').slice(-6).toUpperCase()}`
      newSkills.push({
        id,
        subjectId,
        // The same resolver the parser uses: a bank tagged with a study-guide topic
        // joins that topic, and only an unmatched one gets the sentinel. The
        // hardcoded `${subjectId}--imported` here minted an id that no `TOPICS`
        // entry could ever resolve, so the skill was invisible to every per-topic
        // average even when it belonged to a real one.
        topicId: skillTopicId,
        topic: topicName || (sharedTopic ? topicLabel(sharedTopic) : 'Imported'),
        name,
        // No evidence yet. Not zero — unattempted.
        baseline: null,
        current: null,
        attempts: 0,
        correct: 0,
        answered: 0,
        trend: 'stable',
        lastPracticedAt: null,
      })
      created.set(key, id)
      return id
    }

    const prepared = questions.map(question => ({
      ...question,
      subjectId,
      skillId: resolveSkill(question),
      // A parser result already carries a resolved topic, but a caller can hand
      // `importQuestions` hand-built questions; leaving their topicId empty is what
      // put imported questions outside every topic breakdown.
      topicId: question.topicId || importTopicId(subjectId, topicName),
    }))

    const quiz: Quiz = {
      id: newId('quiz'),
      title: quizTitle,
      description: `Imported · ${questions.length} questions`,
      subjectId,
      topicIds: [],
      skillIds: [...new Set(prepared.map(q => q.skillId))],
      questionIds: prepared.map(q => q.id),
      kind: quizKind,
      timeLimitMin,
      // An imported bank is practice material. It has no prescribed structure,
      // so it can never count towards SBA unless it is later rebuilt against a
      // specific CAPS task.
      capsStatus: 'formative',
      source: 'import',
      createdAt: new Date().toISOString(),
    }

    setState(current => ({
      ...current,
      skills: newSkills.length ? [...current.skills, ...newSkills] : current.skills,
      questions: [...current.questions, ...prepared],
      quizzes: [quiz, ...current.quizzes],
    }))

    // Everything the quiz refers to is written, not just the quiz. A stored
    // quiz whose questions are only in memory is a quiz that renders empty
    // after a reload, and the ids in it would resolve to nothing.
    //
    // Order matters and is not parallel: the questions must exist before the
    // quiz points at them, and the invented skills must exist before either.
    // The promise is returned rather than fired and forgotten, because a write
    // that fails quietly looks exactly like a successful import until the next
    // page load empties the quiz.
    const persisted = uid
      ? writeCustomSkills(uid, newSkills)
          .then(() => writeQuestions(uid, prepared))
          .then(() => writeQuiz(uid, quiz))
      : Promise.resolve()

    return {
      added: prepared.length,
      skipped: questions.length - prepared.length,
      newSkills: newSkills.map(s => s.name),
      quizId: quiz.id,
      persisted,
    }
  }, [state.skills, uid])

  const createQuiz = useCallback<AppStore['createQuiz']>(input => {
    const quiz: Quiz = { ...input, id: newId('quiz'), source: 'builder', createdAt: new Date().toISOString() }
    setState(prev => ({ ...prev, quizzes: [quiz, ...prev.quizzes] }))
    if (uid) void writeQuiz(uid, quiz)
    return quiz
  }, [uid])

  const createQuizWithQuestions = useCallback<AppStore['createQuizWithQuestions']>(async (input, authoredQuestions) => {
    const quiz: Quiz = { ...input, id: newId('quiz'), source: 'builder', createdAt: new Date().toISOString() }
    if (uid) {
      await writeQuestions(uid, authoredQuestions)
      await writeQuiz(uid, quiz)
    }
    setState(prev => ({
      ...prev,
      questions: [...authoredQuestions, ...prev.questions],
      quizzes: [quiz, ...prev.quizzes],
    }))
    return quiz
  }, [uid])

  const updateQuiz = useCallback<AppStore['updateQuiz']>(async (id, patch) => {
    setState(prev => ({
      ...prev,
      quizzes: prev.quizzes.map(quiz => (quiz.id === id ? { ...quiz, ...patch } : quiz)),
    }))
    if (!uid) return
    const next = state.quizzes.find(q => q.id === id)
    // A shipped study-guide quiz has no per-learner document to update.
    if (next && !QUIZZES.some(q => q.id === id)) await writeQuiz(uid, { ...next, ...patch })
  }, [uid, state.quizzes])

  const deleteQuiz = useCallback<AppStore['deleteQuiz']>(async id => {
    setState(prev => {
      // Keep the questions — they may belong to another quiz. Only remove the
      // ones this quiz was the sole owner of.
      const quiz = prev.quizzes.find(q => q.id === id)
      if (!quiz) return prev
      const orphans = new Set(
        quiz.questionIds.filter(
          questionId => !prev.quizzes.some(other => other.id !== id && other.questionIds.includes(questionId)),
        ),
      )
      return {
        ...prev,
        quizzes: prev.quizzes.filter(q => q.id !== id),
        questions: prev.questions.filter(q => !orphans.has(q.id)),
      }
    })
    if (uid) await dbDeleteQuiz(uid, id)
  }, [uid])

  const addResource = useCallback<AppStore['addResource']>(async resource => {
    setState(prev => ({ ...prev, resources: [resource, ...prev.resources] }))
    if (uid) await writeResource(uid, resource)
  }, [uid])

  const updateResource = useCallback<AppStore['updateResource']>(async (id, patch) => {
    setState(prev => ({
      ...prev,
      resources: prev.resources.map(r => (r.id === id ? { ...r, ...patch } : r)),
    }))
    if (!uid) return
    const next = state.resources.find(r => r.id === id)
    if (next) await writeResource(uid, { ...next, ...patch })
  }, [uid, state.resources])

  const deleteResource = useCallback<AppStore['deleteResource']>(async id => {
    // The bytes go first. A descriptor that outlives its object is a library
    // row that opens to an error, and an object with no descriptor is storage
    // nobody can find or delete. Deleting the object also cannot be undone by
    // accident, so it happens while the id is still known.
    const resource = state.resources.find(r => r.id === id)
    const ownerUid = resource?.ownerUid ?? uid
    if (ownerUid) await deleteResourceFile(ownerUid, resource?.blobKey ?? id).catch(() => {})

    setState(prev => ({ ...prev, resources: prev.resources.filter(r => r.id !== id) }))
    if (uid) await dbDeleteResource(uid, id)
  }, [uid, state.resources])

  /**
   * Record a completed sitting.
   *
   * Three things are written: the attempt, the mastery it implies, and the
   * streak it extends.
   *
   * The attempt goes first because it is the source of truth: mastery is a blend
   * derived from attempts, so a mastery write that fails after the attempt has
   * landed leaves a real sitting with no credit, while the reverse order lost the
   * whole sitting and still showed the learner their result.
   *
   * A failure in the streak update is not allowed to fail the attempt: the
   * learner's work is already recorded, and losing it to an unrelated profile
   * write would be the worse outcome.
   */
  const recordAttempt = useCallback<AppStore['recordAttempt']>(async attempt => {
    const skillIdByQuestionId = new Map(
      state.questions.map(q => [q.id, q.skillId]),
    )

    // The attempt is written *first*. Mastery is derived from attempts, so writing
    // mastery first meant a mastery failure silently discarded the sitting
    // entirely — the learner saw a result that was never recorded, and the
    // Marks Map credited a paper that did not exist.
    if (uid) await writeAttempt(uid, attempt)

    const written = uid
      ? await recordMasteryFromAttempt(uid, attempt, skillIdByQuestionId)
      : []

    if (uid) {
      try {
        await advanceStreak(uid)
      } catch {
        // The attempt and its mastery are already durable; a failed streak
        // recompute is recoverable and losing the attempt would not be.
      }
    }

    setState(prev => {
      // The server has already blended the scores, so the client's job is to
      // show what was written rather than blend a second time from stale data.
      const bySkill = new Map(written.map(record => [record.skillId, record]))
      return {
        ...prev,
        attempts: [attempt, ...prev.attempts],
        skills: prev.skills.map(skill => {
          const record = bySkill.get(skill.id)
          return record
            ? {
                ...skill,
                baseline: record.baseline,
                current: record.current,
                attempts: record.attempts,
                correct: record.correct,
                answered: record.answered ?? record.correct,
                trend: record.trend,
                lastPracticedAt: record.lastPracticedAt,
              }
            : skill
        }),
        // The plan is regenerated from the mastery just written, so an attempt
        // that changed a weak skill is reflected without a reload.
        revision: buildRevisionPlan(
          prev.skills.map(skill => bySkill.get(skill.id)
            ? { ...skill, ...bySkill.get(skill.id) }
            : skill),
          { completedIds: new Set(prev.revision.filter(r => r.complete).map(r => r.id)) },
        ),
      }
    })
  }, [uid, state.questions])

  const deleteAttempt = useCallback<AppStore['deleteAttempt']>(async id => {
    const removed = state.attempts.find(a => a.id === id)
    const remaining = state.attempts.filter(a => a.id !== id)

    setState(prev => ({ ...prev, attempts: prev.attempts.filter(a => a.id !== id) }))
    if (!uid) return
    await dbDeleteAttempt(uid, id)

    if (!removed) return

    // Mastery is a blended running record, so removing the attempt document alone
    // left the deleted sitting's score in the Marks Map — the only way to correct
    // it was to sit another quiz. Rebuild the affected skills from what is left.
    const skillIdByQuestionId = new Map(state.questions.map(q => [q.id, q.skillId]))
    const affected = new Set(
      removed.questionIds
        .map(questionId => skillIdByQuestionId.get(questionId))
        .filter((skillId): skillId is string => Boolean(skillId)),
    )
    if (!affected.size) return

    const written = await rebuildMasteryForSkills(
      uid,
      [...affected],
      remaining,
      skillIdByQuestionId,
    )
    const bySkill = new Map(written.map(record => [record.skillId, record]))

    setState(prev => ({
      ...prev,
      skills: prev.skills.map(skill => {
        const record = bySkill.get(skill.id)
        if (!affected.has(skill.id)) return skill
        // No record means no surviving evidence for this skill at all.
        return record ? { ...skill, ...record } : withMastery([skill], null)[0]
      }),
    }))
  }, [uid, state.attempts, state.questions])

  const toggleRevisionItem = useCallback<AppStore['toggleRevisionItem']>(async id => {
    setState(prev => {
      const next = prev.revision.map(item =>
        item.id === id ? { ...item, complete: !item.complete } : item,
      )
      if (uid) void setRevisionComplete(uid, id, !prev.revision.find(i => i.id === id)?.complete)
      return { ...prev, revision: next }
    })
  }, [uid])

  /**
   * Forget this learner's Firestore and Storage data.
   *
   * This is a client-side request, not an account deletion: it removes the
   * records the app owns and leaves the auth account and profile intact. The
   * collection groups are enumerated in `deleteAllLearnerData` so exactly what
   * goes is visible in one place rather than reconstructed here.
   *
   * A file that is already gone is not an error — the point is that no bytes of
   * this learner's remain, and `storage/object-not-found` means that is already
   * true for that object.
   */
  const clearMyData = useCallback(async () => {
    if (!uid) return

    // Storage first: a failure here throws before Firestore is touched, which
    // would leave orphaned documents pointing at objects that are about to
    // disappear. Deleting the bytes first means the worst case is a document
    // describing a file that is gone, not a live file with no record of it.
    await Promise.allSettled(
      state.resources.map(resource => deleteResourceFile(uid, resource.id)),
    )

    await deleteAllLearnerData(uid)

    // No attempt is left, so the streak and last-study date are reset with them —
    // inside `deleteAllLearnerData`, so the two cannot be cleared out of step.

    setState(prev => ({
      ...prev,
      attempts: [],
      resources: [],
      revision: [],
      quizzes: [...QUIZZES],
      questions: [...QUESTIONS],
      // No mastery documents remain, so every skill is unassessed again. This
      // is not a reset to zero — it is the same cold start a new account has.
      skills: withMastery(SKILLS, null),
    }))
  }, [uid, state.resources])

  const value = useMemo<AppStore>(() => ({
    ...state,
    subjects: SUBJECTS,
    status,
    error,
    // The honest cold start: no evidence anywhere. Pages show the diagnostic
    // prompt rather than a fabricated 0%.
    needsDiagnostic: state.skills.every(s => s.current === null),
    setActiveSubject,
    importQuestions,
    createQuiz,
    createQuizWithQuestions,
    updateQuiz,
    deleteQuiz,
    addResource,
    updateResource,
    deleteResource,
    recordAttempt,
    deleteAttempt,
    toggleRevisionItem,
    clearMyData,
  }), [state, status, error, setActiveSubject, importQuestions, createQuiz, updateQuiz,
      deleteQuiz, addResource, updateResource, deleteResource, recordAttempt,
      deleteAttempt, toggleRevisionItem, clearMyData])

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useAppStore(): AppStore {
  const store = useContext(AppStoreContext)
  if (!store) throw new Error('useAppStore must be used inside <AppStoreProvider>.')
  return store
}

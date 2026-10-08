import {
  arrayRemove, arrayUnion, collection, collectionGroup, deleteDoc, doc, getDoc, getDocs,
  limit, orderBy, query, serverTimestamp, setDoc, where, writeBatch, type DocumentData,
} from 'firebase/firestore'
import { requireDb } from './config'
import { localDay } from '@/lib/storage'
import { recomputeMastery } from '@/lib/roster'
import type {
  Attempt, MasteryRecord, Profile, Question, Quiz, Resource, Skill, SubjectId, UserRole,
} from '@/data/types'

// ── Collections ────────────────────────────────────────────────────────────
//
// The document layout. Authorisation for all of it lives in `firestore.rules`,
// which reads the caller's own `users/{uid}.role` — so a learner cannot read
// another learner's mastery by guessing a uid, whatever the client does.
//
//   users/{uid}                        profile: role, name, grade, subjects
//   users/{uid}/attempts/{attemptId}   one completed sitting of a quiz
//   users/{uid}/questions/{questionId} learner-imported questions
//   users/{uid}/skills/{skillId}       skills created by an import
//   users/{uid}/quizzes/{quizId}       learner-authored quizzes
//   users/{uid}/resources/{resourceId} uploaded notes, papers, worksheets
//   users/{uid}/revision/{itemId}      plan items and their completion
//   learners/{uid}/mastery/{skillId}   per-skill evidence, one doc per skill
//   classes/{classId}                  a class
//   classes/{classId}/members/{uid}     enrolment
//   parentLinks/{parentUid}__{childUid} parent → child access
//
// Progress lives under `learners/{uid}` rather than `users/{uid}` so that a
// parent or teacher reading a child's progress is a single collection path
// away, and so a class query can ask for many learners' mastery in one read.

export const paths = {
  users: () => 'users',
  user: (uid: string) => `users/${uid}`,
  attempts: (uid: string) => `users/${uid}/attempts`,
  attempt: (uid: string, id: string) => `users/${uid}/attempts/${id}`,
  questions: (uid: string) => `users/${uid}/questions`,
  question: (uid: string, id: string) => `users/${uid}/questions/${id}`,
  customSkills: (uid: string) => `users/${uid}/skills`,
  customSkill: (uid: string, id: string) => `users/${uid}/skills/${id}`,
  quizzes: (uid: string) => `users/${uid}/quizzes`,
  quiz: (uid: string, id: string) => `users/${uid}/quizzes/${id}`,
  resources: (uid: string) => `users/${uid}/resources`,
  resource: (uid: string, id: string) => `users/${uid}/resources/${id}`,
  revision: (uid: string) => `users/${uid}/revision`,
  revisionItem: (uid: string, id: string) => `users/${uid}/revision/${id}`,
  mastery: (uid: string) => `learners/${uid}/mastery`,
  masteryRecord: (uid: string, skillId: string) => `learners/${uid}/mastery/${skillId}`,
  classes: () => 'classes',
  class: (classId: string) => `classes/${classId}`,
  classMembers: (classId: string) => `classes/${classId}/members`,
  classMember: (classId: string, uid: string) => `classes/${classId}/members/${uid}`,
  parentLink: (parentUid: string, childUid: string) => `parentLinks/${parentUid}__${childUid}`,
}

const ref = (path: string) => doc(requireDb(), path)
const sub = (path: string) => collection(requireDb(), path)

const data = <T>(snap: { id: string; data: () => DocumentData }): T => ({ id: snap.id, ...snap.data() }) as T

// ── Mastery ────────────────────────────────────────────────────────────────

/**
 * Read this learner's mastery. A brand-new learner has no documents at all and
 * the map is empty, which is the correct reading: not assessed, not zero.
 */
export async function readMastery(uid: string): Promise<Map<string, MasteryRecord>> {
  const snap = await getDocs(sub(paths.mastery(uid)))
  const out = new Map<string, MasteryRecord>()
  snap.forEach(d => out.set(d.id, d.data() as MasteryRecord))
  return out
}

/** Read several learners' mastery at once, for a class or parent view. */
export async function readMasteryFor(uidList: readonly string[]): Promise<Map<string, MasteryRecord[]>> {
  const db = requireDb()
  const results = await Promise.all(uidList.map(async uid => {
    const snap = await getDocs(collection(db, paths.mastery(uid)))
    return [uid, snap.docs.map(d => d.data() as MasteryRecord)] as const
  }))
  return new Map(results)
}

/**
 * Blend a sitting into a skill's mastery.
 *
 * The first real assessment becomes the baseline and is never overwritten, so
 * "you have improved by N points" always compares against something that
 * happened. After that, `current` moves toward the new score by a fixed step,
 * which keeps a single good or bad sitting from erasing a long history.
 *
 * The whole set of skills touched by one attempt is written in a single batch:
 * a partially applied attempt would leave a learner's own progress internally
 * inconsistent, with some skills updated and others not.
 */
const TREND_EPSILON = 4

export async function recordMasteryFromAttempt(
  uid: string,
  attempt: Pick<Attempt, 'results' | 'questionIds'> & { startedAt?: number; finishedAt?: number },
  skillIdByQuestionId: ReadonlyMap<string, string>,
): Promise<MasteryRecord[]> {
  const db = requireDb()
  const nowIso = new Date().toISOString()

  // Per-skill tally from this one sitting.
  const totals = new Map<string, { correct: number; total: number }>()
  attempt.questionIds.forEach((questionId, i) => {
    const skillId = skillIdByQuestionId.get(questionId)
    if (!skillId) return
    const entry = totals.get(skillId) ?? { correct: 0, total: 0 }
    entry.total += 1
    if (attempt.results[i]) entry.correct += 1
    totals.set(skillId, entry)
  })
  if (!totals.size) return []

  const existingSnap = await getDocs(sub(paths.mastery(uid)))
  const existing = new Map<string, MasteryRecord>()
  existingSnap.forEach(d => existing.set(d.id, d.data() as MasteryRecord))

  const batch = writeBatch(db)
  const written: MasteryRecord[] = []

  for (const [skillId, { correct, total }] of totals) {
    const score = Math.round((correct / total) * 100)
    const prior = existing.get(skillId)

    const attempts = (prior?.attempts ?? 0) + 1
    const correctTotal = (prior?.correct ?? 0) + correct
    // `correct` counts questions; `answered` is its denominator, so accuracy is
    // correct/answered.
    //
    // A record written before `answered` existed has no denominator and this
    // function has no way to recover one: it is handed a single attempt, not the
    // history. Falling back to `correctTotal` keeps it from reporting over 100% but
    // reports 100% accuracy for every legacy skill, and the error persists into
    // every later increment. The honest handling is done where the history *is*
    // available — `AppStore`'s load backfills the stored record from
    // `answeredBySkillFrom(attempts, …)` — so this is a floor, not an estimate.
    const answeredTotal = (prior?.answered ?? prior?.correct ?? 0) + total
    const baseline = prior?.baseline ?? score
    const current = prior?.current === null || prior?.current === undefined
      ? score
      : Math.round(prior.current + (score - prior.current) * 0.4)
    const delta = current - baseline

    const record: MasteryRecord = {
      skillId,
      baseline,
      current,
      attempts,
      correct: correctTotal,
      answered: answeredTotal,
      trend: delta > TREND_EPSILON ? 'improving' : delta < -TREND_EPSILON ? 'declining' : 'stable',
      lastPracticedAt: nowIso,
      updatedAt: nowIso,
    }

    batch.set(ref(paths.masteryRecord(uid, skillId)), record)
    written.push(record)
  }

  await batch.commit()
  return written
}

// ── Attempts ───────────────────────────────────────────────────────────────

/** Complete attempts, newest first. The source of streaks, time and accuracy. */
export async function readAttempts(uid: string, max = 100): Promise<Attempt[]> {
  const snap = await getDocs(
    query(sub(paths.attempts(uid)), orderBy('date', 'desc'), limit(max)),
  )
  return snap.docs.map(d => d.data() as Attempt)
}

export async function writeAttempt(uid: string, attempt: Attempt): Promise<void> {
  await setDoc(ref(paths.attempt(uid, attempt.id)), attempt)
}

/**
 * Completed attempts for several learners at once, for a class view.
 *
 * `firestore.rules` allows a teacher to read `users/{uid}/attempts` for a
 * learner in one of their classes, so this is the same read the learner makes
 * about themselves, widened to the roster.
 */
export async function readAttemptsFor(
  uidList: readonly string[],
  max = 100,
): Promise<Map<string, Attempt[]>> {
  const db = requireDb()
  const results = await Promise.all(uidList.map(async uid => {
    const snap = await getDocs(
      query(sub(paths.attempts(uid)), orderBy('date', 'desc'), limit(max)),
    )
    return [uid, snap.docs.map(d => d.data() as Attempt)] as const
  }))
  return new Map(results)
}

export async function deleteAttempt(uid: string, attemptId: string): Promise<void> {
  await deleteDoc(ref(paths.attempt(uid, attemptId)))
}

// ── Learner-owned collections ──────────────────────────────────────────────

/**
 * Read this learner's imported questions.
 *
 * A question bank is large and bulky, so it is stored once rather than copied
 * into every quiz. A quiz keeps only the ids, which is why reading a quiz
 * without its questions is a broken quiz: `importQuestions` writes both in one
 * batch, so a quiz never outlives its bank.
 */
export async function readQuestions(uid: string): Promise<Question[]> {
  const snap = await getDocs(sub(paths.questions(uid)))
  return snap.docs.map(d => d.data() as Question)
}

/**
 * Firestore caps a batched write at 500 operations.
 *
 * A question bank is the one import in this app that can realistically exceed
 * that: a term's worth of past papers is 150-question papers, and a teacher
 * uploading a full year's set goes past 500 in a single file. A batch of 501
 * does not partially apply — it is rejected in full — so a bank that size would
 * be lost entirely with no error the UI could show. Chunking turns that into
 * several successful writes instead.
 */
const BATCH_LIMIT = 500

async function writeInChunks<T extends object>(
  items: readonly T[],
  pathOf: (item: T, index: number) => string,
): Promise<void> {
  const db = requireDb()
  for (let start = 0; start < items.length; start += BATCH_LIMIT) {
    const batch = writeBatch(db)
    for (let i = start; i < Math.min(start + BATCH_LIMIT, items.length); i++) {
      batch.set(ref(pathOf(items[i], i)), items[i] as DocumentData)
    }
    await batch.commit()
  }
}

export async function writeQuestions(uid: string, questions: Question[]): Promise<void> {
  if (!questions.length) return
  await writeInChunks(questions, q => paths.question(uid, q.id))
}

/**
 * Skills an import had to invent, because the bank referenced a skill the
 * catalogue does not have.
 *
 * They are stored per learner rather than added to the shipped catalogue: a
 * question bank one learner uploaded is not curriculum, and promoting it would
 * make it appear in every other learner's Marks Map as though it were
 * assessed. `joinCustomSkills` reads them back with a null `current`, which is
 * the correct state for a skill no one has attempted.
 */
export async function readCustomSkills(uid: string): Promise<Skill[]> {
  const snap = await getDocs(sub(paths.customSkills(uid)))
  return snap.docs.map(d => d.data() as Skill)
}

export async function writeCustomSkills(uid: string, skills: Skill[]): Promise<void> {
  if (!skills.length) return
  await writeInChunks(skills, s => paths.customSkill(uid, s.id))
}

export async function readQuizzes(uid: string): Promise<Quiz[]> {
  const snap = await getDocs(query(sub(paths.quizzes(uid)), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => d.data() as Quiz)
}

export async function writeQuiz(uid: string, quiz: Quiz): Promise<void> {
  await setDoc(ref(paths.quiz(uid, quiz.id)), quiz)
}

export async function deleteQuiz(uid: string, quizId: string): Promise<void> {
  await deleteDoc(ref(paths.quiz(uid, quizId)))
}

export async function readResources(uid: string): Promise<Resource[]> {
  const snap = await getDocs(query(sub(paths.resources(uid)), orderBy('createdAt', 'desc')))
  return snap.docs.map(d => d.data() as Resource)
}

/**
 * Write resource metadata. The bytes go to Cloud Storage via `lib/uploads.ts`;
 * only the descriptor is stored here, so a Firestore document stays small and
 * a failed upload leaves no orphan record.
 */
export async function writeResource(uid: string, resource: Resource): Promise<void> {
  await setDoc(ref(paths.resource(uid, resource.id)), resource)
}

export async function deleteResource(uid: string, resourceId: string): Promise<void> {
  await deleteDoc(ref(paths.resource(uid, resourceId)))
}

export interface RevisionDoc {
  id: string
  complete: boolean
  completedAt: string | null
}

export async function readRevision(uid: string): Promise<RevisionDoc[]> {
  const snap = await getDocs(sub(paths.revision(uid)))
  return snap.docs.map(d => d.data() as RevisionDoc)
}

export async function setRevisionComplete(uid: string, id: string, complete: boolean): Promise<void> {
  await setDoc(ref(paths.revisionItem(uid, id)), {
    id,
    complete,
    completedAt: complete ? new Date().toISOString() : null,
  })
}

// ── Classes and relationships ──────────────────────────────────────────────

export interface ClassDoc {
  id: string
  name: string
  grade: number
  subjectId: SubjectId
  teacherUid: string
  createdAt: string
}

/** Classes a teacher owns. */
export async function readTeachingClasses(teacherUid: string): Promise<ClassDoc[]> {
  const snap = await getDocs(query(sub(paths.classes()), where('teacherUid', '==', teacherUid)))
  return snap.docs.map(d => data<ClassDoc>(d))
}

/**
 * Classes a learner is enrolled in.
 *
 * There is deliberately no implementation here, and that is a finding rather
 * than an omission. Membership lives in a subcollection, so the obvious query —
 * `collectionGroup('members').where('uid', '==', learnerUid)` — is rejected by
 * `firestore.rules` for *every* caller, including the learner themselves.
 *
 * The reason is that Firestore authorises a list query before any document is
 * known, in a scope where path variables are unbound. Every disjunct of the
 * membership read rule needs one: `isSelf(memberUid)` needs `memberUid`,
 * `isClassTeacher()` needs `classId`. With both unresolved each is false, so
 * the query is denied rather than filtered. There is no rule that can express
 * "the query's own constraint guarantees this is my row".
 *
 * This was verified against the live project: all four callers tried (learner,
 * parent, teacher, admin) were denied. The function was previously exported and
 * never called, so nothing was broken — it would have failed the first time
 * anything used it.
 *
 * If a learner ever needs their class list, the fix is to denormalise a
 * `classIds` array onto `users/{learnerUid}` alongside `teacherUids`, written by
 * the same provisioning step that writes enrolment. That is a single known
 * document, so a plain query on it is authorisable.
 */

/**
 * Enrolment for one class.
 *
 * `displayName` is denormalised onto the membership so a class roster is one
 * read rather than one read per learner to resolve a name. `firestore.rules`
 * keeps it in step with `users/{uid}.name` by only letting a teacher write their
 * own class's members.
 */
export interface Membership {
  uid: string
  role: UserRole
  displayName: string
  joinedAt: string
}

/** Enrolment for one class. */
export async function readMemberships(classId: string): Promise<Membership[]> {
  const snap = await getDocs(sub(paths.classMembers(classId)))
  return snap.docs.map(d => d.data() as Membership)
}

export async function readClass(classId: string): Promise<ClassDoc | null> {
  const snap = await getDoc(ref(paths.class(classId)))
  return snap.exists() ? data<ClassDoc>(snap) : null
}

/**
 * Add one member to a class.
 *
 * `scripts/provision.ts` reaches enrolment through the Admin SDK, which bypasses
 * the rules entirely, and the admin portal reaches it through the claim.
 *
 * Enrolment is an operator action and the rules enforce that: creating a
 * membership requires the admin claim, and so does writing the `teacherUids`
 * mirror it maintains. The two cannot be separated — the mirror *is* the access
 * grant, and a rule on a profile document cannot check which classes the caller
 * teaches — so they are written in one batch or not at all. The admin portal is
 * the only caller; `firestore.rules` requires the claim.
 *
 * `firestore.rules` also requires the `uid` field to equal the document id so a
 * member row cannot point at somebody else's account.
 */
export async function addMember(
  classId: string,
  uid: string,
  role: UserRole,
  displayName: string,
): Promise<void> {
  const db = requireDb()
  const klass = await readClass(classId)

  // The membership *and* the `teacherUids` mirror, in one batch. Teacher access to
  // a learner is authorised from the mirror, not from the membership document, so
  // writing only the membership produced an enrolment that looked complete in the
  // roster and granted the teacher nothing: `useRoster` then failed every read for
  // that learner and the class reported "could not load". Both records have to
  // land together or the enrolment is half-made.
  const batch = writeBatch(db)
  batch.set(ref(paths.classMember(classId, uid)), {
    uid,
    role,
    displayName,
    joinedAt: new Date().toISOString(),
  })
  if (klass?.teacherUid) batch.set(ref(paths.user(uid)), {
    teacherUids: arrayUnion(klass.teacherUid),
  }, { merge: true })
  await batch.commit()
}

/**
 * Remove a member, revoking the class teacher's access to them.
 *
 * Deleting the membership alone left `teacherUids` intact, so an unenrolled
 * teacher kept read access to that learner's entire attempt history, mastery and
 * revision plan — invisibly, with no screen that reveals or undoes it.
 */
export async function removeMember(classId: string, uid: string): Promise<void> {
  const db = requireDb()
  const klass = await readClass(classId)

  const batch = writeBatch(db)
  batch.delete(ref(paths.classMember(classId, uid)))
  if (klass?.teacherUid) batch.set(ref(paths.user(uid)), {
    teacherUids: arrayRemove(klass.teacherUid),
  }, { merge: true })
  await batch.commit()
}

/**
 * Children linked to a parent. Read through the link collection rather than by
 * listing every user, so a parent can only ever discover their own children.
 *
 * `firestore.rules` authorises this on `resource.data.parentUid` alone, with no
 * conjunct naming the document id: a list query is authorised before any document
 * is known, so a rule that also required `linkId == parentLinkId(myUid(),
 * resource.data.childUid)` could never be proven and the query was rejected. The
 * parent portal is unusable without this read, so `scripts/rules-matrix.ts` asserts
 * it live.
 */
export async function readChildLinks(parentUid: string): Promise<string[]> {
  const snap = await getDocs(query(collection(requireDb(), 'parentLinks'), where('parentUid', '==', parentUid)))
  return snap.docs.map(d => d.data().childUid as string)
}

export async function linkParentToChild(parentUid: string, childUid: string): Promise<void> {
  await setDoc(ref(paths.parentLink(parentUid, childUid)), {
    parentUid,
    childUid,
    createdAt: new Date().toISOString(),
  })
}

// ── Operator queries ───────────────────────────────────────────────────────
//
// Everything below exists for the admin portal and is authorised by exactly one
// thing: `isAdmin()` in `firestore.rules`, which tests
// `request.auth.token.admin == true` and references no path variable.
//
// That detail is what makes these *list* queries legal. Firestore authorises a
// query before any document is known, with `uid`/`classId` unbound, so a rule
// like `isSelf(uid)` is false for every candidate row. `isAdmin()` has nothing
// to bind, so it holds for all of them and the query is not rejected. Every
// other caller's view is still gated — this widens who may read the whole
// population, never what an unprivileged account may read.
//
// Note what is deliberately absent: there is no `listEnrolledClasses`. Finding a
// learner's classes needs `collectionGroup('members')`, which is denied for every
// caller including an admin, because `isClassTeacher()` needs `classId`. See the
// `readEnrolledClasses` note above. Roster access here is per-class, which the
// rules do authorise.

export interface ParentLinkDoc {
  /** The `{parentUid}__{childUid}` document id. */
  id: string
  parentUid: string
  childUid: string
  createdAt: string
}

/** Every profile. Admin only. */
export async function listProfiles(): Promise<Array<Profile & { id: string }>> {
  const snap = await getDocs(sub(paths.users()))
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Profile) }))
}

/** Every class. Admin only. */
export async function listClasses(): Promise<ClassDoc[]> {
  const snap = await getDocs(sub(paths.classes()))
  return snap.docs.map(d => data<ClassDoc>(d))
}

/** Every parent → child link. Admin only. */
export async function listParentLinks(): Promise<ParentLinkDoc[]> {
  const snap = await getDocs(sub('parentLinks'))
  return snap.docs.map(d => data<ParentLinkDoc>(d))
}

/**
 * Create a class.
 *
 * Admin only (`firestore.rules` allows create on `classes/{classId}` to
 * `isAdmin()` alone — not a teacher, who may only update a class they already
 * own).
 *
 * `teacherUid` is required rather than defaulted. A class with no teacher is
 * invisible to that teacher forever and to no one else either, because enrolment
 * rights are derived from `classes.teacherUid`; the alternative is a class that
 * silently shows an empty roster.
 */
export async function createClass(input: {
  classId: string
  name: string
  grade: number
  subjectId: SubjectId
  teacherUid: string
}): Promise<void> {
  await setDoc(ref(paths.class(input.classId)), {
    id: input.classId,
    name: input.name.trim() || input.classId,
    grade: input.grade,
    subjectId: input.subjectId,
    teacherUid: input.teacherUid,
    createdAt: new Date().toISOString(),
  })
}

/**
 * Delete a class, its enrolment, and the access that enrolment granted.
 *
 * `deleteDoc` on the class document does not cascade to subcollections, so every
 * `classes/{id}/members/{uid}` would have survived as an orphan: permanently
 * unreachable — `isClassTeacher` needs the class document to exist — but still
 * stored. Worse, `teachesLearner` never consults `classes`, so the deleted
 * teacher would have kept read access to every former student's attempts, mastery
 * and revision plan while the class no longer appeared anywhere in their UI.
 *
 * Members are removed and the mirror unlinked first, then the class document.
 */
export async function deleteClass(classId: string): Promise<void> {
  const db = requireDb()
  const klass = await readClass(classId)
  const members = await readMemberships(classId)

  for (const member of members) {
    const batch = writeBatch(db)
    batch.delete(ref(paths.classMember(classId, member.uid)))
    if (klass?.teacherUid) {
      batch.set(ref(paths.user(member.uid)), {
        teacherUids: arrayRemove(klass.teacherUid),
      }, { merge: true })
    }
    await batch.commit()
  }

  await deleteDoc(ref(paths.class(classId)))
}

/**
 * Remove a parent → child link. Admin only.
 *
 * A link is only ever removed by deleting the document; `firestore.rules` makes
 * `update` on `parentLinks` unconditionally false, so a link cannot be re-pointed
 * at a different child. Re-linking is delete-then-create, which is deliberate:
 * re-pointing a link in place is the kind of edit that silently transfers access
 * to a child nobody approved.
 */
export async function unlinkParentFromChild(parentUid: string, childUid: string): Promise<void> {
  await deleteDoc(ref(paths.parentLink(parentUid, childUid)))
}

// ── Streak ─────────────────────────────────────────────────────────────────

/**
 * Advance the study streak for a real sitting.
 *
 * A streak is consecutive calendar days with at least one completed attempt, so
 * it is computed from the attempt history rather than incremented per sitting:
 * four quizzes in one afternoon is one day, not four. Today counts if any
 * attempt landed today; a gap of exactly one day continues; a longer gap resets
 * to one, because the streak the learner had genuinely ended.
 *
 * The count is derived rather than trusted from the stored value, so a stale or
 * tampered `streak` on the profile cannot inflate it — the profile field is
 * written from this result, not the source of it.
 */
export async function advanceStreak(uid: string): Promise<{ streak: number; lastStudyDate: string }> {
  const today = localDay()

  // 60 attempts is about two months of daily study, comfortably more than any
  // streak a learner can plausibly hold, and it bounds the read.
  const snap = await getDocs(query(sub(paths.attempts(uid)), orderBy('date', 'desc'), limit(60)))
  const days = new Set(
    snap.docs.map(d => isoDay((d.data() as Attempt).date)),
  )

  // The streak counts back from today, or from the most recent study day if
  // today has nothing yet — otherwise a learner who studied yesterday and not
  // yet today would see their streak drop to zero mid-morning.
  const anchor = days.has(today) ? today : [...days][0]
  let streak = 0
  if (anchor) {
    for (let cursor = anchor; dayGap(cursor, today) >= 0; cursor = previousDay(cursor)) {
      if (!days.has(cursor)) break
      streak += 1
    }
  }

  await setDoc(ref(paths.user(uid)), { streak, lastStudyDate: today }, { merge: true })
  return { streak, lastStudyDate: today }
}

/**
 * Put the streak fields back to a cold start.
 *
 * `deleteAllLearnerData` clears every attempt, so the streak it left behind
 * described days that no longer exist: a learner who erased their data kept a
 * 40-day streak on the dashboard and the profile. Called alongside the delete so
 * the two cannot disagree.
 */
export async function resetStreak(uid: string): Promise<void> {
  await setDoc(ref(paths.user(uid)), { streak: 0, lastStudyDate: null }, { merge: true })
}

const DAY_MS = 24 * 60 * 60 * 1000

// Attempt dates are written with `localDay` from `lib/storage`, so the streak has
// to read them back the same way. Parsing a `YYYY-MM-DD` with `new Date` treats
// it as UTC midnight, which is the previous day for any negative-offset zone and
// inflated a streak that should have read 1.
const isoDay = (day: string): string => day

const dayGap = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)

// Arithmetic on the `YYYY-MM-DD` strings themselves. Stepping through `Date`
// and re-serialising is the same trick as reading them back with a local-offset
// date in the first place: the day keys are calendar labels, not instants.
const previousDay = (day: string): string => {
  const back = new Date(Date.parse(`${day}T00:00:00Z`) - DAY_MS)
  return back.toISOString().slice(0, 10)
}

// ── Data removal ───────────────────────────────────────────────────────────

/**
 * Delete everything this learner owns, in Firestore.
 *
 * Used by "erase my data" in the profile. Cloud Storage objects are removed by
 * the caller through `lib/firebase/uploads.ts`, because that needs the Storage
 * SDK and this module deliberately does not depend on it.
 *
 * The collection groups are listed explicitly rather than discovered, so a
 * collection added later cannot be silently left behind with the learner's
 * data still in it. `writeBatch` caps at 500 operations, hence the chunking.
 */
export async function deleteAllLearnerData(uid: string): Promise<void> {
  const groups: { path: string; field: string }[] = [
    { path: paths.attempts(uid), field: 'attempts' },
    { path: paths.questions(uid), field: 'questions' },
    { path: paths.customSkills(uid), field: 'skills' },
    { path: paths.quizzes(uid), field: 'quizzes' },
    { path: paths.resources(uid), field: 'resources' },
    { path: paths.revision(uid), field: 'revision' },
    { path: paths.mastery(uid), field: 'mastery' },
  ]

  const db = requireDb()
  for (const group of groups) {
    const snap = await getDocs(sub(group.path))
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db)
      snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref))
      await batch.commit()
    }
  }

  // No attempt survives, so the streak derived from them cannot either.
  await resetStreak(uid)
}

/**
 * Recompute a set of skills' mastery from the attempts that remain.
 *
 * `deleteAttempt` removes the document, but mastery is a *blended* running
 * record: without this the deleted sitting's score stays in the Marks Map and
 * the only way to correct it was to sit another quiz. Mastery is rebuilt from
 * the surviving attempts in the same order they were written, so a learner's
 * baseline is still their first real assessment.
 *
 * An attempt only carries its results and question ids, so the caller supplies
 * the question → skill map it was recorded against.
 */
/**
 * Write whole mastery records for a learner.
 *
 * Used by the `answered` backfill, which repairs a field on a record computed from a
 * history `recordMasteryFromAttempt` no longer has. It rewrites the document rather
 * than merging, because the caller already holds the record it wants stored.
 */
export async function writeMasteryAnswers(
  uid: string,
  records: readonly MasteryRecord[],
): Promise<void> {
  if (!records.length) return
  const db = requireDb()
  const batch = writeBatch(db)
  for (const record of records) {
    batch.set(ref(paths.masteryRecord(uid, record.skillId)), record)
  }
  await batch.commit()
}

/**
 * Recompute mastery for the given skills from `attempts`, and nothing else, then
 * store the result.
 *
 * `attempts` must already exclude whatever was deleted — that is the point of the
 * call, and why the arithmetic lives in `recomputeMastery` (`@/lib/roster`) with no
 * access to the stored records. It used to seed each skill's first surviving attempt
 * from the stored record, which added the deleted attempt straight back: `current`
 * is a blend over the whole history and its `correct` and `answered` counts included
 * the attempt that no longer existed, so the score barely moved and the counts never
 * came down.
 *
 * `updatedAt` therefore comes from the attempt's own date rather than "now". That is
 * deliberate — it keeps this a pure restatement of the history it was given, so the
 * same attempts always produce the same record and `scripts/check-data.ts` can assert
 * it. A rebuild is not a new event.
 */
export async function rebuildMasteryForSkills(
  uid: string,
  skillIds: readonly string[],
  attempts: readonly Attempt[],
  skillIdByQuestionId: ReadonlyMap<string, string>,
): Promise<MasteryRecord[]> {
  const db = requireDb()
  if (!skillIds.length) return []

  const rebuilt = recomputeMastery(attempts, skillIdByQuestionId)

  // Only the caller's skills are touched, and only those the rebuild produced.
  const wanted = new Set(skillIds)
  const batch = writeBatch(db)
  const written: MasteryRecord[] = []
  for (const [skillId, record] of rebuilt) {
    if (!wanted.has(skillId)) continue
    batch.set(ref(paths.masteryRecord(uid, skillId)), record)
    written.push(record)
  }
  // A skill with no surviving evidence is deleted rather than zeroed: "not
  // assessed" and "scored zero" are different states, and only the first is true.
  for (const skillId of skillIds) {
    if (!rebuilt.has(skillId)) batch.delete(ref(paths.masteryRecord(uid, skillId)))
  }

  await batch.commit()
  return written
}

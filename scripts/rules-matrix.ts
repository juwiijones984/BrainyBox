// End-to-end security rules matrix against the live project.
//
// Every case signs in as a real user through the *client* SDK, so what is being
// tested is the same code path the browser uses, not the Admin SDK (which
// bypasses rules entirely and would prove nothing).
//
// Fixtures are created with the Admin SDK because the three relationship
// records a browser is correctly forbidden to write — class membership,
// parent links, and the teacherUids mirror — are exactly what the rules depend
// on. Everything is deleted afterwards, including the accounts.
//
// It creates five real accounts in the target project and removes them on the
// way out, so point it at a project you are allowed to write to:
//
//   $env:FIREBASE_PROJECT_ID = 'brainy-box-c428e'
//   $env:GOOGLE_APPLICATION_CREDENTIALS = 'path\to\service-account.json'
//   npm run rules:matrix
//
// It exits non-zero if any case does not match, so it works as a gate.

import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, deleteDoc, collection, collectionGroup, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { getFirestore } from 'firebase/firestore'
import { cert, initializeApp as initAdmin } from 'firebase-admin/app'
import { getAuth as getAdminAuth } from 'firebase-admin/auth'
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

const projectId = process.env.FIREBASE_PROJECT_ID!
const key = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS!, 'utf8'))
// A UUID, not a timestamp: `deleteUser` is eventually consistent, so a crashed
// run's addresses stay reserved for a while and a second run in the same
// millisecond would collide on EMAIL_EXISTS before asserting anything.
const STAMP = randomUUID().slice(0, 8)
const PASSWORD = 'Matrix-Test-1234'

const admin = initAdmin({ credential: cert(key), projectId }, 'admin')
const adminAuth = getAdminAuth(admin)
const adb = getAdminFirestore(admin)

// A previous run that crashed mid-way leaves accounts behind, and the next run
// then dies on EMAIL_EXISTS before asserting anything. Clear them first so the
// result reflects the rules rather than the debris.
{
  const doomed = (await adminAuth.listUsers(1000)).users.filter((u) => u.email?.startsWith('matrix-'))
  let stale = 0
  for (const u of doomed) {
    await adb.doc(`users/${u.uid}`).delete().catch(() => {})
    await adb.recursiveDelete(adb.doc(`learners/${u.uid}`)).catch(() => {})
    try {
      await adminAuth.deleteUser(u.uid)
      stale++
    } catch (e: any) {
      // Swallowing this is how the next run dies on EMAIL_EXISTS, so say so.
      console.log(`  (could not delete stale ${u.email}: ${String(e.message).slice(0, 60)})`)
    }
  }
  if (stale) console.log(`  (cleared ${stale} stale account(s) from a previous run)`)
}

// ── Fixtures ───────────────────────────────────────────────────────────────

// The address per role is recorded so the client sign-in later uses exactly
// what was created, even if a collision forced a regeneration.
const emailOf = new Map<string, string>()

// `key` identifies the account in this script; `role` is what the profile
// says. They differ for the stranger: two learners are needed (one enrolled,
// one not) and keying both as 'learner' would give them the same address.
const mk = async (key: string, role: string, name: string, claims?: Record<string, unknown>) => {
  let u
  for (let attempt = 0; ; attempt++) {
    const email = `matrix-${key}-${attempt === 0 ? STAMP : randomUUID().slice(0, 8)}@example.com`
    try {
      u = await adminAuth.createUser({
        email,
        password: PASSWORD,
        displayName: name,
        emailVerified: true,
      })
      emailOf.set(key, email)
      if (attempt > 0) console.log(`  (address collision on ${key}; used ${email})`)
      break
    } catch (e: any) {
      if (e?.code !== 'auth/email-already-exists' || attempt >= 5) throw e
    }
  }
  if (claims) await adminAuth.setCustomUserClaims(u.uid, claims)
  await adb.doc(`users/${u.uid}`).set({
    role, name, grade: role === 'learner' ? 10 : null,
    avatar: name.slice(0, 2).toUpperCase(), streak: 0,
    lastStudyDate: null, subjects: role === 'learner' ? ['mathematics'] : [],
    createdAt: new Date().toISOString(),
  })
  return u.uid
}

/**
 * A credential with no `users/{uid}` document.
 *
 * `createProfile` has not run for these, so a write to `users/{uid}` is a
 * *create*. A fixture account cannot be used for this: the document already
 * exists, so the write is an `update` and the update rule answers instead of the
 * create rule — which would make a privileged-role case pass for the wrong
 * reason, and a learner case fail for an unrelated one.
 *
 * One account per attempt, for the same reason. A denied create leaves state
 * behind in the client SDK, and reusing the path makes the *next* attempt depend
 * on the previous one's outcome.
 */
const mkAuthOnly = async (key: string) => {
  const email = `matrix-${key}-${randomUUID().slice(0, 8)}@example.com`
  const u = await adminAuth.createUser({ email, password: PASSWORD, emailVerified: true })
  emailOf.set(key, email)
  return u.uid
}

const L = await mk('learner', 'learner', 'Matrix Learner')
const S = await mk('stranger', 'learner', 'Matrix Stranger')
const P = await mk('parent', 'parent', 'Matrix Parent')
const T = await mk('teacher', 'teacher', 'Matrix Teacher')
const A = await mk('admin', 'learner', 'Matrix Admin', { admin: true })
const F = {
  teacher: await mkAuthOnly('forger-teacher'),
  parent: await mkAuthOnly('forger-parent'),
  admin: await mkAuthOnly('forger-admin'),
  learner: await mkAuthOnly('forger-learner'),
}
const CLASS = 'matrix-class'

// Operator-written relationships.
await adb.doc(`classes/${CLASS}`).set({
  id: CLASS, name: 'Matrix Class', subjectId: 'mathematics',
  teacherUid: T, createdAt: new Date().toISOString(),
})
await adb.doc(`classes/${CLASS}/members/${L}`).set({
  uid: L, role: 'learner', displayName: 'Matrix Learner', joinedAt: new Date().toISOString(),
})
await adb.doc(`users/${L}`).set({ teacherUids: [T] }, { merge: true })
await adb.doc(`parentLinks/${P}__${L}`).set({
  parentUid: P, childUid: L, createdAt: new Date().toISOString(),
})

// Content for L, written by the operator, so reads have something to be denied.
await adb.doc(`learners/${L}/mastery/ALG-LIN`).set({
  skillId: 'ALG-LIN', baseline: 30, current: 55, attempts: 2, correct: 1,
  trend: 'improving', lastPracticedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
})
await adb.doc(`users/${L}/attempts/a1`).set({
  id: 'a1', skillId: 'ALG-LIN', date: new Date().toISOString(),
  correct: 1, total: 2, scorePct: 50, title: 'Matrix attempt', answers: {},
})
await adb.doc(`users/${L}/questions/q1`).set({ id: 'q1', text: 'Matrix question' })
await adb.doc(`users/${L}/resources/r1`).set({ id: 'r1', name: 'r.txt', path: 'users/L/r1/r.txt' })

// ── Clients, one per role, all on the real project ─────────────────────────

const clients = new Map<string, { auth: ReturnType<typeof getAuth>; db: ReturnType<typeof getFirestore>; app: ReturnType<typeof initializeApp> }>()

// The client SDK signs in against the real project, so it needs the same public
// web config the browser uses. Read it from the environment so this script is
// not welded to one project; these are public identifiers, not secrets.
const webConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY!,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN!,
  projectId,
  appId: process.env.VITE_FIREBASE_APP_ID!,
}
if (!webConfig.apiKey || !webConfig.appId) {
  console.error(
    '\n  VITE_FIREBASE_API_KEY and VITE_FIREBASE_APP_ID must be set for the client SDK.\n' +
    '  Copy them from Project settings → Your apps → SDK setup and configuration.\n',
  )
  process.exit(1)
}

for (const [role] of [['learner'], ['stranger'], ['parent'], ['teacher'], ['admin'], ['forger-teacher'], ['forger-parent'], ['forger-admin'], ['forger-learner']] as const) {
  const app = initializeApp(webConfig, role)
  const auth = getAuth(app)
  await signInWithEmailAndPassword(auth, emailOf.get(role)!, PASSWORD)
  clients.set(role, { auth, db: getFirestore(app), app })
}

// ── Matrix ─────────────────────────────────────────────────────────────────

type Expect = 'allow' | 'deny'
const results: { label: string; expected: Expect; got: string; pass: boolean }[] = []

const as = (role: string) => clients.get(role)!.db

/** A denial is a security failure; any other error is a broken test. */
const DENIAL = /permission|insufficient|denied|unauthenticated|forbidden|not authorized|requires/i

const case_ = async (label: string, role: string, expected: Expect, fn: () => Promise<unknown>) => {
  let got: string
  try {
    await fn()
    got = 'allow'
  } catch (e: any) {
    const message = String(e?.message ?? e)
    // An unrecognised error is reported as itself rather than folded into
    // 'deny', so a typo in a case cannot masquerade as a passing security check.
    got = DENIAL.test(message) ? 'deny' : `error: ${message.slice(0, 90)}`
  }
  results.push({ label, expected, got, pass: got === expected })
}

// The variadic `doc(firestore, path, ...segments)` overload needs a tuple, not a
// plain `string[]`, or TypeScript binds to the collection overload and rejects
// a call that is actually correct.
const read = (role: string, ...p: string[]) => getDoc(doc(as(role), ...(p as [string, ...string[]])))

/** A whole-collection query — the shape the admin dashboard actually issues. */
const list = (role: string, ...p: string[]) =>
  getDocs(collection(as(role), ...(p as [string, ...string[]])))

/**
 * Write a whole profile document, as a browser would when registering.
 *
 * `role` is written to `users/{uid}` by the client signed in as `key`, so
 * `isSelf(uid)` holds and only the create rule's role clause can answer.
 */
const forgeProfile = (key: string, uid: string, role: string) =>
  setDoc(doc(as(key), 'users', uid), {
    role,
    name: 'Forged Name',
    grade: role === 'learner' ? 10 : null,
    avatar: 'FN',
    streak: 0,
    lastStudyDate: null,
    subjects: role === 'learner' ? ['mathematics'] : [],
    createdAt: new Date().toISOString(),
  })

// reads
await case_('learner reads own profile', 'learner', 'allow', () => read('learner', 'users', L))
await case_('learner reads stranger profile', 'learner', 'deny', () => read('learner', 'users', S))
await case_('parent reads linked child profile', 'parent', 'allow', () => read('parent', 'users', L))
await case_('parent reads unlinked child profile', 'parent', 'deny', () => read('parent', 'users', S))
// The parent portal's own discovery read: `readChildLinks` lists `parentLinks`
// with `where('parentUid', '==', myUid())`. This is a *list* query, so Firestore
// authorises it before any document is known — any conjunct naming the wildcard
// `linkId` fails there, which is why the rule used to deny this and the portal
// never found a linked child. There was only a learner-deny and an admin-allow
// case, so nothing covered the parent who is supposed to succeed.
await case_('parent LISTS their own child links', 'parent', 'allow', () =>
  getDocs(query(collection(as('parent'), 'parentLinks'), where('parentUid', '==', P))))
await case_('a learner cannot list parent links', 'learner', 'deny', () =>
  getDocs(query(collection(as('learner'), 'parentLinks'), where('parentUid', '==', P))))
await case_('a stranger cannot list parent links', 'stranger', 'deny', () =>
  getDocs(query(collection(as('stranger'), 'parentLinks'), where('parentUid', '==', P))))
// Note there is deliberately no "child lists their own links" case. The rule
// authorises a list only on the field the query constrains, so a query filtering
// on `childUid` is still denied for the child: the `parentUid` disjunct cannot be
// proven from it. Nothing in the app makes that read, so the limitation is
// documented here rather than written off as a passing case.
await case_('teacher reads enrolled learner profile', 'teacher', 'allow', () => read('teacher', 'users', L))
await case_('teacher reads non-enrolled profile', 'teacher', 'deny', () => read('teacher', 'users', S))
await case_('stranger reads learner profile', 'stranger', 'deny', () => read('stranger', 'users', L))

// learner progress
await case_('learner reads own mastery', 'learner', 'allow', () => read('learner', 'learners', L, 'mastery', 'ALG-LIN'))
await case_('parent reads child mastery', 'parent', 'allow', () => read('parent', 'learners', L, 'mastery', 'ALG-LIN'))
await case_('teacher reads enrolled learner mastery', 'teacher', 'allow', () => read('teacher', 'learners', L, 'mastery', 'ALG-LIN'))
await case_('stranger reads learner mastery', 'stranger', 'deny', () => read('stranger', 'learners', L, 'mastery', 'ALG-LIN'))
await case_('stranger WRITES learner mastery', 'stranger', 'deny', () => setDoc(doc(as('stranger'), 'learners', L, 'mastery', 'ALG-LIN'), { current: 99 }))

// attempts
await case_('learner reads own attempts', 'learner', 'allow', () => read('learner', 'users', L, 'attempts', 'a1'))
await case_('parent reads child attempts', 'parent', 'allow', () => read('parent', 'users', L, 'attempts', 'a1'))
await case_('teacher reads enrolled learner attempts', 'teacher', 'allow', () => read('teacher', 'users', L, 'attempts', 'a1'))
await case_('stranger reads learner attempts', 'stranger', 'deny', () => read('stranger', 'users', L, 'attempts', 'a1'))
await case_('stranger WRITES learner attempts', 'stranger', 'deny', () => setDoc(doc(as('stranger'), 'users', L, 'attempts', 'hack'), { scorePct: 100 }))
await case_('parent WRITES child attempts', 'parent', 'deny', () => setDoc(doc(as('parent'), 'users', L, 'attempts', 'hack2'), { scorePct: 100 }))

// questions (the app was broken here before the fix)
await case_('learner writes own question', 'learner', 'allow', () => setDoc(doc(as('learner'), 'users', L, 'questions', 'q2'), { id: 'q2', text: 'mine' }))
await case_('learner LISTS own questions', 'learner', 'allow', () => getDocs(collection(as('learner'), 'users', L, 'questions')))
await case_('stranger writes learner question', 'stranger', 'deny', () => setDoc(doc(as('stranger'), 'users', L, 'questions', 'q3'), { id: 'q3' }))
await case_('parent writes learner question', 'parent', 'deny', () => setDoc(doc(as('parent'), 'users', L, 'questions', 'q4'), { id: 'q4' }))
await case_('learner deletes own question', 'learner', 'allow', () => deleteDoc(doc(as('learner'), 'users', L, 'questions', 'q2')))
await case_('stranger deletes learner question', 'stranger', 'deny', () => deleteDoc(doc(as('stranger'), 'users', L, 'questions', 'q1')))

// profile self-edits
await case_('learner edits own display name', 'learner', 'allow', () => updateDoc(doc(as('learner'), 'users', L), { name: 'Renamed' }))
await case_('learner changes own grade', 'learner', 'allow', () => updateDoc(doc(as('learner'), 'users', L), { grade: 11 }))
// `grade` is learner-only. The update rule's `hasOnly` list is shared by every
// role, so without the separate guard a parent or teacher could set a grade after
// registration — breaking the invariant the create rule is careful about.
await case_('parent sets a grade on own profile', 'parent', 'deny', () => updateDoc(doc(as('parent'), 'users', P), { grade: 11 }))
await case_('teacher sets a grade on own profile', 'teacher', 'deny', () => updateDoc(doc(as('teacher'), 'users', T), { grade: 11 }))
await case_('parent edits own display name', 'parent', 'allow', () => updateDoc(doc(as('parent'), 'users', P), { name: 'Renamed Parent' }))
await case_('learner promotes self to teacher', 'learner', 'deny', () => updateDoc(doc(as('learner'), 'users', L), { role: 'teacher' }))
await case_('learner sets own admin claim in profile', 'learner', 'deny', () => updateDoc(doc(as('learner'), 'users', L), { admin: true }))
// A *different* value, not the one already there: `diff().affectedKeys()` omits
// keys whose value is unchanged, so writing the existing value back is a no-op
// and would pass even with the field unprotected.
await case_('learner rewrites own teacherUids mirror', 'learner', 'deny', () => updateDoc(doc(as('learner'), 'users', L), { teacherUids: [S] }))
await case_('learner clears own teacherUids mirror', 'learner', 'deny', () => updateDoc(doc(as('learner'), 'users', L), { teacherUids: [] }))
await case_('learner writes to own doc a stranger uid', 'learner', 'deny', () => setDoc(doc(as('learner'), 'users', S), { name: 'hijack' }))

// The teacherUids mirror is operator-only.
//
// This case used to be `allow`: the rule let a class teacher write the mirror,
// scoped by comparing `teacherUids.removeAll([myUid()])` on both sides so that only
// the caller's own entry could change. That comparison is made *after* removing the
// caller, so writing `[T]` onto a stranger's profile passes it — a teacher could
// grant themselves access to a learner they were never enrolled to teach. The
// mirror is the access grant, and no rule on a profile document can check which
// classes the caller teaches, so the mirror is now admin-only and the case below
// pins the denial.
await case_('teacher writes their own mirror entry onto a learner', 'teacher', 'deny', () =>
  updateDoc(doc(as('teacher'), 'users', S), { teacherUids: [T] }))
await case_('teacher grants a colleague access via the mirror', 'teacher', 'deny', () =>
  updateDoc(doc(as('teacher'), 'users', L), { teacherUids: [T, S] }))
await case_('teacher clears another teacher off the mirror', 'teacher', 'deny', () =>
  updateDoc(doc(as('teacher'), 'users', L), { teacherUids: [] }))
// Enrolment maintains the mirror, so it is admin-only for the same reason. A class
// teacher may still read the roster and correct an existing row's display name.
await case_('teacher creates a class enrolment', 'teacher', 'deny', () =>
  setDoc(doc(as('teacher'), `classes/${CLASS}/members/${S}`), { uid: S, role: 'learner' }))
await case_('teacher deletes a class enrolment', 'teacher', 'deny', () =>
  deleteDoc(doc(as('teacher'), `classes/${CLASS}/members/${S}`)))
await case_('teacher reads the class roster', 'teacher', 'allow', () =>
  getDoc(doc(as('teacher'), `classes/${CLASS}/members/${S}`)))
await case_('teacher corrects an enrolment display name', 'teacher', 'allow', () =>
  updateDoc(doc(as('teacher'), `classes/${CLASS}/members/${S}`), { displayName: 'Renamed' }))
await case_('admin creates a class enrolment', 'admin', 'allow', () =>
  setDoc(doc(as('admin'), `classes/${CLASS}/members/${S}`), { uid: S, role: 'learner' }))
await case_('admin updates the mirror', 'admin', 'allow', () =>
  updateDoc(doc(as('admin'), 'users', S), { teacherUids: [T] }))
await adb.doc(`users/${S}`).set({ teacherUids: [] }, { merge: true })

// operator-only records
await case_('parent creates own parent link', 'parent', 'deny', () => setDoc(doc(as('parent'), `parentLinks/${P}__${S}`), { parentUid: P, childUid: S, createdAt: new Date().toISOString() }))
await case_('parent self-enrols in a class', 'parent', 'deny', () => setDoc(doc(as('parent'), `classes/${CLASS}/members/${P}`), { uid: P, role: 'learner' }))
await case_('learner self-enrols in a class', 'learner', 'deny', () => setDoc(doc(as('learner'), `classes/${CLASS}/members/${L}`), { uid: L, role: 'learner' }))
await case_('learner creates a class', 'learner', 'deny', () => setDoc(doc(as('learner'), `classes/forged-${STAMP}`), { id: 'forged', teacherUid: L }))
await case_('learner edits member record uid', 'learner', 'deny', () => setDoc(doc(as('learner'), `classes/${CLASS}/members/${L}`), { uid: S, role: 'learner' }))

// A self-declared role, written directly through the client SDK rather than
// through the register form. This is the case the UI cannot prevent: anything
// holding a valid credential can call the Firestore API itself, so the register
// form is cosmetic and the rules are what actually count.
//
// Declaring `parent` or `teacher` is now permitted — it always was safe to do,
// because a declared role carries no access on its own. The cases below that
// follow are the ones that matter: they prove the declaration bought nothing.
await case_('profile create may declare the teacher role', 'forger-teacher', 'allow', () => forgeProfile('forger-teacher', F.teacher, 'teacher'))
await case_('profile create may declare the parent role', 'forger-parent', 'allow', () => forgeProfile('forger-parent', F.parent, 'parent'))
// Still denied, and the most important case in this file: `admin` is a token
// claim, not a role, so no `users/{uid}` value can confer it.
await case_('profile create cannot claim the admin role', 'forger-admin', 'deny', () => forgeProfile('forger-admin', F.admin, 'admin'))
await case_('profile create as a learner is allowed', 'forger-learner', 'allow', () => forgeProfile('forger-learner', F.learner, 'learner'))

// `grade` is meaningful only for a learner. Both branches of the create rule are
// required: written as `role != 'learner' || grade is int || grade == null` the
// first disjunct is true for every non-learner and short-circuits, leaving grade
// unrestricted for parents and teachers. These cases would have passed against
// that expression.
const forgeProfileWithGrade = (key: string, uid: string, role: string, grade: unknown) =>
  setDoc(doc(as(key), 'users', uid), {
    role,
    name: 'Forged Name',
    grade,
    avatar: 'FN',
    streak: 0,
    lastStudyDate: null,
    subjects: [],
    createdAt: new Date().toISOString(),
  })
await case_('profile create as a parent cannot carry a grade', 'forger-parent', 'deny', () =>
  forgeProfileWithGrade('forger-parent', `matrix-grade-parent-${STAMP}`, 'parent', 11))
await case_('profile create as a teacher cannot carry a grade', 'forger-teacher', 'deny', () =>
  forgeProfileWithGrade('forger-teacher', `matrix-grade-teacher-${STAMP}`, 'teacher', 11))
await case_('profile create as a learner requires an integer grade', 'forger-learner', 'deny', () =>
  forgeProfileWithGrade('forger-learner', `matrix-grade-nan-${STAMP}`, 'learner', 'eleven'))

// A declared role must not become a key. Each of these uses one of the accounts
// created immediately above, so the profile genuinely says `teacher`/`parent` by
// the time the read is attempted — the access has to come from the role alone,
// and it does not.
await case_('self-declared teacher reads a learner profile', 'forger-teacher', 'deny', () => getDoc(doc(as('forger-teacher'), 'users', L)))
await case_('self-declared teacher LISTS a class roster', 'forger-teacher', 'deny', () => getDocs(collection(as('forger-teacher'), 'classes', CLASS, 'members')))
await case_('self-declared teacher writes to a class roster', 'forger-teacher', 'deny', () => setDoc(doc(as('forger-teacher'), `classes/${CLASS}/members/${F.teacher}`), { uid: F.teacher, role: 'teacher' }))
await case_('self-declared teacher creates a class', 'forger-teacher', 'deny', () => setDoc(doc(as('forger-teacher'), `classes/forged-${STAMP}`), { id: 'forged', teacherUid: F.teacher }))
await case_('self-declared parent reads a learner profile', 'forger-parent', 'deny', () => getDoc(doc(as('forger-parent'), 'users', L)))
await case_('self-declared parent writes its own parent link', 'forger-parent', 'deny', () => setDoc(doc(as('forger-parent'), `parentLinks/${F.parent}__${L}`), { parentUid: F.parent, childUid: L, createdAt: new Date().toISOString() }))
// Promotion is still closed. Declaring `parent` at signup and later rewriting
// `role` to `teacher` must fail, or a self-declared account could reach every
// rule that reads the role field without going through the create path.
await case_('self-declared parent promotes itself to teacher', 'forger-parent', 'deny', () => updateDoc(doc(as('forger-parent'), 'users', F.parent), { role: 'teacher' }))
// And a declared role cannot backfill the operator-written `teacherUids` mirror
// on its own profile — the field `teachesLearner` reads to grant cross-account
// reads. This is the single field that would turn a self-declared teacher into a
// real one, so it is the one worth pinning.
await case_('self-declared teacher grants itself a learner', 'forger-teacher', 'deny', () => updateDoc(doc(as('forger-teacher'), 'users', F.teacher), { teacherUids: [L] }))
await case_('self-declared teacher writes a stranger profile', 'forger-teacher', 'deny', () => setDoc(doc(as('forger-teacher'), 'users', S), { name: 'hijack' }))

// Roster reads. A learner who is themselves enrolled still cannot enumerate the
// roster: a list query is authorised only if *every* document it could return is
// allowed, and `isSelf(memberUid)` covers the learner's own row alone. That is
// the intended behaviour — nothing in the app shows a learner their classmates.
await case_('teacher LISTS enrolled class roster', 'teacher', 'allow', () => getDocs(collection(as('teacher'), 'classes', CLASS, 'members')))
await case_('stranger LISTS enrolled class roster', 'stranger', 'deny', () => getDocs(collection(as('stranger'), 'classes', CLASS, 'members')))
await case_('learner LISTS enrolled class roster', 'learner', 'deny', () => getDocs(collection(as('learner'), 'classes', CLASS, 'members')))
await case_('learner reads own membership row', 'learner', 'allow', () => read('learner', 'classes', CLASS, 'members', L))
await case_('learner reads a classmate membership row', 'learner', 'deny', () => read('learner', 'classes', CLASS, 'members', S))

// "Which classes is this learner in" would be a collectionGroup query, and it
// is denied for *everyone* — including the learner themselves. This is not a bug
// to be fixed in the rules; it is a property of how Firestore authorises list
// queries, and it is why `readEnrolledClasses` was removed rather than repaired.
// These cases pin the behaviour so a future change to the membership rule is
// noticed rather than assumed harmless.
//
// If a learner ever needs their class list, the fix is a denormalised `classIds`
// array on the profile, not a rule change.
await case_('collectionGroup class lookup is denied even for the learner', 'learner', 'deny', () => getDocs(query(collectionGroup(as('learner'), 'members'), where('uid', '==', L))))
await case_('collectionGroup class lookup is denied for a linked parent', 'parent', 'deny', () => getDocs(query(collectionGroup(as('parent'), 'members'), where('uid', '==', L))))
await case_('collectionGroup class lookup is denied for the class teacher', 'teacher', 'deny', () => getDocs(query(collectionGroup(as('teacher'), 'members'), where('uid', '==', L))))
await case_('collectionGroup class lookup is denied for a stranger', 'stranger', 'deny', () => getDocs(query(collectionGroup(as('stranger'), 'members'), where('uid', '==', L))))

// admin custom claim
await case_('admin reads any profile', 'admin', 'allow', () => read('admin', 'users', S))
await case_('admin writes any profile', 'admin', 'allow', () => setDoc(doc(as('admin'), 'users', S, 'questions', 'admin-q'), { id: 'admin-q' }))

// The whole-collection reads the admin dashboard opens on. These are the one
// thing the new portal cannot work without, and they rest on a rule detail worth
// pinning: Firestore authorises a query before any document is known, with the
// path variables unbound, so a rule like `isSelf(uid)` is false for every
// candidate row and the query is rejected outright. `isAdmin()` references no
// path variable, so it holds for all of them and the query is allowed — which is
// why an operator can list every profile but a learner still cannot list one.
//
// Asserted live rather than reasoned about, because the alternative is the same
// failure `readEnrolledClasses` had: a function that compiles, looks correct, and
// is rejected at runtime the first time anything calls it.
await case_('admin lists every profile', 'admin', 'allow', () => list('admin', 'users'))
await case_('admin lists every class', 'admin', 'allow', () => list('admin', 'classes'))
await case_('admin lists every parent link', 'admin', 'allow', () => list('admin', 'parentLinks'))

// The same three reads must fail for an ordinary account. A dashboard that only
// proves the positive case would pass just as happily if the rules leaked the
// whole population to everyone.
await case_('a learner cannot list every profile', 'learner', 'deny', () => list('learner', 'users'))
await case_('a learner cannot list every class', 'learner', 'deny', () => list('learner', 'classes'))
await case_('a learner cannot list every parent link', 'learner', 'deny', () => list('learner', 'parentLinks'))

// ── Report ─────────────────────────────────────────────────────────────────
//
// Every case is run even after one fails: a partial matrix hides a second
// problem behind the first, which is how a run reports one bug when there are
// three. `case_` records instead of throwing.

const failed = results.filter(r => !r.pass)
for (const r of results) {
  console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.label}${r.pass ? '' : `  (expected ${r.expected}, got ${r.got})`}`)
}
console.log(`\n  ${results.length - failed.length}/${results.length} cases matched the rules\n`)

// ── Cleanup ────────────────────────────────────────────────────────────────

// Collected once and reused for the count. `[L, S, P, T, A, F].length` is 6,
// because `F` is the forger *map*, not its 4 uids — so the old log claimed six
// accounts removed when nine were. Anyone using this line to confirm cleanup
// would have believed debris was left behind.
const cleanupUids = [L, S, P, T, A, ...Object.values(F)]
for (const uid of cleanupUids) {
  await adb.doc(`users/${uid}`).delete().catch(() => {})
  await adb.recursiveDelete(adb.doc(`learners/${uid}`)).catch(() => {})
  await adminAuth.deleteUser(uid).catch(() => {})
}
await adb.doc(`classes/${CLASS}`).delete().catch(() => {})
await adb.doc(`parentLinks/${P}__${L}`).delete().catch(() => {})
for (const c of clients.values()) { await signOut(c.auth); await deleteApp(c.app) }

console.log(`  cleaned up ${cleanupUids.length} accounts and fixtures\n`)
process.exit(failed.length ? 1 : 0)

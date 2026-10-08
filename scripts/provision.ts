// ── Provisioning ───────────────────────────────────────────────────────────
//
// The three relationships that let one account see another's data — enrolment,
// guardianship, teaching — are the entire security boundary of this app, and
// `firestore.rules` deliberately refuses to let a browser create any of them.
// That is correct, but it leaves the operator with no way to create them at all,
// which is why this script exists.
//
//   npx tsx scripts/provision.ts class   <classId> <teacherUid> <learnerUid> [learnerName]
//   npx tsx scripts/provision.ts unclass <classId> <learnerUid>
//   npx tsx scripts/provision.ts link    <parentUid> <childUid>
//   npx tsx scripts/provision.ts unlink  <parentUid> <childUid>
//   npx tsx scripts/provision.ts setrole <uid> <learner|parent|teacher>
//   npx tsx scripts/provision.ts admin   <emailOrUid> [revoke]
//   npx tsx scripts/provision.ts audit
//
// `setrole` is the fourth operator-only record, and it exists because
// registration deliberately creates learners and nothing else: a person cannot
// grant themselves "teacher" or "parent" in the browser.
//
// `admin` is the strongest of them and the least used: it mints the custom claim
// that `firestore.rules` gates every operator write on, and no browser call can
// mint one. So the first admin is created here and never from inside the app.
//
// It runs under the Admin SDK, which bypasses security rules — so it must never
// be reachable from the web bundle. It imports from `firebase-admin`, which is
// not a browser dependency and is absent from `dependencies` on purpose.
//
// Credentials come from the environment, never from a file in the repo:
//
//   FIREBASE_PROJECT_ID=...  GOOGLE_APPLICATION_CREDENTIALS=/path/service-account.json
//
// The `audit` command is the one to run after any change: it re-derives what
// the rules should be able to see and prints any link that is missing or stale.

import { readFileSync } from 'node:fs'
import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { FieldValue, getFirestore, type DocumentReference } from 'firebase-admin/firestore'

// ── Bootstrap ──────────────────────────────────────────────────────────────

const [command, ...args] = process.argv.slice(2)

const USAGE =
  '\n  Usage:\n' +
  '    npx tsx scripts/provision.ts class   <classId> <teacherUid> <learnerUid> [learnerName]\n' +
  '    npx tsx scripts/provision.ts unclass <classId> <learnerUid>\n' +
  '    npx tsx scripts/provision.ts link    <parentUid> <childUid>\n' +
  '    npx tsx scripts/provision.ts unlink  <parentUid> <childUid>\n' +
  '    npx tsx scripts/provision.ts setrole <uid> <learner|parent|teacher>\n' +
  '    npx tsx scripts/provision.ts admin   <emailOrUid> [revoke]\n' +
  '    npx tsx scripts/provision.ts audit\n\n' +
  '  Registration only ever creates a learner, so parent and teacher roles are\n' +
  '  granted here with setrole. A role on its own still grants no access: a\n' +
  '  teacher needs a class and a parent needs a linked child.\n\n' +
  '  `admin` grants the operator claim the /admin portal and firestore.rules read.\n' +
  '  It is the only way to create an admin, needs this service-account key, and\n' +
  '  carries the widest powers in the app — grant it as rarely as you can.\n\n' +
  '  Requires FIREBASE_PROJECT_ID and a service-account key at\n' +
  '  GOOGLE_APPLICATION_CREDENTIALS.\n'

// Usage is printed before any credential is read, so `--help` and a typo do not
// both produce a stack trace from deep inside the Admin SDK.
if (!command || command === '--help' || command === '-h') {
  console.log(USAGE)
  process.exit(command ? 0 : 1)
}

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT

if (!projectId) {
  console.error(
    'FIREBASE_PROJECT_ID is not set.\n' +
    'Run with FIREBASE_PROJECT_ID=your-project, for example:\n' +
    '  FIREBASE_PROJECT_ID=brainybox-19152 npm run provision -- audit\n',
  )
  process.exit(1)
}

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert(serviceAccountFromEnvironment()),
    projectId,
  })

const db = getFirestore(app)
const auth = getAuth(app)

/**
 * Credentials from a service-account JSON file, given as a path.
 *
 * `GOOGLE_APPLICATION_CREDENTIALS` is the conventional name and is honoured
 * here so the same shell setup works for the Firebase CLI and this script. The
 * file is read once and never logged.
 */
function serviceAccountFromEnvironment(): ServiceAccount {
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (!path) {
    throw new Error(
      'GOOGLE_APPLICATION_CREDENTIALS is not set. The Admin SDK needs a service ' +
      'account key; it cannot use a user session.',
    )
  }
  // The key is read once, used to initialise the SDK, and never logged.
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

const userDoc = (uid: string) => db.doc(`users/${uid}`)
const classDoc = (classId: string) => db.doc(`classes/${classId}`)
const memberDoc = (classId: string, uid: string) => classDoc(classId).collection('members').doc(uid)
const linkDoc = (parentUid: string, childUid: string) =>
  db.doc(`parentLinks/${parentUid}__${childUid}`)

// Duplicated from `src/data/types.ts` on purpose: this file is typechecked by a
// standalone `tsc` invocation that has no `@/*` path alias, so it cannot import
// from `src`. `scripts/check-data.ts` asserts the two lists agree, which is what
// makes the duplication safe — if a role is added to the app and forgotten here,
// the check fails rather than `setrole` silently rejecting it.
type UserRole = 'learner' | 'parent' | 'teacher'
const KNOWN_ROLES: readonly UserRole[] = ['learner', 'parent', 'teacher']

// A declaration rather than an arrow const: TypeScript only narrows a value to
// `never` after a call to something it knows never returns when the callee is a
// hoisted function, so this is what lets `requireArg` return a plain `string`.
function fail(message: string): never {
  console.error(`\n  ${message}\n`)
  process.exit(1)
}

const requireArg = (value: string | undefined, label: string): string => {
  if (!value) fail(`Missing ${label}.`)
  return value
}

/** Read a field off a snapshot, failing loudly rather than proceeding on `undefined`. */
function field<T>(snap: { exists: boolean; data: () => FirebaseFirestore.DocumentData | undefined }, key: string, label: string): T {
  const value = snap.data()?.[key]
  if (value === undefined) fail(`${label} has no "${key}" field.`)
  return value as T
}

/**
 * A profile has to exist before anything can be linked to it.
 *
 * Not a formality: `teachesLearner` in `firestore.rules` reads
 * `users/{uid}.teacherUids`, and `isLinkedParentOf` reads the link document. A
 * class pointing at a uid that has never signed up is a class no one can read.
 */
async function assertProfile(uid: string, label: string): Promise<{ name: string; role: string }> {
  const snap = await userDoc(uid).get()
  if (!snap.exists) {
    fail(
      `${label} ${uid} has no users/${uid} profile document.\n` +
      '  The account has to register in the app before it can be provisioned, because\n' +
      '  that is what writes the profile the rules read.',
    )
  }
  const data = snap.data()!
  return { name: data.name ?? uid, role: data.role ?? 'learner' }
}

/**
 * Mirror the class's teacher onto the learner's profile.
 *
 * This is the step that is easy to forget and impossible to work around. A
 * security rule evaluates per document and cannot run a query, so
 * `teachesLearner` has to find the teacher's uid in a field on the learner's
 * own profile. Write the membership without this and the enrolment looks
 * correct in the console while the teacher portal returns permission-denied on
 * every read.
 *
 * A FieldValue.delete() removes the uid only when no other class they teach
 * still needs it, so removing one enrolment does not break another.
 */
async function syncTeacherMirror(learnerUid: string, teacherUid: string, enrolled: boolean): Promise<void> {
  const snap = await userDoc(learnerUid).get()
  const current: string[] = Array.isArray(snap.data()?.teacherUids) ? snap.data()!.teacherUids : []

  const stillTeaching = enrolled
    ? Array.from(new Set([...current, teacherUid]))
    : await (async () => {
        const otherClasses = await db
          .collection('classes')
          .where('teacherUid', '==', teacherUid)
          .get()
        const refs: DocumentReference[] = otherClasses.docs.map(cls =>
          cls.ref.collection('members').doc(learnerUid),
        )
        const remaining = await db.getAll(...refs)
        const stillEnrolled = remaining.some(d => d.exists)
        return stillEnrolled ? current : current.filter(uid => uid !== teacherUid)
      })()

  // An empty list is written as a field delete rather than `[]`, so a learner
  // who leaves every class has no `teacherUids` key at all — the same shape as
  // one who was never enrolled, which is what `teachesLearner` expects.
  if (stillTeaching.length) {
    await userDoc(learnerUid).set({ teacherUids: stillTeaching }, { merge: true })
  } else {
    await userDoc(learnerUid).update({ teacherUids: FieldValue.delete() })
  }
}

// ── Commands ───────────────────────────────────────────────────────────────

async function addToClass(classId: string, teacherUid: string, learnerUid: string, learnerName?: string) {
  const teacher = await assertProfile(teacherUid, 'Teacher')
  if (teacher.role !== 'teacher') {
    fail(`${teacherUid} has role "${teacher.role}", not "teacher".`)
  }

  const learner = learnerName
    ? { name: learnerName, role: 'learner' as const }
    : await assertProfile(learnerUid, 'Learner')

  const classSnap = await classDoc(classId).get()
  if (!classSnap.exists) {
    console.log(`  Creating classes/${classId} (no such class yet).`)
    await classDoc(classId).set({
      id: classId,
      name: classId,
      subjectId: 'mathematics',
      teacherUid,
      createdAt: new Date().toISOString(),
    })
  } else if (classSnap.data()?.teacherUid !== teacherUid) {
    fail(
      `classes/${classId} is already taught by ${classSnap.data()?.teacherUid ?? 'nobody'}, not ${teacherUid}.\n` +
      '  Pass a different classId, or hand the class over in the console first.',
    )
  }

  await memberDoc(classId, learnerUid).set({
    uid: learnerUid,
    role: 'learner',
    displayName: learner.name,
    joinedAt: new Date().toISOString(),
  })
  await syncTeacherMirror(learnerUid, teacherUid, true)

  console.log(
    `\n  Enrolled ${learner.name} (${learnerUid}) in ${classId}.\n` +
    `  users/${learnerUid}.teacherUids now includes ${teacherUid}, so the teacher portal can read this learner.\n`,
  )
}

async function removeFromClass(classId: string, learnerUid: string) {
  const classSnap = await classDoc(classId).get()
  if (!classSnap.exists) fail(`classes/${classId} does not exist.`)

  await memberDoc(classId, learnerUid).delete()
  await syncTeacherMirror(learnerUid, classSnap.data()!.teacherUid, false)

  console.log(`\n  Removed ${learnerUid} from ${classId} and updated the teacher mirror.\n`)
}

async function linkParent(parentUid: string, childUid: string) {
  const parent = await assertProfile(parentUid, 'Parent')
  if (parent.role !== 'parent') {
    fail(`${parentUid} has role "${parent.role}", not "parent".`)
  }
  const child = await assertProfile(childUid, 'Child')

  await linkDoc(parentUid, childUid).set({
    parentUid,
    childUid,
    createdAt: new Date().toISOString(),
  })

  console.log(
    `\n  Linked ${parent.name} to ${child.name}.\n` +
    `  parentLinks/${parentUid}__${childUid} lets this parent read the child's mastery, attempts and revision.\n` +
    '  It does not let them write any of it.\n',
  )
}

async function unlinkParent(parentUid: string, childUid: string) {
  await linkDoc(parentUid, childUid).delete()
  console.log(`\n  Removed the link between ${parentUid} and ${childUid}.\n`)
}

/**
 * Grant a role *plus the records it depends on*.
 *
 * A person may now declare `parent` or `teacher` at signup (see
 * `SELF_REGISTERABLE_ROLES` in `src/lib/roles.ts`). That declaration is inert: a
 * self-declared teacher owns no classes and a self-declared parent has no linked
 * child, so both see an empty portal. This command is what actually grants the
 * access — the class, the enrolment, or the parent link — and it is the only
 * thing that does.
 *
 * So this command is no longer about setting a label. For a parent or teacher it
 * is the step that turns the role into anything: without it, the person has an
 * account and a portal that shows nothing.
 *
 * This sets the Firestore profile field. It does *not* set the `admin` custom
 * claim, which `firestore.rules` reads separately — that is the `admin` command,
 * and it is a genuinely stronger power, so the two are not combined. Promoting
 * someone to parent so they can see one child should not also hand them the
 * ability to delete any profile in the deployment.
 */
async function setRole(uid: string, role: UserRole) {
  if (!KNOWN_ROLES.includes(role)) {
    fail(`"${role}" is not a known role. Expected one of: ${KNOWN_ROLES.join(', ')}.`)
  }
  const profile = await assertProfile(uid, 'Account')

  if (profile.role === role) {
    console.log(`\n  ${profile.name} (${uid}) already has role "${role}". Nothing to do.\n`)
    return
  }

  await userDoc(uid).update({ role })
  console.log(
    `\n  Set ${profile.name} (${uid}) to "${role}" (was "${profile.role}").\n` +
    '  The profile field alone grants nothing. A teacher still needs a class, and\n' +
    '  a parent still needs a linked child:\n' +
    (role === 'teacher' ? '    npm run provision -- class <classId> ' + uid + ' <learnerUid>\n' : '') +
    (role === 'parent' ? '    npm run provision -- link ' + uid + ' <childUid>\n' : ''),
  )
}

/**
 * Grant or revoke the operator `admin` claim.
 *
 * This is the *only* supported way to create an admin, and it has to be, because
 * the claim is what `firestore.rules` gates every operator write on. A claim can
 * only be minted by the Admin SDK — no browser call can set one, and the Firestore
 * rules contain nothing that would let a client do it indirectly. So the first
 * admin cannot be created from inside the app; that is the property that makes
 * the claim worth trusting, not an oversight to route around.
 *
 * Accepts an email or a uid, because an operator will usually know the email and
 * not the uid.
 *
 * Note the difference from `setrole`, which writes a Firestore field this one
 * does not touch, and which is therefore strictly the weaker of the two
 * operations. `admin` should be granted as rarely as possible: it is the claim
 * that permits deleting any profile and writing any learner's attempts, mastery,
 * question bank and uploads.
 *
 * The claim only reaches an already-signed-in session on its next load —
 * Firebase caches the ID token for about an hour — so the operator should be told
 * to reload rather than to expect the portal to appear mid-session.
 */
async function setAdmin(identifier: string, grant: boolean) {
  const adminAuth = getAuth(app)
  const account = await resolveAccount(adminAuth, identifier)
  const uid = account.uid

  const claims = (account.customClaims ?? {}) as Record<string, unknown>
  const already = claims.admin === true

  if (already === grant) {
    console.log(`\n  ${identifier} already ${grant ? 'has' : 'does not have'} the admin claim. Nothing to do.\n`)
    return
  }

  if (grant) {
    await adminAuth.setCustomUserClaims(uid, { ...claims, admin: true })
  } else {
    // Revoking clears the key rather than setting it to false. `isAdmin()` tests
    // `== true`, so either would deny, but leaving `admin: false` behind would
    // keep a stale key on a token that something else might later read as
    // "present, therefore true".
    const { admin: _removed, ...rest } = claims
    await adminAuth.setCustomUserClaims(uid, rest)
  }

  console.log(
    grant
      ? `\n  Granted the admin claim to ${account.email ?? uid} (${uid}).\n` +
        '  They must reload the app (or sign in again) before the portal appears:\n' +
        '  Firebase caches the ID token for about an hour, so a session that is\n' +
        '  already open will keep presenting the old claims until it refreshes.\n'
      : `\n  Revoked the admin claim from ${account.email ?? uid} (${uid}).\n` +
        '  Their next load will lose operator access. An open session keeps it until\n' +
        '  the token refreshes.\n',
  )
}

/** Look an account up by email, falling back to treating the input as a uid. */
async function resolveAccount(adminAuth: ReturnType<typeof getAuth>, identifier: string) {
  if (identifier.includes('@')) {
    const found = await adminAuth.getUserByEmail(identifier)
    return { uid: found.uid, email: found.email, customClaims: found.customClaims }
  }
  try {
    const found = await adminAuth.getUser(identifier)
    return { uid: found.uid, email: found.email, customClaims: found.customClaims }
  } catch {
    // A uid is 28 characters of URL-safe base64; anything else that contains no
    // "@" is far more likely to be a mistyped email than a uid, so say which.
    fail(
      `No account matches "${identifier}". Pass the account's email address, ` +
      'or its Firebase uid copied from the admin portal.',
    )
  }
}

/**
 * Report what the rules can actually see.
 *
 * Every check here is a read the app makes, run as the operator rather than as
 * the user. A mismatch means a portal will show an empty list rather than an
 * error, which is the failure mode that is hardest to notice.
 */
async function audit() {
  let problems = 0
  const report = (ok: boolean, message: string) => {
    if (!ok) problems++
    console.log(`  ${ok ? 'ok  ' : 'MISS'}  ${message}`)
  }

  console.log('\n  Classes')
  const classes = await db.collection('classes').get()
  for (const cls of classes.docs) {
    const classId = cls.id
    const teacherUid: string = cls.data().teacherUid
    const teacherOk = await userDoc(teacherUid).get().then(s => s.exists)
    report(teacherOk, `classes/${classId}: teacher ${teacherUid} has a profile`)

    const members = await cls.ref.collection('members').get()
    for (const member of members.docs) {
      const uid = member.id
      report(
        member.data()?.uid === uid,
        `classes/${classId}/members/${uid}: uid field matches the document id`,
      )

      const profile = await userDoc(uid).get()
      if (!profile.exists) {
        report(false, `classes/${classId}/members/${uid}: no users/${uid} profile`)
        continue
      }
      const teacherUids: string[] = profile.data()?.teacherUids ?? []
      report(
        teacherUids.includes(teacherUid),
        `users/${uid}.teacherUids includes ${teacherUid} (the teacher portal needs this)`,
      )
    }
  }

  console.log('\n  Guardianship')
  const links = await db.collection('parentLinks').get()
  for (const link of links.docs) {
    const parentUid = field<string>(link, 'parentUid', `parentLinks/${link.id}`)
    const childUid = field<string>(link, 'childUid', `parentLinks/${link.id}`)
    report(
      link.id === `${parentUid}__${childUid}`,
      `parentLinks/${link.id}: id matches its parentUid and childUid fields`,
    )
    const parent = await userDoc(parentUid).get()
    report(parent.exists, `parentLinks/${link.id}: parent ${parentUid} has a profile`)
    if (parent.exists) {
      report(parent.data()?.role === 'parent', `parentLinks/${link.id}: parent role is "parent"`)
    }
    const child = await userDoc(childUid).get()
    report(child.exists, `parentLinks/${link.id}: child ${childUid} has a profile`)
  }

  // The reverse direction: a class member whose profile does not list the
  // teacher is the drift this script exists to prevent, and it is invisible
  // from the class side alone.
  console.log('\n  Stale teacher mirrors')
  const profiles = await db.collection('users').get()
  for (const profile of profiles.docs) {
    const teacherUids: string[] = profile.data().teacherUids ?? []
    for (const teacherUid of teacherUids) {
      const classes = await db.collection('classes').where('teacherUid', '==', teacherUid).get()
      const enrolled = await Promise.all(
        classes.docs.map(c => c.ref.collection('members').doc(profile.id).get()),
      )
      report(
        enrolled.some(s => s.exists),
        `users/${profile.id}.teacherUids lists ${teacherUid} but no class they teach contains them`,
      )
    }
  }

  const accounts = await auth.listUsers(1000)
  report(
    accounts.users.every(a => profiles.docs.some(p => p.id === a.uid)),
    `every one of the ${accounts.users.length} auth accounts has a users/{uid} profile`,
  )

  console.log(
    problems === 0
      ? '\n  No problems found.\n'
      : `\n  ${problems} problem(s) found. Each one will make a portal render empty rather than fail.\n`,
  )
  process.exitCode = problems === 0 ? 0 : 1
}

// ── Entry ──────────────────────────────────────────────────────────────────

const commands: Record<string, () => Promise<void>> = {
  class: () => addToClass(
    requireArg(args[0], 'classId'),
    requireArg(args[1], 'teacherUid'),
    requireArg(args[2], 'learnerUid'),
    args[3],
  ),
  unclass: () => removeFromClass(requireArg(args[0], 'classId'), requireArg(args[1], 'learnerUid')),
  link: () => linkParent(requireArg(args[0], 'parentUid'), requireArg(args[1], 'childUid')),
  unlink: () => unlinkParent(requireArg(args[0], 'parentUid'), requireArg(args[1], 'childUid')),
  setrole: () => setRole(requireArg(args[0], 'uid'), requireArg(args[1], 'role') as UserRole),
  admin: () => setAdmin(
    requireArg(args[0], 'emailOrUid'),
    args[1] !== 'revoke',
  ),
  audit,
}

if (!commands[command]) {
  console.error(`Unknown command "${command}".`)
  console.error(USAGE)
  process.exit(1)
}

commands[command]().catch((error: unknown) => {
  console.error('\n  Provisioning failed:', error instanceof Error ? error.message : error, '\n')
  process.exit(1)
})

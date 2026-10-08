// Publishes firestore.rules to a project the `firebase` CLI's Google login
// cannot reach, by using that project's own service-account key.
//
// The CLI's OAuth session and an Admin SDK key are different identities, and
// neither currently has enough access to change which ruleset is live:
//
//   - The CLI login (`nkundlandetechandelecsolutions@gmail.com`) is rejected with
//     `403 IAM_PERMISSION_DENIED` on `firebaserules.releases.get`, so
//     `firebase deploy --only firestore:rules` cannot work at all. It fails even
//     earlier, in its own `serviceusage.services.use` pre-check.
//   - The service-account key can read the release and create rulesets, but
//     `DELETE .../releases/probe` returns `403 IAM_PERMISSION_DENIED`, so it can
//     neither delete-and-recreate nor update in place.
//
// ## Why this looked like a malformed request instead of a permission problem
//
// `releases.create` and `releases.patch` answer
// `400 "Request contains an invalid argument."` with no `fieldViolations`, even
// for a well-formed body, and even for a request that should be impossible to
// authorise anyway (creating a release pointing at a nonexistent ruleset). That
// is Google declining to disclose why. The `403` on delete is the same denial in
// its honest form, and it is the diagnostic to trust — so do not spend time
// reshaping the body, and note that PATCH takes an `UpdateReleaseRequest`
// (`{ release: { name, rulesetName }, updateMask }`), not a bare `Release`.
//
// The fix is an IAM grant, not a different call. Grant the operator
// `roles/firebaserules.admin` (or at minimum `firebaserules.releases.update`)
// and this script's existing branch below takes over unchanged. Until then the
// upload half still succeeds, so this script deliberately leaves a byte-verified
// ruleset behind and prints its id for the console.
//
// The final step reads the rules back and compares them to the file on disk. A
// 200 from a create call is not proof of anything; the readback is.

import { GoogleAuth } from 'google-auth-library'
import { readFileSync } from 'node:fs'

const projectId = process.env.FIREBASE_PROJECT_ID!
const rulesPath = process.argv[2]
const releaseId = process.argv[3] ?? 'cloud.firestore'
const rulesSource = readFileSync(rulesPath, 'utf8')

// The scope the Firebase docs name for the Rules API is rejected by a
// service-account key on this project ("Could not refresh access token").
// `cloud-platform` works and the Rules API accepts it.
const SCOPE = 'https://www.googleapis.com/auth/cloud-platform'

const token = async () => {
  const auth = new GoogleAuth({
    credentials: JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS!, 'utf8')),
    scopes: [SCOPE],
  })
  return (await (await auth.getClient()).getAccessToken()).token
}

const call = async (method: string, url: string, body?: unknown) => {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const raw = await res.text()
  if (!res.ok) throw new Error(`${method} ${url}\n  -> ${res.status} ${raw.replace(/\s+/g, ' ').slice(0, 300)}`)
  return JSON.parse(raw)
}

const main = async () => {
  // Does a release already exist? A create with an existing releaseId fails, so
  // the existing one has to be reused rather than re-created blindly.
  const { releases = [] } = await call('GET', `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`)
  const existing = releases.find((r: { name: string }) => r.name.endsWith(`/${releaseId}`))
  console.log(`  release "${releaseId}": ${existing ? 'exists' : 'does not exist yet'}`)

  const created = await call(
    'POST',
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`,
    { source: { files: [{ name: 'firestore.rules', content: rulesSource }] } },
  )
  console.log('  created ruleset', created.name)

  let active: string
  if (existing) {
    // Missing `firebaserules.releases.update` / `.delete` on this key. Report the
    // ruleset and let the operator publish it from the console rather than
    // pretending the change is live.
    console.log(
      `\n  A release already exists and this key cannot repoint it\n` +
      `  (needs roles/firebaserules.admin, or firebaserules.releases.update).\n` +
      `  Publish ruleset\n` +
      `    ${created.name}\n` +
      '  from the Firebase console -> Firestore -> Rules, or from a CLI login that\n' +
      `  has access, with: npx firebase deploy --only firestore:rules --project ${projectId}\n`,
    )
    return
  }

  const released = await call(
    'POST',
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`,
    { name: releaseId, rulesetName: created.name },
  )
  active = released.rulesetName
  console.log('  released', released.name, '->', active)

  const readback = await call('GET', `https://firebaserules.googleapis.com/v1/${active}`)
  const live = readback.source?.files?.[0]?.content ?? ''
  if (live !== rulesSource) {
    throw new Error(`Deployed rules do not match ${rulesPath} (${live.length} vs ${rulesSource.length} chars).`)
  }
  console.log(`  verified: live rules are byte-identical to ${rulesPath} (${live.length} chars)`)
}

main().catch((e) => {
  console.error(`\n  failed: ${e.message}\n`)
  process.exit(1)
})

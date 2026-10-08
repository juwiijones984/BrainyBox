import {
  createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signOut as fbSignOut, updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, requireAuth, requireDb } from './config'
import type { Profile, UserRole } from '@/data/types'

// ── Profiles ───────────────────────────────────────────────────────────────
// A user's role is a property of their profile document, not of what they
// clicked on a login screen. That matters for authorisation: a learner who
// edits the role in the browser must not be able to reach the teacher portal,
// because `firestore.rules` reads the same field server-side.

export const userProfilePath = (uid: string) => `users/${uid}`

/** Derive a two-letter avatar from a display name, as the profile chip shows. */
export const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || '?'

/**
 * Create the profile document a new account needs. Called immediately after
 * `createUserWithEmailAndPassword`, which is why it takes the uid explicitly —
 * the caller has it before any listener fires.
 *
 * `merge: true` so re-registering with an existing profile never clobbers a
 * role that an admin may have set.
 */
export async function createProfile(
  uid: string,
  email: string,
  name: string,
  role: UserRole,
  grade: number | null,
): Promise<Profile> {
  const profile: Profile = {
    role,
    name: name.trim() || email.split('@')[0] || 'Learner',
    grade,
    avatar: initialsOf(name || email),
    // A streak is earned by consecutive real study days, so it starts at zero
    // and is advanced by `recordAttempt` — never seeded.
    streak: 0,
    lastStudyDate: null,
    subjects: [],
    createdAt: new Date().toISOString(),
  }
  await setDoc(doc(requireDb(), userProfilePath(uid)), profile, { merge: true })
  return profile
}

export async function fetchProfile(uid: string): Promise<Profile | null> {
  const snap = await getDoc(doc(requireDb(), userProfilePath(uid)))
  return snap.exists() ? (snap.data() as Profile) : null
}

export interface SignUpInput {
  email: string
  password: string
  name: string
  role: UserRole
  /** Teachers and parents are not themselves learners, so grade is null. */
  grade: number | null
}

export async function signUp(input: SignUpInput): Promise<{ user: User; profile: Profile }> {
  const { user } = await createUserWithEmailAndPassword(
    requireAuth(),
    input.email.trim(),
    input.password,
  )
  await updateProfile(user, { displayName: input.name.trim() })
  const profile = await createProfile(user.uid, input.email, input.name, input.role, input.grade)
  return { user, profile }
}

export async function signIn(email: string, password: string): Promise<User> {
  const { user } = await signInWithEmailAndPassword(requireAuth(), email.trim(), password)
  return user
}

/**
 * Whether this user holds the operator `admin` claim.
 *
 * The claim is the only thing that grants operator powers, and it lives on the
 * ID token rather than in Firestore on purpose. `firestore.rules` reads
 * `request.auth.token.admin`, and only the Admin SDK can mint a claim — so the
 * privilege is set out-of-band by `npm run provision -- admin <email>` and
 * cannot be granted, edited or widened by anything a browser can reach. A
 * Firestore field would be writable by whoever the rules already trust, which
 * makes "already trusted" recursive.
 *
 * Admin is a capability, not a role: an admin is a learner/parent/teacher who
 * also holds the claim, which is why `UserRole` stays three values wide.
 *
 * `force` refreshes the token. Firebase caches the ID token for about an hour,
 * so without it an operator who has just been granted the claim would see no
 * dashboard until their token happened to expire — the grant would appear
 * broken. One extra round trip per app load is a fair price for that, and this
 * is deliberately not called on every render.
 */
export async function fetchAdminClaim(user: User, force = true): Promise<boolean> {
  const token = await user.getIdTokenResult(force)
  return token.claims.admin === true
}

export async function signOut(): Promise<void> {
  await fbSignOut(requireAuth())
}

export async function sendReset(email: string): Promise<void> {
  await sendPasswordResetEmail(requireAuth(), email.trim())
}

/** Update the display fields the user is allowed to change for themselves. */
export async function updateOwnProfile(
  uid: string,
  patch: Partial<Pick<Profile, 'name' | 'grade' | 'subjects'>>,
): Promise<void> {
  const next: Partial<Profile> = { ...patch }
  if (patch.name !== undefined) next.avatar = initialsOf(patch.name)
  await setDoc(doc(requireDb(), userProfilePath(uid)), next, { merge: true })
}

/**
 * Subscribe to auth state. Returns the unsubscribe function; returns a no-op
 * when Firebase is unconfigured so callers can mount unconditionally.
 */
export function watchAuth(
  onChange: (user: User | null) => void,
  onError: (error: Error) => void,
): () => void {
  if (!auth) return () => {}
  return onAuthStateChanged(
    auth,
    user => onChange(user),
    error => onError(error),
  )
}

/** Milliseconds since epoch as a Firestore-storable value. */
export const now = () => serverTimestamp()

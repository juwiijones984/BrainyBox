import type { UserRole } from '@/data/types'

/**
 * The roles a person may grant themselves when they register.
 *
 * Changed from `['learner']` to all three, on the operator's explicit decision.
 * The reasoning for the narrower list is kept below because it still describes
 * the real cost of this one — it just is not a cost the operator considered
 * disqualifying.
 *
 * ## What self-declaring a role actually gets you
 *
 * Nothing, by itself, and that is the whole safety argument. Every cross-account
 * read in `firestore.rules` is gated on an operator-written relationship —
 * class membership, a `parentLinks` document, or the `teacherUids` mirror:
 *
 *  - A new "teacher" owns no classes (`classes.teacherUid` is admin- or
 *    provision-written), so `isClassTeacher()` is false and every roster read
 *    returns nothing. They also have nobody who lists them as a teacher, so
 *    `teachesLearner()` is false.
 *  - A new "parent" has no `parentLinks` document, so `isLinkedParentOf()` is
 *    false and they see no child.
 *
 * Both land in their portal and find it empty. That is not a bug to be fixed
 * later; it is the design, and it is why widening this list does not widen what
 * any account can read.
 *
 * ## What it does cost
 *
 *  1. `users` fills with accounts labelled parent or teacher that hold neither a
 *     class nor a child. Anything that counts accounts or lists them — including
 *     the admin overview — is then reporting intent rather than reality.
 *  2. It makes the role field load-bearing if it ever stops being inert. Several
 *     rules read `userDoc(uid).data.role` and pair it with a relationship check,
 *     on the reasoning that the relationship carries the weight. Every account
 *     that can set an arbitrary role is extra blast radius for a mistake in one
 *     of those checks.
 *
 * `admin` is *not* in this list and must never be. Admin is a custom claim on the
 * ID token, which only the Admin SDK can mint; a `role` value cannot grant it.
 * Adding `'admin'` here would create accounts that look like operators and have
 * none of the powers — or, if anything ever changed to read the profile field
 * instead, would hand total access to anyone who types four words.
 */
export const SELF_REGISTERABLE_ROLES: readonly UserRole[] = ['learner', 'parent', 'teacher']

export interface RoleOption {
  id: UserRole
  label: string
  desc: string
  icon: string
}

/** Display metadata for every role, including operator-only ones. */
export const ROLE_OPTIONS: readonly RoleOption[] = [
  { id: 'learner', label: 'Learner', desc: 'Study, practise and track your progress', icon: '◉' },
  { id: 'parent', label: 'Parent', desc: "Follow your child's real progress", icon: '◈' },
  { id: 'teacher', label: 'Teacher', desc: 'View class enrolment and skill gaps', icon: '▦' },
]

/** True when `role` may be chosen by the person registering. */
export function isSelfRegisterable(role: UserRole): boolean {
  return SELF_REGISTERABLE_ROLES.includes(role)
}

// ── Shared vocabulary ──────────────────────────────────────────────────────
// ── Mastery bands ───────────────────────────────────────────────────────────
// The study guide's Marks Map uses four bands:
//   80–100 GREEN  Mastered     → spaced revision and challenge questions
//   60–79  YELLOW Developing  → target failed skills
//   40–59  ORANGE Weak        → return to worked examples and drills
//   0–39   RED    Major gap   → re-teach prerequisite skill before retest
// These are a study convention, not the official NCS scale — see
// `mathematicsCaps.ts`, which records the official six and how the two relate.
export type MasteryLevel = 'mastered' | 'developing' | 'weak' | 'major-gap'
export type Role = UserRole
export type Difficulty = 'easy' | 'medium' | 'hard'
export type TrendDir = 'improving' | 'stable' | 'declining'

/** How a learner is graded on a given question. */
export type QuestionType = 'mcq' | 'true-false' | 'short'

/** What a piece of content is for — drives the runner's timer and scoring rules. */
export type AssessmentKind = 'diagnostic' | 'practice' | 'quiz' | 'test' | 'exam'

/** What an uploaded file is. */
export type ResourceKind = 'notes' | 'past-paper' | 'worksheet' | 'image'

/** Identifiers for the CAPS FET subjects the app ships with. */
export type SubjectId =
  | 'mathematics'
  | 'mathematical-literacy'
  | 'physical-sciences'
  | 'life-sciences'
  | 'social-sciences'
  | 'economic-sciences'

/**
 * The official CAPS subjects behind an app subject. An app subject is a study
 * grouping, not a CAPS subject: "Social Sciences" carries both Geography and
 * History, and "Economic Sciences" carries Accounting, Business Studies and
 * Economics, each of which has its own Programme of Assessment. Anything that
 * claims CAPS alignment has to be stated per CAPS subject, never per grouping.
 */
export type CapsSubjectId =
  | 'mathematics'
  | 'mathematical-literacy'
  | 'physical-sciences'
  | 'life-sciences'
  | 'geography'
  | 'history'
  | 'accounting'
  | 'business-studies'
  | 'economics'

/**
 * Whether a CAPS subject is governed by the 2020 amendments booklet.
 *
 * The booklet is explicit that "Engineering Graphics and Design, Mathematics
 * and Technical Mathematics are not included in this booklet, as there are no
 * changes effected to the existing number of tasks in the CAPS of the
 * identified subjects." A `not-amended` subject therefore has no POA recorded
 * here on purpose — its requirements live in the full subject CAPS, and
 * inventing a table for it would be worse than having none.
 */
export type CapsStatus = 'amended' | 'not-amended'

// ── Curriculum structure ───────────────────────────────────────────────────
export interface Subject {
  id: SubjectId
  /** Full name as printed on the CAPS timetable. */
  name: string
  /** Used in tight spaces like the subject switcher chip. */
  shortName: string
  /** DBE subject code, e.g. MATH / PHSC. */
  code: string
  /** Hex accent used for chips, headers and progress bars. */
  color: string
  /** The companion subject required in the FET subject combination. */
  pairing?: string
  /**
   * The official CAPS subjects this grouping stands for. Alignment claims,
   * assessment weightings and moderation rules are all stated per CAPS
   * subject, so a grouping that spans several of them has several policies.
   */
  capsComponents: CapsSubjectId[]
  /** Unicode glyph — the app ships no icon font, so these stand in. */
  glyph: string
}

export interface Topic {
  id: string
  subjectId: SubjectId
  name: string
  /** CAPS term the topic is typically assessed in (1–4). */
  term: number
}

// ── Skills and mastery ──────────────────────────────────────────────────────
// A skill is *curriculum*: an identity from the study guide and CAPS, identical
// for every learner. It is shipped in the app and is never per-user.
//
// Mastery is *evidence*: what one learner has actually demonstrated, stored in
// Firestore at `learners/{uid}/mastery/{skillId}`. A learner who has never been
// assessed has no mastery document at all, which is a different state from a
// score of zero — hence the nulls rather than zeros.
export interface Skill {
  id: string
  subjectId: SubjectId
  topicId: string
  /** Denormalised topic name — saves a lookup on every render. */
  topic: string
  name: string
}

/**
 * One learner's evidence for one skill, as stored in Firestore. The document id
 * is the skill id, so a skill is assessed at most once per learner.
 */
export interface MasteryRecord {
  skillId: string
  /**
   * The learner's first real assessment — the diagnostic. `null` until it
   * happens, and never replaced afterwards, so "improvement since baseline"
   * always compares against something real.
   */
baseline: number | null
   /** Blended mastery, or `null` before the first attempt. */
   current: number | null
   /** Number of *sittings* that have touched this skill. */
   attempts: number
   /** Questions answered correctly across every sitting. */
   correct: number
   /**
    * Questions *asked* across every sitting.
    *
    * Carried alongside `correct` because the two are counted over different
    * units: `attempts` counts papers, so `correct / attempts` divides questions
    * by sittings and happily reports 200%. Accuracy needs the denominator to be
    * questions asked.
    */
   answered: number
   trend: TrendDir
   lastPracticedAt: string | null
   updatedAt: string
}

/**
 * The view model pages render: the static skill joined to this learner's
 * evidence. Mastery fields stay nullable here too, so a component cannot read
 * `current` as a number without first deciding what an unassessed skill means.
 */
export interface SkillProgress extends Skill {
  baseline: number | null
  current: number | null
  attempts: number
  correct: number
  /** Questions asked, for `correct / answered`. See `MasteryRecord.answered`. */
  answered: number
  trend: TrendDir
  lastPracticedAt: string | null
}

/**
 * Accuracy as a percentage, or `null` when nothing has been asked.
 *
 * A function rather than inline arithmetic because the mistake it prevents was
 * made in four places at once: `attempts` counts sittings, so dividing questions
 * answered by it produced figures above 100.
 */
export const accuracyOf = (skill: Pick<SkillProgress, 'correct' | 'answered'>): number | null =>
  skill.answered > 0 ? Math.round((skill.correct / skill.answered) * 100) : null

// ── Lessons ────────────────────────────────────────────────────────────────
// ── Programme of Assessment (CAPS) ─────────────────────────────────────────
/**
 * A prescribed percentage split within a paper, a year or a subject. CAPS
 * writes some of these as "60% ± 5", so the tolerance is carried explicitly
 * rather than being baked into the target.
 */
export interface CapsWeighting {
  label: string
  /** Target percentage. */
  pct: number
  /** Allowed deviation in percentage points, where CAPS states one. */
  tolerance?: number
}

/** One examination paper inside a formal CAPS task. */
export interface CapsPaper {
  /** e.g. "Paper 1", "P1", "September Examination". */
  label: string
  title: string
  rawMarks: number
  /**
   * Calendar minutes allowed. CAPS states durations in hours; this stores the
   * same duration in minutes so the quiz runner can enforce it directly.
   * `null` where the booklet does not prescribe a duration — we do not guess.
   */
  durationMin: number | null
  /** Topic allocation, where the booklet prescribes one. */
  topics?: CapsWeighting[]
  /** Cognitive-level or difficulty allocation the paper must hit. */
  cognitive: CapsWeighting[]
  /** Internal shape, e.g. "Section A 50 marks, Section B 2 × 50 marks". */
  structure?: string
}

/**
 * One formal assessment task in the year's programme — a controlled test, an
 * experiment, an assignment, a project, a mid-year or an end-of-year exam.
 * Informal work (practical activities that are not formally assessed) is
 * described in the subject's notes rather than listed as a weighted task,
 * because it carries no marks and no moderation.
 */
export interface CapsTask {
  id: string
  name: string
  /** CAPS task category, e.g. "controlled test", "experiment", "assignment". */
  type: string
  /** Term the task is written in, 1–4. */
  term: 1 | 2 | 3 | 4
  papers: CapsPaper[]
  /**
   * Weighting as a percentage of the School-Based Assessment. CAPS tables give
   * this per task and the values sum to 100 across the subject's SBA tasks.
   */
  sbaWeightPct: number
  /**
   * Percentage of the term's mark, where the booklet allocates it that way.
   * These are the shares exactly as printed and need not total 100 across a
   * term — Geography's Term 2 is given as 25% essay + 25% mapwork + 75%
   * mid-year — so they are never renormalised.
   */
  termWeightPct?: number
  /** Percentage of the year mark, where the booklet allocates it that way. */
  yearMarkPct?: number
  notes?: string
}

/** The full prescribed assessment structure for one CAPS subject in one grade. */
export interface CapsSubjectPolicy {
  id: CapsSubjectId
  name: string
  /** Section of the abridged booklet this was transcribed from. */
  section: string
  grade: 10 | 11
  status: CapsStatus
  /** Across the programme, SBA against final examination. */
  sbaWeightPct: number
  finalWeightPct: number
  /**
   * Raw marks that make up the promotion mark — the weighted year mark plus
   * the final examination's raw marks. Every amended subject totals 400.
   */
  promotionMark: number
  tasks: CapsTask[]
  /**
   * Present only where the booklet's own task weightings do not reach 100%.
   * It records the shortfall and why, so the gap stays visible instead of
   * being quietly closed with an invented percentage.
   */
  sbaWeightNote?: string
  /** Overall degrees of difficulty, where the booklet prescribes a split. */
  difficulty?: CapsWeighting[]
  notes?: string
}

/**
 * Whether a quiz contributes to the learner's School-Based Assessment.
 *
 * `formative` is the default for the whole app. `official-task` is reserved for
 * a quiz built to a prescribed CAPS task, and is gated by `scripts/check-data.ts`
 * so that a mislabelled quiz fails the build rather than quietly inflating a
 * learner's SBA.
 */
export type CapsStatusOfAssessment = 'formative' | 'official-task'

// ── Lessons ────────────────────────────────────────────────────────────────
/**
 * A concept section inside a lesson. Tagging each section to a skill is what
 * lets a weak skill deep-link straight to the explanation that teaches it,
 * rather than making the learner read the whole module.
 */
export interface Concept {
  id: string
  skillId: string
  title: string
  /** Plain-language explanation shown above the worked examples. */
  body: string
}

/** A single worked calculation, shown line by line. */
export interface WorkedExample {
  id: string
  skillId: string
  title: string
  /** The problem posed to the learner. */
  prompt: string
  /** One step per line, in the order it should be written. */
  steps: string[]
  /** Why the method works, and what to check before moving on. */
  rationale: string
}

/** The teaching half of a topic: vocabulary, concepts and worked examples. */
export interface Lesson {
  /** Matches the topic id — a lesson teaches exactly one module. */
  topicId: string
  subjectId: SubjectId
  /** The guide numbers its modules 1–11; this preserves that numbering. */
  moduleNumber: number
  title: string
  /** CAPS term placement, e.g. "Terms 1–2" for Trigonometry. */
  termLabel: string
  /** Key vocabulary from the guide's "Before You Start" panel. */
  vocabulary: string[]
  concepts: Concept[]
  workedExamples: WorkedExample[]
  /** The guide's standing "Working Space Checklist". */
  checklist: string[]
}

// ── Assessment content ─────────────────────────────────────────────────────
export interface Question {
  id: string
  subjectId: SubjectId
  topicId: string
  skillId: string
  type: QuestionType
  difficulty: Difficulty
  text: string
  /** Empty for `short` questions. Always exactly two for `true-false`. */
  options: string[]
  /** Option index. Ignored when `type` is `short`. */
  correct: number
  /** Accepted answers for `short` questions, lowercased and trimmed. */
  accepted: string[]
  explanation: string
  marks: number
  /** Past paper / textbook / uploaded bank this came from. */
  source?: string
  year?: number
  /** The guide's module number (1–11). Set for study-guide content only. */
  moduleNumber?: number
  /**
   * Whether this question belongs to its module's diagnostic. The guide picks
   * 10 of each module's 15 questions for the diagnostic; the remaining 5 stay
   * in the practice pool so a mini-test can use non-identical questions.
   */
  diagnostic?: boolean
}

export interface Quiz {
  id: string
  title: string
  description: string
  subjectId: SubjectId
  topicIds: string[]
  skillIds: string[]
  questionIds: string[]
  kind: AssessmentKind
  /** Minutes, or `null` for untimed practice. */
  timeLimitMin: number | null
  /**
   * Whether this quiz counts towards the learner's CAPS School-Based
   * Assessment. Almost everything in the app is `formative`: practice is the
   * point of the product, and none of it is moderated or reported to DBE.
   * Only a quiz built to a prescribed task — with the prescribed papers, marks,
   * duration and cognitive mix — may ever be marked `official-task`.
   */
  capsStatus: CapsStatusOfAssessment
  /**
   * The prescribed task in the Programme of Assessment this quiz is built to,
   * when `capsStatus` is `official-task`. Absent for formative work.
   */
  capsTaskId?: string
  /** `seed` ships with the app; the rest were created by a user. */
  source: 'seed' | 'builder' | 'import'
  createdAt: string
}

// ── Uploaded files ─────────────────────────────────────────────────────────
export interface Resource {
  id: string
  title: string
  subjectId: SubjectId
  topicId: string
  kind: ResourceKind
  fileName: string
  mimeType: string
  /** Bytes. */
  size: number
  /**
   * The `resourceId` half of the Cloud Storage path
   * `users/{uid}/resources/{blobKey}`. The bytes live in Storage, not
   * localStorage or IndexedDB, so they follow the account across devices and
   * are readable by a linked parent or a class teacher.
   */
  blobKey: string
  /**
   * Whose bytes these are. Recorded on the descriptor because the viewer has to
   * ask Storage for a download URL against the *owner's* path, and a teacher
   * opening a learner's upload has no other way to know which account to ask
   * about.
   */
  ownerUid?: string
  /** False when the descriptor exists but the object did not finish uploading. */
  uploaded?: boolean
  createdAt: string
  note?: string
}

// ── Learner state ──────────────────────────────────────────────────────────
export interface Attempt {
  id: string
  /** The quiz that was taken, or a synthetic id for ad-hoc skill practice. */
  quizId: string
  quizTitle: string
  subjectId: SubjectId
  kind: AssessmentKind
  date: string
  correct: number
  total: number
  durationMin: number
  /** The questions asked, in the order they were asked. */
  questionIds: string[]
  /** Per-question outcome, index-aligned with `questionIds`. */
  results: boolean[]
  /** Seconds left on the clock when submitted, `null` if untimed. */
  timeLeftSec: number | null
}

// ── Identity ───────────────────────────────────────────────────────────────
/** Where a signed-in account is allowed to go. The single source of truth. */
export type UserRole = 'learner' | 'parent' | 'teacher'

/**
 * `users/{uid}` in Firestore. Read by `firestore.rules` to authorise every
 * other document, so `role` is the one field a client may never set for itself.
 */
export interface Profile {
  role: UserRole
  name: string
  /** `null` for teachers and parents, who are not themselves learners. */
  grade: number | null
  avatar: string
  /** Consecutive real study days. Advanced by `recordAttempt`, starts at 0. */
  streak: number
  /** `YYYY-MM-DD`, used to tell whether the streak continues or breaks. */
  lastStudyDate: string | null
  /** Enrolment. Empty until the learner picks subjects, so it is never assumed. */
  subjects: SubjectId[]
  createdAt: string
  /**
   * Teachers with read access to this learner, denormalised onto the profile.
   *
   * This exists only for `firestore.rules`, which evaluates per document and so
   * cannot ask "is this learner in any class I teach?" — that would be a query.
   * The trade-off is that the profile and `classes/{id}/members` can drift
   * apart, so the provisioning script must write both together. It is never
   * writable by the account it describes: the self-update allowlist in
   * `firestore.rules` omits it, which is what stops a learner from appointing
   * themselves a teacher.
   */
  teacherUids?: string[]
}

/**
 * A learner as seen from a class or a parent's view. Assembled from real
 * enrolment and real mastery, never from a fixed list of names: a learner with
 * no mastery record simply does not appear in a ranking.
 */
export interface ClassLearner {
  uid: string
  name: string
  avatar: string
  subjectId: SubjectId
  /** Mean mastery across assessed skills, or `null` if none are assessed. */
  overallScore: number | null
  trend: TrendDir
  lastActive: string | null
  /** Weakest assessed topic, or `null` when nothing is assessed yet. */
  weakTopic: string | null
  /** Real completed-attempt count. */
  sessions: number
}

export interface RevisionItem {
  id: string
  /** Both are generated from the learner's real mastery when the plan is built. */
  day: string
  date: string
  subjectId: SubjectId
  topic: string
  skillId: string
  type: 'practice' | 'lesson' | 'mini-test' | 'revision'
  durationMin: number
  complete: boolean
}

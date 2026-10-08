// ── Grade 10 Mathematics: the full National Curriculum Statement ────────────
//
// Transcribed from:
//   National Curriculum Statement Grades 10–12 (General) Mathematics
//   Department of Education, © 2003, ISBN 1-919975-28-4
//
// This is a *different* authority from `caps.ts`, and the two are kept apart
// on purpose:
//
//  • `caps.ts` holds the 2020 DBE *amendments*, which give Programmes of
//    Assessment. They deliberately exclude Mathematics.
//  • This file holds the full NCS *Subject Statement* for Mathematics, which
//    gives the Learning Outcomes, the Grade 10 Assessment Standards, the
//    official six-point achievement scale, and the definitions of the
//    assessment types.
//
// The Subject Statement does **not** print a Programme of Assessment — no term
// schedule, no paper count, no durations, no SBA weighting. Those live in the
// separate Mathematics Learning Programme Guidelines and assessment guidelines.
// So `MATHEMATICS_NOT_AMENDED` in `caps.ts` stays `status: 'not-amended'` with
// an empty task list, and nothing here fills that gap by inference.
//
// The most consequential thing in this file is `NCS_ACHIEVEMENT_SCALE`. The
// study guide's Marks Map uses four bands, and this module records exactly how
// those four bands relate to the official six so neither is ever presented as
// the other.

// ── Source ─────────────────────────────────────────────────────────────────
export const MATHEMATICS_NCS = {
  title: 'National Curriculum Statement Grades 10–12 (General) Mathematics',
  publisher: 'Department of Education',
  year: 2003,
  isbn: '1-919975-28-4',
  grade: 10 as const,
  /**
   * What this document is and is not. Kept next to the data so a reader cannot
   * take the curriculum standards below as a Programme of Assessment.
   */
  standing:
    'This Subject Statement sets the four Learning Outcomes, the Assessment ' +
    'Standards, the achievement scale and the assessment types. It does not ' +
    'set a Programme of Assessment: task schedule, paper structure, durations ' +
    'and SBA weighting come from the Mathematics Learning Programme Guidelines.',
} as const

// ── The official six-point achievement scale ────────────────────────────────
//
// NCS Table 4.1, Grade 10 Mathematics. This is the scale a learner's result is
// *rated* on. It is deliberately not the same as `MasteryLevel` in `types.ts`,
// which is the study guide's four-band Marks Map convention:
//
//   guide  weak 40–59  = NCS 4 Satisfactory 50–59  +  3 Adequate 40–49
//   guide  major-gap 0–39 = NCS 2 Partial 30–39  +  1 Inadequate 0–29
//
// A 55% is "Weak" on the Marks Map and "Satisfactory (4)" on the NCS scale.
// Both are correct; they answer different questions. See `GUIDE_BAND_BREAKDOWN`.

export type NcsAchievementLevel = 1 | 2 | 3 | 4 | 5 | 6

export interface NcsRatingBand {
  level: NcsAchievementLevel
  label: string
  minPct: number
  maxPct: number
  /** App colour ramp, green through red, reusing the palette in `index.ts`. */
  color: string
  /** Condensed from the document's Grade 10 competence descriptions. */
  competence: string
}

export const NCS_ACHIEVEMENT_SCALE: NcsRatingBand[] = [
  {
    level: 6,
    label: 'Outstanding',
    minPct: 80,
    maxPct: 100,
    color: '#047857',
    competence:
      'Can solve all problems in a way that shows insight and understanding. ' +
      'Uses knowledge and understanding from other subjects. Shows a high degree ' +
      'of independence and initiative. Sets and adjusts own goals. Takes full ' +
      'responsibility for own learning.',
  },
  {
    level: 5,
    label: 'Meritorious',
    minPct: 60,
    maxPct: 79,
    color: '#22c55e',
    competence:
      'Can solve all problems. Uses reasoning and logic. Has a good grasp of ' +
      'required subject knowledge. Shows insight in solving problems through ' +
      'independent work. Sets own goals and adjusts them with limited help.',
  },
  {
    level: 4,
    label: 'Satisfactory',
    minPct: 50,
    maxPct: 59,
    color: '#eab308',
    competence:
      'Can solve most problems. Can use reasoning and logic in unfamiliar ' +
      'contexts. Has adequate subject knowledge. Understands and uses ' +
      'mathematical language. Sets own goals with some guidance.',
  },
  {
    level: 3,
    label: 'Adequate',
    minPct: 40,
    maxPct: 49,
    color: '#f97316',
    competence:
      'Can solve routine problems. Uses reasoning in familiar contexts. Has ' +
      'some subject knowledge. Can make use of familiar information sources. ' +
      'Needs help to set and adjust own goals.',
  },
  {
    level: 2,
    label: 'Partial',
    minPct: 30,
    maxPct: 39,
    color: '#ef4444',
    competence:
      'Can solve some routine problems. Shows limited reasoning in familiar ' +
      'contexts. Has limited subject knowledge. Needs help to understand and ' +
      'use mathematical language. Cannot set own goals.',
  },
  {
    level: 1,
    label: 'Inadequate',
    minPct: 0,
    maxPct: 29,
    color: '#b91c1c',
    competence:
      'Cannot solve routine problems. Does not show evidence of reasoning. ' +
      'Has very limited subject knowledge. Cannot apply knowledge in familiar ' +
      'contexts. Cannot make use of information sources.',
  },
]

/** Highest band first, so a lookup walks the scale in one pass. */
const SCALE_DESCENDING = [...NCS_ACHIEVEMENT_SCALE].sort((a, b) => b.minPct - a.minPct)

/**
 * The learner's official NCS rating for a percentage. Scores are clamped to
 * 0–100 because the guide's Marks Map and the runner can both produce values
 * just outside the range through rounding.
 */
export const ncsRating = (score: number): NcsRatingBand => {
  const pct = Math.min(100, Math.max(0, score))
  return SCALE_DESCENDING.find(b => pct >= b.minPct) ?? NCS_ACHIEVEMENT_SCALE[0]
}

/** The official level number, 1–6, for a percentage. */
export const ncsLevel = (score: number): NcsAchievementLevel => ncsRating(score).level

/**
 * How the study guide's four Marks Map bands decompose into the official six.
 * Recorded so a report can state the difference rather than hide it: a band is
 * never labelled as though it were an NCS level.
 */
export const GUIDE_BAND_BREAKDOWN: Record<string, NcsAchievementLevel[]> = {
  mastered: [6],
  developing: [5],
  weak: [4, 3],
  'major-gap': [2, 1],
}

/** The guide band covering the official band, for "Weak = Satisfactory or Adequate". */
export const guideBandForNcsLevel = (level: NcsAchievementLevel): string => {
  const band = Object.entries(GUIDE_BAND_BREAKDOWN).find(([, levels]) => levels.includes(level))
  return band ? band[0] : 'major-gap'
}

// ── Learning Outcomes ───────────────────────────────────────────────────────
export interface NcsLearningOutcome {
  /** 1–4, as printed in the document. */
  number: NcsLearningOutcomeNumber
  title: string
  /** The Grade 10 Assessment Standard ids belonging to this outcome. */
  standards: string[]
}

export type NcsLearningOutcomeNumber = 1 | 2 | 3 | 4

export const MATHEMATICS_LEARNING_OUTCOMES: NcsLearningOutcome[] = [
  {
    number: 1,
    title: 'Number and Number Relationships',
    standards: ['10.1.1', '10.1.2', '10.1.3', '10.1.4', '10.1.5', '10.1.6'],
  },
  {
    number: 2,
    title: 'Functions and Algebra',
    standards: [
      '10.2.1', '10.2.2', '10.2.3', '10.2.4', '10.2.5', '10.2.6', '10.2.7',
    ],
  },
  {
    number: 3,
    title: 'Space, Shape and Measurement',
    standards: [
      '10.3.1', '10.3.2', '10.3.3', '10.3.4', '10.3.5', '10.3.6', '10.3.7',
    ],
  },
  {
    // Note the absence of 10.4.4. The document runs 10.4.1, 10.4.2, 10.4.3,
    // 10.4.5 — there is no 10.4.4 at Grade 10. That is a property of the
    // source, not a transcription slip, and `check-data.ts` asserts it.
    number: 4,
    title: 'Data Handling and Probability',
    standards: ['10.4.1', '10.4.2', '10.4.3', '10.4.5'],
  },
]

// ── Grade 10 Assessment Standards ───────────────────────────────────────────
export type NcsStandardId = string

export interface NcsAssessmentStandard {
  id: NcsStandardId
  outcome: NcsLearningOutcomeNumber
  /**
   * Topic-level summary, not a verbatim transcription. Verbatim standard text
   * is required before a standard may be used to certify an official paper, so
   * anything built on these records curriculum alignment only.
   */
  summary: string
  /** `true` where the summary is a close paraphrase and the standard's scope is settled. */
  verbatimPending: boolean
}

/**
 * The 24 Grade 10 Assessment Standards: 6 + 7 + 7 + 4.
 *
 * The summaries below are deliberately topic-level. Standards whose full scope
 * is not settled by the pasted text carry `verbatimPending: true` rather than a
 * fabricated range, and `check-data.ts` requires that flag to be cleared before
 * `MATHEMATICS_OFFICIAL_TASK_CERTIFIABLE` can ever be true.
 */
export const GRADE10_ASSESSMENT_STANDARDS: NcsAssessmentStandard[] = [
  // LO1 — Number and Number Relationships
  { id: '10.1.1', outcome: 1, verbatimPending: false,
    summary: 'Rational and irrational numbers; decimals, fractions and surd forms; all four operations on these forms.' },
  { id: '10.1.2', outcome: 1, verbatimPending: false,
    summary: 'Laws of exponents and surd calculations; ratio and percentage rate relationships, including simple interest.' },
  { id: '10.1.3', outcome: 1, verbatimPending: false,
    summary: 'Investigate number patterns; formulate conjectures and generalisations; justify and prove; a constant difference between consecutive terms gives a linear general term.' },
  { id: '10.1.4', outcome: 1, verbatimPending: false,
    summary: 'Financial mathematics: compound growth A = P(1 + i)ⁿ and simple growth A = P(1 + ni).' },
  { id: '10.1.5', outcome: 1, verbatimPending: false,
    summary: 'Foreign exchange calculations; compare money in different currencies.' },
  { id: '10.1.6', outcome: 1, verbatimPending: true,
    summary: 'Integrative application across the Number and Number Relationships context.' },

  // LO2 — Functions and Algebra
  { id: '10.2.1', outcome: 2, verbatimPending: false,
    summary: 'Language of functions: x → y, input, domain, codomain and range; equations of value.' },
  { id: '10.2.2', outcome: 2, verbatimPending: false,
    summary: 'Sketch graphs of the translated function forms; interpret the effect of the parameters a and q.' },
  { id: '10.2.3', outcome: 2, verbatimPending: false,
    summary: 'Characteristics of those functions: domain, range, intercepts, symmetry, nature of roots, extremes, period.' },
  { id: '10.2.4', outcome: 2, verbatimPending: false,
    summary: 'Manipulate algebraic expressions: binomial × trinomial; factorise a trinomial; grouping in pairs; algebraic fractions with monomial denominators.' },
  { id: '10.2.5', outcome: 2, verbatimPending: false,
    summary: 'Solve linear, quadratic and exponential equations; solve linear inequalities and interpret solutions graphically; solve simultaneous linear equations in two variables.' },
  { id: '10.2.6', outcome: 2, verbatimPending: true,
    summary: 'Integrative application across the Functions and Algebra context.' },
  { id: '10.2.7', outcome: 2, verbatimPending: false,
    summary: 'Average rate of change; determine and use it from first principles for the function forms above.' },

  // LO3 — Space, Shape and Measurement
  { id: '10.3.1', outcome: 3, verbatimPending: false,
    summary: 'Scaling: effect of scaling a right prism or cylinder on surface area and volume by a scale factor k.' },
  { id: '10.3.2', outcome: 3, verbatimPending: false,
    summary: 'Polygons: properties and angle sums; investigate patterns; prove; identify errors; define and apply, including converses.' },
  { id: '10.3.3', outcome: 3, verbatimPending: false,
    summary: 'Analytical geometry: distance between two points; gradient; the form y = mx + c; midpoint of a segment.' },
  { id: '10.3.4', outcome: 3, verbatimPending: false,
    summary: 'Transformations: translation, reflection in the x-axis, y-axis and y = x; describe the effect on coordinates.' },
  { id: '10.3.5', outcome: 3, verbatimPending: false,
    summary: 'Similarity of triangles is fundamental to sin, cos and tan; define and use the functions. Grade 10 defines and uses the functions — it does not yet require memorised special-angle values.' },
  { id: '10.3.6', outcome: 3, verbatimPending: false,
    summary: 'Solve two-dimensional trigonometry problems, including via scale drawings and similarity.' },
  { id: '10.3.7', outcome: 3, verbatimPending: false,
    summary: 'Project on the development of geometry and/or trigonometry, using independent research.' },

  // LO4 — Data Handling and Probability
  { id: '10.4.1', outcome: 4, verbatimPending: false,
    summary: 'Central tendency and dispersion, including quartiles, IQR and SIQR; represent data in tables, charts, histograms, ogives and frequency polygons; recognise misleading representations; errors in measurement.' },
  { id: '10.4.2', outcome: 4, verbatimPending: false,
    summary: 'Probability models; relative frequency as an expression of probability; Venn diagrams; P(S) = 1; the addition rule; disjoint events and complementary events.' },
  { id: '10.4.3', outcome: 4, verbatimPending: false,
    summary: 'Distinguish probability models from reality; identify bias, error and misuse in data; relate random sampling to a population.' },
  { id: '10.4.5', outcome: 4, verbatimPending: true,
    summary: 'Integrative project: design and carry out an investigation, collect, organise, analyse and interpret data, and report on it.' },
]

export const GRADE10_STANDARD_IDS = GRADE10_ASSESSMENT_STANDARDS.map(s => s.id)

/** Standards still needing a verbatim transcription before official use. */
export const PENDING_VERBATIM_STANDARDS = GRADE10_ASSESSMENT_STANDARDS
  .filter(s => s.verbatimPending)
  .map(s => s.id)

/**
 * Is a Programme of Assessment recorded for Mathematics?
 *
 * `caps.ts` carries one `CapsSubjectPolicy` per CAPS subject and grade, and
 * Mathematics is not among them — the NCS material here stands on its own. The
 * flag was documented as one of two required conditions for certification but only
 * ever tested the other, so it would have flipped to `true` the moment the last
 * standard was transcribed, while no Programme of Assessment existed to certify
 * against.
 */
export const HAS_MATHEMATICS_POA = false

/**
 * Whether Mathematics content may be certified as an official NCS task.
 *
 * It cannot, yet, and this is the single flag the UI and the checks read. Two
 * independent conditions must hold: every standard is transcribed verbatim, and
 * a Programme of Assessment exists. Neither does — hence the explicit conjunction
 * rather than the verbatim condition alone. The curriculum alignment below is real
 * and usable; the official-assessment claim is not.
 */
export const MATHEMATICS_OFFICIAL_TASK_CERTIFIABLE =
  PENDING_VERBATIM_STANDARDS.length === 0 && HAS_MATHEMATICS_POA

// ── Assessment types, in the document's own vocabulary ──────────────────────
//
// The document defines four kinds of assessment. The app's `AssessmentKind` is
// not the same list, so the mapping is recorded explicitly rather than inferred
// from a similar-sounding name.

export type NcsAssessmentTypeId = 'baseline' | 'diagnostic' | 'formative' | 'summative'

export interface NcsAssessmentType {
  id: NcsAssessmentTypeId
  title: string
  /** Condensed from the document's definition. */
  definition: string
  /**
   * How the app's `AssessmentKind` relates, if at all. `null` where the app
   * has no equivalent and the distinction would be lost by forcing one.
   */
  appAssessmentKind: 'diagnostic' | 'practice' | 'quiz' | 'test' | 'exam' | null
  note: string
}

export const NCS_ASSESSMENT_TYPES: NcsAssessmentType[] = [
  {
    id: 'baseline',
    title: 'Baseline assessment',
    definition:
      'Establishes what learners already know and can do at the start of a grade, ' +
      'informing Learning Programme development. Recording is usually informal.',
    appAssessmentKind: 'diagnostic',
    note:
      'The app maps baseline onto its diagnostic kind. This is a close fit, not an ' +
      'identity: the app has no distinct informal-recording mode.',
  },
  {
    id: 'diagnostic',
    title: 'Diagnostic assessment',
    definition:
      'Used to discover the cause or causes of a learning barrier, so that ' +
      'remediation can be planned.',
    appAssessmentKind: 'diagnostic',
    note: 'Directly matches the app kind of the same name.',
  },
  {
    id: 'formative',
    title: 'Formative assessment',
    definition:
      'Any form of assessment used to give feedback to the learner. Not recorded ' +
      'for reporting.',
    appAssessmentKind: 'practice',
    note:
      'Practice and quiz in the app are formative in this sense: they feed back to ' +
      'the learner and are not reported as a formal result.',
  },
  {
    id: 'summative',
    title: 'Summative assessment',
    definition:
      'Used to record a judgement of the competence or performance of the learner.',
    appAssessmentKind: 'test',
    note:
      'Test and exam are the app kinds that record a judgement. Whether any of ' +
      'them is summative in the official sense depends on the Programme of ' +
      'Assessment, which is not yet in the repository.',
  },
]

export const ncsAssessmentType = (id: NcsAssessmentTypeId): NcsAssessmentType | undefined =>
  NCS_ASSESSMENT_TYPES.find(t => t.id === id)

/**
 * What the document says about promotion, recorded because it constrains how
 * the app may present a Mathematics result.
 */
export const MATHEMATICS_PROMOTION_STATEMENT =
  'Promotion at Grade 10 and Grade 11 is based on internal assessment only, but ' +
  'must be based on the same conditions as those for the Further Education and ' +
  'Training Certificate.'

// ── Study-guide modules → Assessment Standards ──────────────────────────────
//
// The app teaches the 11 study-guide modules; the NCS sets the standards. This
// table is the bridge, so any skill or question can be traced to the standard it
// serves. `moduleNumber` values are the canonical identities from
// `mathematics/modules.ts`.

export interface NcsModuleMapping {
  moduleNumber: number
  standards: NcsStandardId[]
  /**
   * Content in the guide that sits outside, or ahead of, Grade 10. These are
   * not errors in the guide — it is a revision resource — but the app must not
   * present them as Grade 10 coverage.
   */
  crossGrade?: { grade: 11 | 12; skillIds: string[]; reason: string }[]
}

export const MATHEMATICS_MODULE_STANDARDS: NcsModuleMapping[] = [
  { moduleNumber: 1, standards: ['10.2.4'] },                       // Algebraic Expressions
  { moduleNumber: 2, standards: ['10.1.2', '10.2.5'] },             // Exponents
  { moduleNumber: 3, standards: ['10.1.3'] },                       // Number Patterns
  { moduleNumber: 4, standards: ['10.2.5'] },                       // Equations and Inequalities
  { moduleNumber: 5, standards: ['10.3.5', '10.3.6'],              // Trigonometry
    crossGrade: [{
      grade: 11,
      skillIds: ['TRG-SPECIAL'],
      reason:
        'Memorised special-angle values belong to 11.3.5(a), which requires deriving and ' +
        'using the values of 30°, 45° and 60° in surd form. Grade 10 10.3.5 stops at defining ' +
        'and using the functions via similarity, so TRG-SPECIAL is revision content beyond the ' +
        'Grade 10 standard and must not be reported as Grade 10 coverage.',
    }] },
  { moduleNumber: 6, standards: ['10.2.1', '10.2.2', '10.2.3', '10.2.7'] }, // Functions and Graphs
  { moduleNumber: 7, standards: ['10.3.1', '10.3.2'] },             // Euclidean Geometry and Measurement
  { moduleNumber: 8, standards: ['10.3.3', '10.3.4'] },             // Analytical Geometry
  { moduleNumber: 9, standards: ['10.1.2', '10.1.4', '10.1.5'],    // Finance and Growth
    crossGrade: [{
      grade: 11,
      skillIds: ['FIN-DEPREC'],
      reason:
        'Straight-line and reducing-balance depreciation appear under 11.1.4, in the decay ' +
        'formulae, rather than in Grade 10 10.1.4, which covers growth. FIN-DEPREC is a ' +
        'widely taught practical topic, so it is kept, but tagged as beyond the standard.',
    }] },
  { moduleNumber: 10, standards: ['10.4.1', '10.4.3'] },            // Statistics
  { moduleNumber: 11, standards: ['10.4.2'] },                      // Probability
]

export const ncsStandardsForModule = (moduleNumber: number): NcsStandardId[] =>
  MATHEMATICS_MODULE_STANDARDS.find(m => m.moduleNumber === moduleNumber)?.standards ?? []

/** Skills the guide teaches that belong to a later grade's standard. */
export const crossGradeSkills = (): { skillId: string; grade: number; reason: string }[] =>
  MATHEMATICS_MODULE_STANDARDS.flatMap(m =>
    (m.crossGrade ?? []).flatMap(c => c.skillIds.map(skillId => ({
      skillId, grade: c.grade, reason: c.reason,
    }))),
  )

/** Every standard a learner has to meet, ordered. */
export const allNcsStandards = (): NcsAssessmentStandard[] =>
  MATHEMATICS_LEARNING_OUTCOMES.flatMap(lo =>
    GRADE10_ASSESSMENT_STANDARDS.filter(s => s.outcome === lo.number),
  )

/**
 * The eleven study-guide modules, in guide order.
 *
 * This is the one place a module's identity is defined. Lesson files, question
 * files and the data index all read from here so a topic id can never drift
 * out of sync with the curriculum seed in `subjects.ts`.
 */
export interface ModuleMeta {
  /** Position in the guide, 1 to 11. */
  number: number
  /** Slug used to build the topic id: `mathematics--<slug>`. */
  slug: string
  title: string
  /** When the guide expects this module to be taught. */
  termLabel: string
}

export const MODULES: ModuleMeta[] = [
  { number: 1, slug: 'algebraic-expressions', title: 'Algebraic Expressions', termLabel: 'Term 1' },
  { number: 2, slug: 'exponents', title: 'Exponents', termLabel: 'Term 1' },
  { number: 3, slug: 'number-patterns', title: 'Number Patterns', termLabel: 'Term 1' },
  { number: 4, slug: 'equations-and-inequalities', title: 'Equations and Inequalities', termLabel: 'Term 1' },
  { number: 5, slug: 'trigonometry', title: 'Trigonometry', termLabel: 'Terms 1–2' },
  { number: 6, slug: 'functions-and-graphs', title: 'Functions and Graphs', termLabel: 'Term 2' },
  { number: 7, slug: 'euclidean-geometry-and-measurement', title: 'Euclidean Geometry and Measurement', termLabel: 'Terms 2–3' },
  { number: 8, slug: 'analytical-geometry', title: 'Analytical Geometry', termLabel: 'Term 3' },
  { number: 9, slug: 'finance-and-growth', title: 'Finance and Growth', termLabel: 'Term 3' },
  { number: 10, slug: 'statistics', title: 'Statistics', termLabel: 'Term 3' },
  { number: 11, slug: 'probability', title: 'Probability', termLabel: 'Terms 3–4' },
]

const BY_NUMBER = new Map(MODULES.map(m => [m.number, m]))

export const moduleMeta = (moduleNumber: number): ModuleMeta => {
  const meta = BY_NUMBER.get(moduleNumber)
  if (!meta) throw new Error(`No study-guide module ${moduleNumber}`)
  return meta
}

/** The topic id a module's questions and lessons belong to. */
export const moduleTopicId = (moduleNumber: number): string =>
  `mathematics--${moduleMeta(moduleNumber).slug}`

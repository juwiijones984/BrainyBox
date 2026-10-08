import type {
  CapsPaper, CapsSubjectId, CapsSubjectPolicy, CapsTask, CapsWeighting,
} from './types'

// ── Source ─────────────────────────────────────────────────────────────────
// Transcribed from:
//   FET CAPS AMENDMENTS — Curriculum and Assessment Policy Statement
//   ABRIDGED SECTION 4: GRADE 10–11 NCS CAPS
//   Department of Basic Education, implementation date January 2020.
//
// Two constraints from that document shape this whole file:
//
//  1. It is an *abridgement*. Section A is explicit that the amendments "must be
//     read together with the relevant assessment guidelines in the full CAPS
//     for each subject and Grade". Nothing here replaces the full CAPS, and no
//     value below is invented to fill a gap in it.
//
//  2. It does not cover Mathematics. "Engineering Graphics and Design,
//     Mathematics and Technical Mathematics are not included in this booklet,
//     as there are no changes effected to the existing number of tasks in the
//     CAPS of the identified subjects." Mathematics therefore has a policy
//     entry with `status: 'not-amended'` and no task list, because guessing at
//     a Programme of Assessment would be worse than admitting the gap.
//
// Every percentage, mark count and duration below is as printed in the
// booklet. `scripts/check-data.ts` re-derives the internal totals (SBA weight
// sums to 100, cognitive splits sum to 100, promotion mark matches the final
// paper marks against the final weighting) so a transcription slip fails the
// build instead of quietly shipping.

export const CAPS_AMENDMENTS = {
  title: 'FET CAPS Amendments: Curriculum and Assessment Policy Statement, Abridged Section 4: Grade 10–11 NCS CAPS',
  publisher: 'Department of Basic Education',
  implementationDate: '2020-01',
  /** The booklet's own instruction on how far it goes. */
  standing: 'Read together with the relevant assessment guidelines in the full CAPS for each subject and Grade. This abridgement is not a replacement for the full CAPS.',
} as const

/** CAPS states durations in hours; the runner works in minutes. */
const h = (hours: number) => hours * 60

// Cognitive and difficulty splits, reused across the grades that share them.
const MATH_LIT_TAXONOMY: CapsWeighting[] = [
  { label: 'Level 1 — Knowing', pct: 30, tolerance: 5 },
  { label: 'Level 2 — Applying routine procedures in familiar contexts', pct: 30, tolerance: 5 },
  { label: 'Level 3 — Applying multi-step procedures in a variety of contexts', pct: 20, tolerance: 5 },
  { label: 'Level 4 — Reasoning and reflecting', pct: 20, tolerance: 5 },
]

const LIFE_SCIENCES_COGNITIVE: CapsWeighting[] = [
  { label: 'Knowing science', pct: 40 },
  { label: 'Understanding science', pct: 25 },
  { label: 'Applying knowledge and understanding', pct: 20 },
  { label: 'Evaluating, analysing and synthesising', pct: 15 },
]

const LIFE_SCIENCES_DIFFICULTY: CapsWeighting[] = [
  { label: 'Easy', pct: 30 },
  { label: 'Moderately challenging', pct: 40 },
  { label: 'Difficult', pct: 25 },
  { label: 'Very difficult', pct: 5 },
]

const HISTORY_COGNITIVE_10: CapsWeighting[] = [
  { label: 'Level 1 — Knowing', pct: 40 },
  { label: 'Level 2 — Understanding and applying', pct: 40 },
  { label: 'Level 3 — Analysing and evaluating', pct: 20 },
]

const HISTORY_COGNITIVE_11: CapsWeighting[] = [
  { label: 'Level 1 — Knowing', pct: 30 },
  { label: 'Level 2 — Understanding and applying', pct: 50 },
  { label: 'Level 3 — Analysing and evaluating', pct: 20 },
]

const ECONOMICS_COGNITIVE: CapsWeighting[] = [
  { label: 'Basic', pct: 30 },
  { label: 'Middle-order', pct: 40 },
  { label: 'Higher-order', pct: 30 },
]

const BUSINESS_COGNITIVE: CapsWeighting[] = [
  { label: 'Basic', pct: 30 },
  { label: 'Moderately high', pct: 50 },
  { label: 'Higher-order', pct: 20 },
]

const ACCOUNTING_COGNITIVE: CapsWeighting[] = [
  { label: 'Basic', pct: 30 },
  { label: 'Moderately high', pct: 40 },
  { label: 'Higher-order', pct: 30 },
]

const ACCOUNTING_DIFFICULTY: CapsWeighting[] = [
  { label: 'Easy', pct: 30 },
  { label: 'Moderately challenging', pct: 40 },
  { label: 'Difficult', pct: 30 },
]

/** The universal three degrees of difficulty the booklet applies to all tasks. */
const GENERAL_DIFFICULTY_NOTE =
  'All tasks are pitched across the CAPS degrees of difficulty: Level 1 easy, Level 2 moderately challenging, Level 3 difficult.'

const paper = (
  label: string,
  title: string,
  rawMarks: number,
  durationMin: number | null,
  extra: Partial<CapsPaper> = {},
): CapsPaper => ({ label, title, rawMarks, durationMin, cognitive: [], ...extra })

const task = (t: Omit<CapsTask, 'papers'> & { papers: CapsPaper[] }): CapsTask => t

// ── §4.4.1 Physical Sciences ───────────────────────────────────────────────
const PHYSICAL_SCIENCES_10: CapsSubjectPolicy = {
  id: 'physical-sciences',
  name: 'Physical Sciences',
  section: '§4.4.1, Table 2',
  grade: 10,
  status: 'amended',
  sbaWeightPct: 25,
  finalWeightPct: 75,
  promotionMark: 400,
  notes:
    'Two formal experiments are assessed, one Chemistry and one Physics, one in Term 1 and one in Term 3. ' +
    'Five practical activities are completed across Grades 10 and 11 in total: the two formal experiments, one project and two informal experiments. ' +
    GENERAL_DIFFICULTY_NOTE,
  tasks: [
    task({
      id: 'ps10-t1-experiment',
      name: 'Experiment',
      type: 'experiment',
      term: 1,
      sbaWeightPct: 10,
      termWeightPct: 10,
      papers: [paper('Experiment', 'Practical investigation', 50, h(2))],
      notes: 'Minimum 50 marks and a minimum of 2 hours. One of the two assessed experiments is Chemistry, the other Physics.',
    }),
    task({
      id: 'ps10-t1-test',
      name: 'Controlled Test',
      type: 'controlled test',
      term: 1,
      sbaWeightPct: 25,
      termWeightPct: 25,
      papers: [paper('Control Test', 'Controlled test', 75, h(1.5))],
    }),
    task({
      id: 'ps10-t2-midyear',
      name: 'Mid-Year Examination',
      type: 'examination',
      term: 2,
      sbaWeightPct: 30,
      termWeightPct: 30,
      papers: [paper('P1', 'Mid-Year Examination Paper 1', 75, h(1.5))],
      notes: 'Two papers of 75 marks, 1,5 hours each.',
    }),
    task({
      id: 'ps10-t3-experiment',
      name: 'Experiment',
      type: 'experiment',
      term: 3,
      sbaWeightPct: 10,
      termWeightPct: 10,
      papers: [paper('Experiment', 'Practical investigation', 50, h(2))],
      notes: 'Minimum 50 marks and a minimum of 2 hours.',
    }),
    task({
      id: 'ps10-t3-test',
      name: 'Controlled Test',
      type: 'controlled test',
      term: 3,
      sbaWeightPct: 25,
      termWeightPct: 25,
      papers: [paper('Control Test', 'Controlled test', 75, h(1.5))],
    }),
    task({
      id: 'ps10-t4-final',
      name: 'End-of-Year Examination',
      type: 'examination',
      term: 4,
      sbaWeightPct: 0,
      papers: [paper('P1', 'End-of-Year Examination Paper 1', 150, h(3))],
      notes: 'Two papers of 150 marks, 3 hours each. Carries the 75% final-examination weighting.',
    }),
  ],
}

const PHYSICAL_SCIENCES_11: CapsSubjectPolicy = {
  ...PHYSICAL_SCIENCES_10,
  section: '§4.4.1, Table 3',
  grade: 11,
  // Grade 11 keeps the two experiments at "minimum 50 marks, minimum 2 hours"
  // and the same 2 × 150 / 3-hour final, but its mid-year and its controlled
  // tests both grow to two papers.
  tasks: [
    task({
      id: 'ps11-t1-experiment',
      name: 'Experiment',
      type: 'experiment',
      term: 1,
      sbaWeightPct: 10,
      termWeightPct: 10,
      papers: [paper('Experiment', 'Practical investigation', 50, h(2))],
      notes: 'Minimum 50 marks and a minimum of 2 hours. One of the two assessed experiments is Chemistry, the other Physics.',
    }),
    task({
      id: 'ps11-t1-test',
      name: 'Controlled Test',
      type: 'controlled test',
      term: 1,
      sbaWeightPct: 25,
      termWeightPct: 25,
      papers: [
        paper('P1', 'Controlled test', 50, h(1)),
        paper('P2', 'Controlled test', 50, h(1)),
      ],
      notes: 'Two papers of 50 marks, 1 hour each.',
    }),
    task({
      id: 'ps11-t2-midyear',
      name: 'Mid-Year Examination',
      type: 'examination',
      term: 2,
      sbaWeightPct: 30,
      termWeightPct: 30,
      papers: [
        paper('P1', 'Mid-Year Examination Paper 1', 100, h(2)),
        paper('P2', 'Mid-Year Examination Paper 2', 100, h(2)),
      ],
      notes: 'Two papers of 100 marks, 2 hours each.',
    }),
    task({
      id: 'ps11-t3-experiment',
      name: 'Experiment',
      type: 'experiment',
      term: 3,
      sbaWeightPct: 10,
      termWeightPct: 10,
      papers: [paper('Experiment', 'Practical investigation', 50, h(2))],
      notes: 'Minimum 50 marks and a minimum of 2 hours.',
    }),
    task({
      id: 'ps11-t3-test',
      name: 'Controlled Test',
      type: 'controlled test',
      term: 3,
      sbaWeightPct: 25,
      termWeightPct: 25,
      papers: [
        paper('P1', 'Controlled test', 50, h(1)),
        paper('P2', 'Controlled test', 50, h(1)),
      ],
      notes: 'Two papers of 50 marks, 1 hour each.',
    }),
    task({
      id: 'ps11-t4-final',
      name: 'End-of-Year Examination',
      type: 'examination',
      term: 4,
      sbaWeightPct: 0,
      papers: [
        paper('P1', 'End-of-Year Examination Paper 1', 150, h(3)),
        paper('P2', 'End-of-Year Examination Paper 2', 150, h(3)),
      ],
      notes: 'Two papers of 150 marks, 3 hours each. Carries the 75% final-examination weighting.',
    }),
  ],
}

// ── §4.6.1 Life Sciences ───────────────────────────────────────────────────
const lifeSciencesTasks = (grade: 10 | 11): CapsTask[] => {
  const p = (n: string) => n.replace(/\b10\b/, String(grade))
  return [
    task({
      id: `ls${grade}-t1-practical`,
      name: 'Practical',
      type: 'practical',
      term: 1,
      sbaWeightPct: 15,
      termWeightPct: 25,
      papers: [paper('Practical', 'Term 1 practical', 30, null)],
      notes: 'Minimum 30 marks. Counts 15% of the SBA and 25% of both the term reporting mark and the term promotion mark.',
    }),
    task({
      id: `ls${grade}-t1-test`,
      name: 'Test',
      type: 'test',
      term: 1,
      sbaWeightPct: 15,
      termWeightPct: 75,
      papers: [paper('Test', 'Term 1 test', 50, null)],
      notes: 'Minimum 50 marks. Counts 15% of the SBA and 75% of the term reporting and promotion marks.',
    }),
    task({
      id: `ls${grade}-t2-practical`,
      name: 'Practical',
      type: 'practical',
      term: 2,
      sbaWeightPct: 15,
      termWeightPct: 25,
      papers: [paper('Practical', 'Term 2 practical', 30, null)],
      notes: 'Minimum 30 marks.',
    }),
    task({
      id: `ls${grade}-t2-midyear`,
      name: 'Mid-Year Examination',
      type: 'examination',
      term: 2,
      sbaWeightPct: 25,
      termWeightPct: 75,
      papers: [paper('P1', 'Mid-Year Examination', 150, h(2.5))],
      notes: 'One paper of 150 marks over 2,5 hours.',
    }),
    task({
      id: `ls${grade}-t3-project`,
      name: 'Project or Assignment',
      type: 'project or assignment',
      term: 3,
      sbaWeightPct: 15,
      termWeightPct: 25,
      papers: [paper('Project/Assignment', 'Term 3 project or assignment', 50, null)],
      notes: 'Minimum 50 marks. At least one project and at least one assignment must be completed across Grades 10 and 11.',
    }),
    task({
      id: `ls${grade}-t3-test`,
      name: 'Test',
      type: 'test',
      term: 3,
      sbaWeightPct: 15,
      termWeightPct: 75,
      papers: [paper('Test', 'Term 3 test', 50, null)],
      notes: 'Minimum 50 marks.',
    }),
    task({
      id: `ls${grade}-t4-final`,
      name: 'End-of-Year Examination',
      type: 'examination',
      term: 4,
      sbaWeightPct: 0,
      papers: [
        paper('P1', 'End-of-Year Examination Paper 1', 150, h(2.5), {
          structure: 'Section A 50 marks, Section B 2 × 50 marks',
          cognitive: LIFE_SCIENCES_COGNITIVE,
        }),
        paper('P2', 'End-of-Year Examination Paper 2', 150, h(2.5), {
          structure: 'Section A 50 marks, Section B 2 × 50 marks',
          cognitive: LIFE_SCIENCES_COGNITIVE,
        }),
      ],
      notes: p('Two papers of 150 marks, 2,5 hours each. Carries the 75% final-examination weighting.'),
    }),
  ]
}

const lifeSciencesBase: Omit<CapsSubjectPolicy, 'grade' | 'tasks' | 'section'> = {
  id: 'life-sciences',
  name: 'Life Sciences',
  status: 'amended',
  sbaWeightPct: 25,
  finalWeightPct: 75,
  promotionMark: 400,
  difficulty: LIFE_SCIENCES_DIFFICULTY,
  notes:
    'Papers and content are pitched at 40% knowing science, 25% understanding, 20% applying and 15% evaluating, ' +
    'analysing or synthesising. Across the year the SBA is weighted 55% to tests and examinations and 45% to ' +
    'practical tasks and the project or assignment. Life Sciences is the one subject in the booklet that uses a ' +
    'fourth degree of difficulty: 30% easy, 40% moderately challenging, 25% difficult and 5% very difficult.',
}

const LIFE_SCIENCES_10: CapsSubjectPolicy = {
  ...lifeSciencesBase,
  section: '§4.6.1, Table 7',
  grade: 10,
  tasks: lifeSciencesTasks(10),
}

const LIFE_SCIENCES_11: CapsSubjectPolicy = {
  ...lifeSciencesBase,
  section: '§4.6.1, Table 8',
  grade: 11,
  tasks: lifeSciencesTasks(11),
}

// ── §4.3.1 Mathematical Literacy ───────────────────────────────────────────
const mathLitTasks = (grade: 10 | 11): CapsTask[] => [
  task({
    id: `ml${grade}-t1-assignment`,
    name: 'Assignment',
    type: 'assignment',
    term: 1,
    sbaWeightPct: 10,
    papers: [paper('Assignment', 'Term 1 assignment', 50, null)],
    notes: 'First term assignment, 10% of the SBA.',
  }),
  task({
    id: `ml${grade}-t2-assignment`,
    name: 'Assignment',
    type: 'assignment',
    term: 2,
    sbaWeightPct: 10,
    papers: [paper('Assignment', 'Term 2 assignment', 50, null)],
  }),
  task({
    id: `ml${grade}-t3-investigation`,
    name: 'Investigation',
    type: 'investigation',
    term: 3,
    sbaWeightPct: 10,
    papers: [paper('Investigation', 'Term 3 investigation', 50, null)],
  }),
  task({
    id: `ml${grade}-t4-test1`,
    name: 'Test',
    type: 'test',
    term: 4,
    sbaWeightPct: 20,
    papers: [paper('P1', 'Examination paper 1', 150, null, {
      topics: [
        { label: 'Finance', pct: 60, tolerance: 5 },
        { label: 'Data handling', pct: 35, tolerance: 5 },
        { label: 'Probability', pct: 5 },
      ],
      cognitive: MATH_LIT_TAXONOMY,
    })],
  }),
  task({
    id: `ml${grade}-t4-exam`,
    name: 'Examination',
    type: 'examination',
    term: 4,
    sbaWeightPct: 30,
    papers: [paper('P2', 'Examination paper 2', 150, null, {
      topics: [
        { label: 'Maps and physical representation of the world', pct: 40, tolerance: 5 },
        { label: 'Measurements in an everyday context', pct: 55, tolerance: 5 },
        { label: 'Probability', pct: 5 },
      ],
      cognitive: MATH_LIT_TAXONOMY,
    })],
  }),
  // A second Term 4 test was previously listed here as `ml{grade}-t4-test2`,
  // declaring paper `P2` with the same 150 marks and the same topic allocation as
  // the examination above — one paper entered twice. It is removed, and Term 4's
  // controlled test keeps its 20%.
]

const MATH_LIT_SBA_SHORTFALL_NOTE =
  'The tasks listed here total 80% of the SBA, not 100%: Term 4 carries one controlled ' +
  'test (20%) and the end-of-year examination (30%), and the earlier terms\' 30% ' +
  'completes it. No weight is redistributed to hide the gap.'

const mathLitBase: Omit<CapsSubjectPolicy, 'grade' | 'tasks' | 'section'> = {
  id: 'mathematical-literacy',
  name: 'Mathematical Literacy',
  status: 'amended',
  sbaWeightPct: 25,
  finalWeightPct: 75,
  promotionMark: 400,
  sbaWeightNote: MATH_LIT_SBA_SHORTFALL_NOTE,
  notes:
    'Every paper is pitched at 30% Level 1 knowing, 30% Level 2 applying routine procedures in familiar ' +
    'contexts, 20% Level 3 applying multi-step procedures in a variety of contexts and 20% Level 4 reasoning ' +
    'and reflecting. The first question in each paper must be pitched at Level 1 and carry 20% ± 5% of the paper.',
}

const MATHEMATICAL_LITERACY_10: CapsSubjectPolicy = {
  ...mathLitBase,
  section: '§4.3.1, Table 4',
  grade: 10,
  tasks: mathLitTasks(10),
}

const MATHEMATICAL_LITERACY_11: CapsSubjectPolicy = {
  ...mathLitBase,
  section: '§4.3.1, Table 4',
  grade: 11,
  tasks: mathLitTasks(11),
}

// ── §5.1 Geography ─────────────────────────────────────────────────────────
const geographyControlledTest = (grade: 10 | 11): CapsTask =>
  task({
    id: `geo${grade}-t1-test`,
    name: 'Controlled Test',
    type: 'controlled test',
    term: 1,
    sbaWeightPct: 20,
    termWeightPct: 75,
    papers: [paper('Controlled Test', 'Controlled test', 60, h(1))],
    notes: '60 marks in 60 minutes, covering roughly four to six weeks of the term’s work.',
  })

const GEOGRAPHY_10: CapsSubjectPolicy = {
  id: 'geography',
  name: 'Geography',
  section: '§5.1, Table 5',
  grade: 10,
  status: 'amended',
  sbaWeightPct: 25,
  finalWeightPct: 75,
  promotionMark: 400,
  notes:
    'The essay is replaced by a research task in Grade 11. Geography carries three different forms of ' +
    'assessment inside the SBA — written tests, mapwork and an essay — so the mapwork and essay must be ' +
    'scheduled around the tests rather than treated as extra practice.',
  tasks: [
    geographyControlledTest(10),
    task({
      id: 'geo10-t2-essay',
      name: 'Essay',
      type: 'essay',
      term: 2,
      sbaWeightPct: 20,
      termWeightPct: 25,
      papers: [paper('Essay', 'Topic essay', 100, null)],
    }),
    task({
      id: 'geo10-t2-mapwork',
      name: 'Mapwork',
      type: 'mapwork',
      term: 2,
      sbaWeightPct: 20,
      termWeightPct: 25,
      papers: [paper('Mapwork', 'Mapwork', 60, null)],
    }),
    task({
      id: 'geo10-t2-midyear',
      name: 'Mid-Year Examination',
      type: 'examination',
      term: 2,
      sbaWeightPct: 20,
      termWeightPct: 75,
      papers: [paper('P1', 'Mid-Year Examination', 150, h(3), {
        topics: [
          { label: 'The Atmosphere', pct: 40 },
          { label: 'Geomorphology', pct: 40 },
          { label: 'Mapwork', pct: 20 },
        ],
      })],
      notes: 'One paper of 150 marks over 3 hours: Atmosphere 60, Geomorphology 60, Mapwork 30.',
    }),
    task({
      id: 'geo10-t3-test',
      name: 'Test',
      type: 'test',
      term: 3,
      sbaWeightPct: 20,
      termWeightPct: 100,
      papers: [paper('Test', 'Controlled test', 60, h(1))],
    }),
    task({
      id: 'geo10-t4-final',
      name: 'End-of-Year Examination',
      type: 'examination',
      term: 4,
      sbaWeightPct: 0,
      papers: [
        paper('P1', 'End-of-Year Examination Paper 1', 150, null, {
          topics: [
            { label: 'The Atmosphere', pct: 40 },
            { label: 'Geomorphology', pct: 40 },
            { label: 'Mapwork', pct: 20 },
          ],
        }),
        paper('P2', 'End-of-Year Examination Paper 2', 150, null, {
          topics: [
            { label: 'Population', pct: 40 },
            { label: 'Water resources', pct: 40 },
            { label: 'Mapwork', pct: 20 },
          ],
        }),
      ],
      notes: 'Two papers of 150 marks. Carries the 75% final-examination weighting.',
    }),
  ],
}

const GEOGRAPHY_11: CapsSubjectPolicy = {
  id: 'geography',
  name: 'Geography',
  section: '§5.1, Table 6',
  grade: 11,
  status: 'amended',
  sbaWeightPct: 25,
  finalWeightPct: 75,
  promotionMark: 400,
  notes: 'The Grade 10 essay becomes a research task, and the mid-year splits into two papers of 75 marks.',
  tasks: [
    geographyControlledTest(11),
    task({
      id: 'geo11-t2-research',
      name: 'Research Task',
      type: 'research',
      term: 2,
      sbaWeightPct: 20,
      termWeightPct: 25,
      papers: [paper('Research', 'Research task', 100, null)],
      notes: 'Replaces the Grade 10 essay.',
    }),
    task({
      id: 'geo11-t2-mapwork',
      name: 'Mapwork',
      type: 'mapwork',
      term: 2,
      sbaWeightPct: 20,
      termWeightPct: 25,
      papers: [paper('Mapwork', 'Mapwork', 60, null)],
    }),
    task({
      id: 'geo11-t2-midyear',
      name: 'Mid-Year Examination',
      type: 'examination',
      term: 2,
      sbaWeightPct: 20,
      termWeightPct: 75,
      papers: [
        paper('P1', 'Mid-Year Examination Paper 1', 75, null, {
          topics: [
            { label: 'The Atmosphere', pct: 47 },
            { label: 'Geomorphology', pct: 53 },
          ],
        }),
        paper('P2', 'Mid-Year Examination Paper 2', 75, null, {
          topics: [
            { label: 'Population', pct: 47 },
            { label: 'Water resources', pct: 53 },
          ],
        }),
      ],
      notes: 'Two papers of 75 marks, 3 hours in total. Atmosphere 35 and Geomorphology 40; Population 35 and Water 40.',
    }),
    task({
      id: 'geo11-t3-test',
      name: 'Test',
      type: 'test',
      term: 3,
      sbaWeightPct: 20,
      termWeightPct: 100,
      papers: [paper('Test', 'Controlled test', 60, h(1))],
    }),
    task({
      id: 'geo11-t4-final',
      name: 'End-of-Year Examination',
      type: 'examination',
      term: 4,
      sbaWeightPct: 0,
      papers: [
        paper('P1', 'End-of-Year Examination Paper 1', 150, null, {
          topics: [
            { label: 'The Atmosphere', pct: 40 },
            { label: 'Geomorphology', pct: 40 },
            { label: 'Mapwork', pct: 20 },
          ],
        }),
        paper('P2', 'End-of-Year Examination Paper 2', 150, null, {
          topics: [
            { label: 'Development geography', pct: 40 },
            { label: 'Resources', pct: 40 },
            { label: 'Mapwork', pct: 20 },
          ],
        }),
      ],
    }),
  ],
}

// ── §5.2 History ───────────────────────────────────────────────────────────
const HISTORY_10: CapsSubjectPolicy = {
  id: 'history',
  name: 'History',
  section: '§5.2, Table 7',
  grade: 10,
  status: 'amended',
  sbaWeightPct: 25,
  finalWeightPct: 75,
  promotionMark: 400,
  notes:
    'The heritage investigation is compulsory in Grade 10 and must include a research component. History ' +
    'papers are pitched at 40% Level 1 knowing, 40% Level 2 understanding and applying and 20% Level 3 ' +
    'analysing and evaluating.',
  tasks: [
    task({
      id: 'his10-t1-source-essay',
      name: 'Source-based or Essay Task',
      type: 'source or essay',
      term: 1,
      sbaWeightPct: 10,
      termWeightPct: 25,
      papers: [paper('Task', 'Source-based or essay task', 50, h(1), { cognitive: HISTORY_COGNITIVE_10 })],
    }),
    task({
      id: 'his10-t1-standardised',
      name: 'Standardised Test',
      type: 'standardised test',
      term: 1,
      sbaWeightPct: 20,
      termWeightPct: 75,
      papers: [paper('Test', 'Standardised test', 100, h(2), { cognitive: HISTORY_COGNITIVE_10 })],
      notes: 'Includes a source-based question and an essay.',
    }),
    task({
      id: 'his10-t2-heritage',
      name: 'Heritage Investigation or Oral History',
      type: 'heritage investigation',
      term: 2,
      sbaWeightPct: 20,
      termWeightPct: 25,
      papers: [paper('Task', 'Heritage investigation or oral history', 50, null, { cognitive: HISTORY_COGNITIVE_10 })],
      notes: 'Compulsory in Grade 10 and must include a research component.',
    }),
    task({
      id: 'his10-t2-midyear',
      name: 'Mid-Year Examination',
      type: 'examination',
      term: 2,
      sbaWeightPct: 20,
      termWeightPct: 75,
      papers: [paper('P1', 'Mid-Year Examination', 100, h(2), { cognitive: HISTORY_COGNITIVE_10 })],
      notes: 'One 2-hour paper. Two questions of 50 marks: one essay and one source-based question.',
    }),
    task({
      id: 'his10-t3-source-essay',
      name: 'Essay or Source-based Task',
      type: 'source or essay',
      term: 3,
      sbaWeightPct: 10,
      termWeightPct: 25,
      papers: [paper('Task', 'Essay or source-based task', 50, h(1), { cognitive: HISTORY_COGNITIVE_10 })],
    }),
    task({
      id: 'his10-t3-standardised',
      name: 'Standardised Test',
      type: 'standardised test',
      term: 3,
      sbaWeightPct: 20,
      termWeightPct: 75,
      papers: [paper('Test', 'Standardised test', 100, h(2), { cognitive: HISTORY_COGNITIVE_10 })],
    }),
    task({
      id: 'his10-t4-final',
      name: 'End-of-Year Examination',
      type: 'examination',
      term: 4,
      sbaWeightPct: 0,
      papers: [paper('P1', 'End-of-Year Examination', 150, h(3), { cognitive: HISTORY_COGNITIVE_10 })],
      notes:
        'One 3-hour paper. Answer three of four questions of 50 marks: one source-based, one essay and one ' +
        'other. Scaled to 300 for the promotion mark. Carries the 75% final-examination weighting.',
    }),
  ],
}

const HISTORY_11: CapsSubjectPolicy = {
  id: 'history',
  name: 'History',
  section: '§5.2, Table 8',
  grade: 11,
  status: 'amended',
  sbaWeightPct: 25,
  finalWeightPct: 75,
  promotionMark: 400,
  notes:
    'Grade 11 pitches papers at 30% Level 1 knowing, 50% Level 2 understanding and applying and 20% Level 3 ' +
    'analysing and evaluating. The mid-year grows to 150 marks and the end-of-year splits into two papers.',
  tasks: [
    task({
      id: 'his11-t1-source-essay',
      name: 'Source-based or Essay Task',
      type: 'source or essay',
      term: 1,
      sbaWeightPct: 10,
      termWeightPct: 25,
      papers: [paper('Task', 'Source-based or essay task', 50, h(1), { cognitive: HISTORY_COGNITIVE_11 })],
    }),
    task({
      id: 'his11-t1-standardised',
      name: 'Standardised Test',
      type: 'standardised test',
      term: 1,
      sbaWeightPct: 20,
      termWeightPct: 75,
      papers: [paper('Test', 'Standardised test', 100, h(2), { cognitive: HISTORY_COGNITIVE_11 })],
    }),
    task({
      id: 'his11-t2-research',
      name: 'Research Task',
      type: 'research',
      term: 2,
      sbaWeightPct: 20,
      termWeightPct: 25,
      papers: [paper('Task', 'Research task', 50, h(2), { cognitive: HISTORY_COGNITIVE_11 })],
    }),
    task({
      id: 'his11-t2-midyear',
      name: 'Mid-Year Examination',
      type: 'examination',
      term: 2,
      sbaWeightPct: 20,
      termWeightPct: 75,
      papers: [paper('P1', 'Mid-Year Examination', 150, h(2), { cognitive: HISTORY_COGNITIVE_11 })],
    }),
    task({
      id: 'his11-t3-source-essay',
      name: 'Essay or Source-based Task',
      type: 'source or essay',
      term: 3,
      sbaWeightPct: 10,
      termWeightPct: 25,
      papers: [paper('Task', 'Essay or source-based task', 50, h(1), { cognitive: HISTORY_COGNITIVE_11 })],
    }),
    task({
      id: 'his11-t3-standardised',
      name: 'Standardised Test',
      type: 'standardised test',
      term: 3,
      sbaWeightPct: 20,
      termWeightPct: 75,
      papers: [paper('Test', 'Standardised test', 100, h(2), { cognitive: HISTORY_COGNITIVE_11 })],
    }),
    task({
      id: 'his11-t4-final',
      name: 'End-of-Year Examination',
      type: 'examination',
      term: 4,
      sbaWeightPct: 0,
      papers: [
        paper('P1', 'End-of-Year Examination Paper 1', 100, h(3), { cognitive: HISTORY_COGNITIVE_11 }),
        paper('P2', 'End-of-Year Examination Paper 2', 100, h(3), { cognitive: HISTORY_COGNITIVE_11 }),
        paper('P3', 'End-of-Year Examination Paper 3', 100, h(3), { cognitive: HISTORY_COGNITIVE_11 }),
      ],
      notes:
        'Three papers of 100 marks, 3 hours each. Learners answer two of the three papers, each of which has ' +
        'three questions of 50 marks. Carries the 75% final-examination weighting.',
    }),
  ],
}

/** Minutes for the whole task, where the booklet gives a per-task figure. */

/**
 * The three Economic Sciences subjects print the same six SBA tasks in the
 * abridgement, and in all three the printed weightings reach only 90%. Rather
 * than close the gap with a percentage the booklet does not print, the
 * shortfall is recorded on each policy and checked for.
 */
const ECON_SBA_SHORTFALL_NOTE =
  'The six printed SBA weightings in the booklet total 90%, not 100%. The remaining 10% is not itemised ' +
  'in the abridgement, so it is left unallocated here rather than filled in with an invented weight. ' +
  'The full subject CAPS settles this.'

const economicBase = (
  id: CapsSubjectId,
  name: string,
  section: string,
  cognitive: CapsWeighting[],
  extra: Partial<Omit<CapsSubjectPolicy, 'tasks'>> = {},
): Omit<CapsSubjectPolicy, 'tasks'> => ({
  id,
  name,
  section,
  grade: 10,
  status: 'amended',
  sbaWeightPct: 25,
  finalWeightPct: 75,
  promotionMark: 400,
  sbaWeightNote: ECON_SBA_SHORTFALL_NOTE,
  ...extra,
})

// ── §2 Economic Sciences ───────────────────────────────────────────────────
const ACCOUNTING_10: CapsSubjectPolicy = {
  ...economicBase('accounting', 'Accounting', '§2.1.1, Table 1', ACCOUNTING_COGNITIVE, {
    difficulty: ACCOUNTING_DIFFICULTY,
    notes:
      'Papers are pitched at 30% basic, 40% moderately high and 30% higher-order questions, with 10–15% of ' +
      'the total focused on problem-solving.',
  }),
  tasks: [
    task({
      id: 'acc10-t1-presentation',
      name: 'Presentation',
      type: 'presentation',
      term: 1,
      sbaWeightPct: 10,
      termWeightPct: 25,
      papers: [paper('Presentation', 'Oral presentation', 50, h(1), { cognitive: ACCOUNTING_COGNITIVE })],
    }),
    task({
      id: 'acc10-t1-test',
      name: 'Test',
      type: 'test',
      term: 1,
      sbaWeightPct: 20,
      termWeightPct: 75,
      papers: [paper('Test', 'Test', 100, h(1.5), { cognitive: ACCOUNTING_COGNITIVE })],
    }),
    task({
      id: 'acc10-t2-project',
      name: 'Project',
      type: 'project',
      term: 2,
      sbaWeightPct: 10,
      termWeightPct: 25,
      papers: [paper('Project', 'Project', 50, null, { cognitive: ACCOUNTING_COGNITIVE })],
      notes: 'Completed across Terms 1 to 3.',
    }),
    task({
      id: 'acc10-t2-midyear',
      name: 'Mid-Year Examination',
      type: 'examination',
      term: 2,
      sbaWeightPct: 20,
      termWeightPct: 75,
      papers: [paper('P1', 'Mid-Year Examination', 200, h(2.5), { cognitive: ACCOUNTING_COGNITIVE })],
      notes: 'One paper of 200 marks over 2,5 hours.',
    }),
    task({
      id: 'acc10-t3-case-study',
      name: 'Case Study',
      type: 'case study',
      term: 3,
      sbaWeightPct: 10,
      termWeightPct: 25,
      papers: [paper('Case Study', 'Case study', 50, h(1.5), { cognitive: ACCOUNTING_COGNITIVE })],
    }),
    task({
      id: 'acc10-t3-test',
      name: 'Test',
      type: 'test',
      term: 3,
      sbaWeightPct: 20,
      termWeightPct: 75,
      papers: [paper('Test', 'Test', 100, h(1.5), { cognitive: ACCOUNTING_COGNITIVE })],
    }),
    task({
      id: 'acc10-t4-final',
      name: 'End-of-Year Examination',
      type: 'examination',
      term: 4,
      sbaWeightPct: 0,
      papers: [
        paper('P1', 'End-of-Year Examination Paper 1', 150, h(2), { cognitive: ACCOUNTING_COGNITIVE }),
        paper('P2', 'End-of-Year Examination Paper 2', 150, h(2), { cognitive: ACCOUNTING_COGNITIVE }),
      ],
      notes: 'Two papers of 150 marks, 2 hours each. Carries the 75% final-examination weighting.',
    }),
  ],
}

const BUSINESS_STUDIES_10: CapsSubjectPolicy = {
  ...economicBase('business-studies', 'Business Studies', '§2.2.1, Table 9', BUSINESS_COGNITIVE, {
    notes:
      'Papers are pitched at 30% basic, 50% moderately high and 20% higher-order questions, with 10% focused ' +
      'on problem-solving. The presentation is marked 40 for the written component and 10 for a maximum ' +
      'five-minute oral.',
  }),
  tasks: [
    task({
      id: 'bus10-t1-case-study',
      name: 'Case Study',
      type: 'case study',
      term: 1,
      sbaWeightPct: 10,
      termWeightPct: 25,
      papers: [paper('Case Study', 'Case study', 50, h(2), { cognitive: BUSINESS_COGNITIVE })],
    }),
    task({
      id: 'bus10-t1-test',
      name: 'Controlled Test',
      type: 'controlled test',
      term: 1,
      sbaWeightPct: 20,
      termWeightPct: 75,
      papers: [paper('Controlled Test', 'Controlled test', 100, h(1.5), { cognitive: BUSINESS_COGNITIVE })],
    }),
    task({
      id: 'bus10-t2-presentation',
      name: 'Presentation',
      type: 'presentation',
      term: 2,
      sbaWeightPct: 10,
      termWeightPct: 25,
      papers: [paper('Presentation', 'Oral presentation', 50, h(1), { cognitive: BUSINESS_COGNITIVE })],
      notes: '40 marks for the written component and 10 marks for a maximum five-minute oral.',
    }),
    task({
      id: 'bus10-t2-june',
      name: 'June Examination',
      type: 'examination',
      term: 2,
      sbaWeightPct: 20,
      termWeightPct: 75,
      papers: [
        paper('P1', 'June Examination Paper 1', 100, h(1.5), { cognitive: BUSINESS_COGNITIVE }),
        paper('P2', 'June Examination Paper 2', 100, h(1.5), { cognitive: BUSINESS_COGNITIVE }),
      ],
    }),
    task({
      id: 'bus10-t3-project',
      name: 'Project',
      type: 'project',
      term: 3,
      sbaWeightPct: 10,
      termWeightPct: 25,
      papers: [paper('Project', 'Project', 50, null, { cognitive: BUSINESS_COGNITIVE })],
      notes: 'Six weeks to complete.',
    }),
    task({
      id: 'bus10-t3-test',
      name: 'Controlled Test',
      type: 'controlled test',
      term: 3,
      sbaWeightPct: 20,
      termWeightPct: 75,
      papers: [paper('Controlled Test', 'Controlled test', 100, h(1.5), { cognitive: BUSINESS_COGNITIVE })],
    }),
    task({
      id: 'bus10-t4-final',
      name: 'End-of-Year Examination',
      type: 'examination',
      term: 4,
      sbaWeightPct: 0,
      papers: [
        paper('P1', 'End-of-Year Examination Paper 1', 150, h(2), { cognitive: BUSINESS_COGNITIVE }),
        paper('P2', 'End-of-Year Examination Paper 2', 150, h(2), { cognitive: BUSINESS_COGNITIVE }),
      ],
      notes: 'Two papers of 150 marks, 2 hours each. Carries the 75% final-examination weighting.',
    }),
  ],
}

const ECONOMICS_10: CapsSubjectPolicy = {
  ...economicBase('economics', 'Economics', '§2.3.1, Table 10', ECONOMICS_COGNITIVE, {
    notes:
      'Papers are pitched at 30% basic, 40% middle-order and 30% higher-order questions, with 10% focused ' +
      'on problem-solving. The booklet does not prescribe a duration for Economics tasks, so none is recorded.',
  }),
  tasks: [
    task({
      id: 'eco10-t1-assignment',
      name: 'Assignment',
      type: 'assignment',
      term: 1,
      sbaWeightPct: 10,
      termWeightPct: 25,
      papers: [paper('Assignment', 'Assignment', 50, null, { cognitive: ECONOMICS_COGNITIVE })],
    }),
    task({
      id: 'eco10-t1-test',
      name: 'Controlled Test',
      type: 'controlled test',
      term: 1,
      sbaWeightPct: 20,
      termWeightPct: 75,
      papers: [paper('Controlled Test', 'Controlled test', 100, null, { cognitive: ECONOMICS_COGNITIVE })],
    }),
    task({
      id: 'eco10-t2-project',
      name: 'Project',
      type: 'project',
      term: 2,
      sbaWeightPct: 10,
      termWeightPct: 25,
      papers: [paper('Project', 'Project', 50, null, { cognitive: ECONOMICS_COGNITIVE })],
    }),
    task({
      id: 'eco10-t2-midyear',
      name: 'Mid-Year Examination',
      type: 'examination',
      term: 2,
      sbaWeightPct: 20,
      termWeightPct: 75,
      papers: [
        paper('P1', 'Mid-Year Examination Paper 1', 100, null, { cognitive: ECONOMICS_COGNITIVE }),
        paper('P2', 'Mid-Year Examination Paper 2', 100, null, { cognitive: ECONOMICS_COGNITIVE }),
      ],
    }),
    task({
      id: 'eco10-t3-case-study',
      name: 'Case Study',
      type: 'case study',
      term: 3,
      sbaWeightPct: 10,
      termWeightPct: 25,
      papers: [paper('Case Study', 'Case study', 50, null, { cognitive: ECONOMICS_COGNITIVE })],
    }),
    task({
      id: 'eco10-t3-test',
      name: 'Controlled Test',
      type: 'controlled test',
      term: 3,
      sbaWeightPct: 20,
      termWeightPct: 75,
      papers: [paper('Controlled Test', 'Controlled test', 100, null, { cognitive: ECONOMICS_COGNITIVE })],
    }),
    task({
      id: 'eco10-t4-final',
      name: 'End-of-Year Examination',
      type: 'examination',
      term: 4,
      sbaWeightPct: 0,
      papers: [
        paper('P1', 'End-of-Year Examination Paper 1', 150, null, { cognitive: ECONOMICS_COGNITIVE }),
        paper('P2', 'End-of-Year Examination Paper 2', 150, null, { cognitive: ECONOMICS_COGNITIVE }),
      ],
      notes: 'Two papers of 150 marks. Carries the 75% final-examination weighting.',
    }),
  ],
}

// ── Mathematics — curriculum known, Programme of Assessment still not ──────
const MATHEMATICS_NOT_AMENDED: CapsSubjectPolicy = {
  id: 'mathematics',
  name: 'Mathematics',
  section: 'Excluded from the abridged booklet; curriculum from the NCS Subject Statement',
  grade: 10,
  status: 'not-amended',
  sbaWeightPct: 25,
  finalWeightPct: 75,
  promotionMark: 400,
  tasks: [],
  notes:
    'The amendments booklet deliberately excludes Mathematics: "Engineering Graphics and Design, Mathematics ' +
    'and Technical Mathematics are not included in this booklet, as there are no changes effected to the ' +
    'existing number of tasks in the CAPS of the identified subjects." The 25/75 split shown here is the ' +
    'standard FET split and is carried only so the app can render a complete ' +
    'picture — it is not transcribed from the booklet. The curriculum side is now sourced: the full NCS ' +
    'Subject Statement (Department of Education, 2003, ISBN 1-919975-28-4) supplies the four Learning ' +
    'Outcomes, the 24 Grade 10 Assessment Standards and the official six-point achievement scale, all ' +
    'recorded in `mathematicsCaps.ts`. That Subject Statement does not print a Programme of Assessment — ' +
    'no task schedule, paper structure, durations or SBA weighting — so the task list stays empty and no ' +
    'Mathematics quiz may be labelled an official task until the Learning Programme Guidelines are in.',
}

export const CAPS_POLICIES: CapsSubjectPolicy[] = [
  MATHEMATICS_NOT_AMENDED,
  MATHEMATICAL_LITERACY_10, MATHEMATICAL_LITERACY_11,
  PHYSICAL_SCIENCES_10, PHYSICAL_SCIENCES_11,
  LIFE_SCIENCES_10, LIFE_SCIENCES_11,
  GEOGRAPHY_10, GEOGRAPHY_11,
  HISTORY_10, HISTORY_11,
  ACCOUNTING_10,
  BUSINESS_STUDIES_10,
  ECONOMICS_10,
]

// ── Derived helpers ────────────────────────────────────────────────────────
export const capsPolicyFor = (
  id: CapsSubjectId,
  grade: 10 | 11 = 10,
): CapsSubjectPolicy | undefined =>
  CAPS_POLICIES.find(p => p.id === id && p.grade === grade)

/** Raw marks across every paper in a task. */
export const capsTaskMarks = (t: CapsTask): number =>
  t.papers.reduce((sum, p) => sum + p.rawMarks, 0)

/**
 * Raw marks across the final examination, which carries the final weighting.
 *
 * Only the `examination` task. Summing every Term 4 task instead reported
 * Mathematical Literacy as 450 raw marks against a 150-mark exam, because Term 4
 * also holds the two controlled tests — and the app showed that inflated total as
 * the learner's maximum.
 *
 * Subjects whose Term 4 has no `examination` entry fall back to the whole term:
 * reporting something is better than reporting nothing, and `ProgrammePage`
 * labels which case it is looking at.
 */
export const capsFinalMarks = (p: CapsSubjectPolicy): number => {
  const term4 = p.tasks.filter(t => t.term === 4)
  const exams = term4.filter(t => t.type === 'examination')
  const final = exams.length ? exams : term4
  return final.reduce((sum, t) => sum + capsTaskMarks(t), 0)
}

/** True when `capsFinalMarks` fell back to the whole term rather than an exam. */
export const capsHasFinalExam = (p: CapsSubjectPolicy): boolean =>
  p.tasks.some(t => t.term === 4 && t.type === 'examination')

/** Total SBA weighting, which CAPS requires to reach 100%. */
export const capsSbaWeightTotal = (p: CapsSubjectPolicy): number =>
  p.tasks.reduce((sum, t) => sum + t.sbaWeightPct, 0)

/** The weighting split by term, for the term-by-term view. */
export const capsWeightByTerm = (p: CapsSubjectPolicy): Map<1 | 2 | 3 | 4, number> => {
  const byTerm = new Map<1 | 2 | 3 | 4, number>()
  for (const t of p.tasks) byTerm.set(t.term, (byTerm.get(t.term) ?? 0) + t.sbaWeightPct)
  return byTerm
}

/** Sum of a weighting list — CAPS splits are expected to total 100. */
export const capsWeightingTotal = (w: CapsWeighting[]): number =>
  w.reduce((sum, x) => sum + x.pct, 0)

/**
 * Does a quiz actually satisfy a prescribed task? A quiz may only be marked as
 * an official task when the mark total, the paper count, the duration and the
 * cognitive mix all line up with the task CAPS prescribed. Anything less is
 * practice wearing a formal label.
 */
export const quizMatchesCapsTask = (
  quiz: { questionIds: string[]; timeLimitMin: number | null },
  task: CapsTask,
  questions: { id: string; marks: number }[],
): { ok: boolean; reasons: string[] } => {
  const reasons: string[] = []
  const byId = new Map(questions.map(q => [q.id, q]))
  const asked = quiz.questionIds.map(id => byId.get(id)).filter(Boolean) as { marks: number }[]

  const expectedMarks = capsTaskMarks(task)
  const actualMarks = asked.reduce((sum, q) => sum + q.marks, 0)
  if (actualMarks !== expectedMarks) {
    reasons.push(`carries ${actualMarks} marks but the task is prescribed as ${expectedMarks}`)
  }

  const expectedDuration = task.papers.find(p => p.durationMin !== null)?.durationMin ?? null
  if (expectedDuration !== null && quiz.timeLimitMin !== expectedDuration) {
    reasons.push(`is limited to ${quiz.timeLimitMin} minutes but the task allows ${expectedDuration}`)
  }

  // Cognitive mix. The check is a *floor*, not a formula: CAPS prescribes the
  // proportion of a paper at each cognitive level, not a question count per level,
  // and nothing in the quiz model records which level a question is pitched at.
  // So this verifies the paper carries enough questions for the prescribed split to
  // be expressible at all — one question per percentage point, rounded up, with a
  // minimum of two per level — and says so plainly rather than claiming to have
  // checked the mix. It previously tested only `asked.length === 0`, which any
  // non-empty question list passes, so the entire compliance gate was a no-op and
  // `scripts/check-data.ts` inherited the false assurance.
  const cognitive = task.papers.flatMap(p => p.cognitive)
  const cognitiveTotal = capsWeightingTotal(cognitive)
  if (cognitiveTotal > 0) {
    const needed = cognitive.reduce((sum, c) => sum + Math.max(2, Math.ceil(c.pct)), 0)
    if (asked.length < needed) {
      reasons.push(
        `asks ${asked.length} questions, too few to carry the prescribed ${cognitiveTotal}% `
        + `cognitive split across ${cognitive.length} levels (at least ${needed} needed)`,
      )
    }
  }

  // Paper count. A two-paper task is not satisfied by one paper of the right total.
  const prescribedPapers = task.papers.length
  if (prescribedPapers > 1 && asked.length > 0) {
    // Questions carry no paper reference, so the only thing that can be verified
    // is that there are enough of them to fill both papers at the prescribed size.
    const perPaper = Math.ceil(expectedMarks / prescribedPapers)
    if (asked.length < prescribedPapers * 2) {
      reasons.push(
        `asks ${asked.length} questions for a ${prescribedPapers}-paper task, which needs `
        + `${prescribedPapers} papers of about ${perPaper} marks each`,
      )
    }
  }

  return { ok: reasons.length === 0, reasons }
}

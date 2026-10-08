import type { Concept, Lesson, WorkedExample } from '../types'
import { moduleMeta, moduleTopicId } from './modules'
import { WORKING_SPACE_CHECKLIST } from './lessonsTerm1'

const RATIONALE_DEFAULT =
  'Check signs, exponents, units and labels before moving on.'

type ModuleInput = Omit<Lesson, 'subjectId' | 'checklist'>

const mod = (input: ModuleInput): Lesson => ({
  subjectId: 'mathematics',
  checklist: WORKING_SPACE_CHECKLIST,
  ...input,
})

type Section = Pick<Concept, 'skillId' | 'title' | 'body'>
type Example = Pick<WorkedExample, 'skillId' | 'title' | 'prompt' | 'steps'> & {
  rationale?: string
}

const lessons = (
  moduleNumber: number,
  vocabulary: string[],
  sections: Section[],
  workedExamples: Example[],
): Lesson => {
  const meta = moduleMeta(moduleNumber)
  return mod({
    topicId: moduleTopicId(moduleNumber),
    moduleNumber,
    title: meta.title,
    termLabel: meta.termLabel,
    vocabulary,
    concepts: sections.map((s, i) => ({ id: `c${i + 1}`, ...s })),
    workedExamples: workedExamples.map((w, i) => ({
      id: `w${i + 1}`,
      rationale: RATIONALE_DEFAULT,
      ...w,
    })),
  })
}

export const LESSONS_TERM3: Lesson[] = [
  lessons(
    9,
    ['Percentages', 'Simple growth', 'Compound growth', 'Depreciation', 'Inflation', 'Financial reasoning'],
    [
      {
        skillId: 'FIN-PERC',
        title: 'Percentages',
        body: 'Convert a percentage to a decimal before calculating: 8% = 0,08. The most common lost mark in this module is dividing by 100 twice, or forgetting to.',
      },
      {
        skillId: 'FIN-SIMPLE',
        title: 'Simple growth',
        body: 'Simple interest is always calculated on the original principal, never on the growing balance. A = P(1 + in).',
      },
      {
        skillId: 'FIN-COMPOUND',
        title: 'Compound growth',
        body: 'Compound interest is calculated on the growing balance each period, so the interest itself earns interest. A = P(1 + i)ⁿ.',
      },
      {
        skillId: 'FIN-DEPREC',
        title: 'Depreciation',
        body: 'Reducing-balance depreciation uses A = P(1 − i)ⁿ. A car loses a percentage of what it is currently worth, not of its original price.',
      },
      {
        skillId: 'FIN-INFL',
        title: 'Inflation',
        body: 'Inflation is the percentage increase in the cost of living over time. Real value falls by a different rate from the one inflation rises by.',
      },
      {
        skillId: 'FIN-REASON',
        title: 'Financial reasoning',
        body: 'Adding 20% and then subtracting 20% does not return you to the original value, because the two percentages act on different bases.',
      },
    ],
    [
      {
        skillId: 'FIN-SIMPLE',
        title: 'Simple interest',
        prompt: 'P = R1000, i = 10%, n = 2 years',
        steps: [
          'A = P(1 + i × n)',
          'A = 1000(1 + 0,10 × 2)',
          'A = 1000(1,2)',
          'A = R1200',
        ],
        rationale: 'Interest over two years is 10% × 2 = 20% of the original R1000, which is R200.',
      },
      {
        skillId: 'FIN-COMPOUND',
        title: 'Compound interest',
        prompt: 'P = R1000, i = 10%, n = 2 years',
        steps: [
          'A = P(1 + i)ⁿ',
          'A = 1000(1,10)²',
          'A = 1000 × 1,21',
          'A = R1210',
        ],
        rationale: 'R10 more than the simple answer, and that difference is the interest earned on the first year’s interest.',
      },
      {
        skillId: 'FIN-DEPREC',
        title: 'Depreciation',
        prompt: 'P = R20000, i = 15%, n = 1 year',
        steps: ['A = P(1 − i)ⁿ', 'A = 20000(0,85)', 'A = R17000'],
        rationale: 'The car lost 15% of R20000, which is R3000, leaving R17000.',
      },
      {
        skillId: 'FIN-REASON',
        title: 'Reverse to the principal',
        prompt: 'A = R12100, i = 10%, n = 2 years',
        steps: [
          'Work backwards from A = P(1 + i)ⁿ.',
          '12100 = P(1,1)²',
          '12100 = P(1,21)',
          'P = 12100 / 1,21',
          'P = R10000',
        ],
        rationale: 'Dividing by the growth factor reverses the process and recovers the original principal.',
      },
    ],
  ),

  lessons(
    10,
    ['Data', 'Mean', 'Median and mode', 'Range', 'Quartiles', 'Data displays'],
    [
      {
        skillId: 'STA-DATA',
        title: 'Reading the data',
        body: 'Statistics organises and interprets information. Before calculating anything, identify what each observation actually represents and what the units are.',
      },
      {
        skillId: 'STA-MEAN',
        title: 'Mean',
        body: 'The mean uses every value, so a single extreme value pulls it noticeably. Add the values and divide by how many there are.',
      },
      {
        skillId: 'STA-MEDIAN',
        title: 'Median and mode',
        body: 'The median is the middle value once the data is ordered — average the two middle values when there are an even number. The mode is the most frequent value. Both are far less affected by extreme values than the mean.',
      },
      {
        skillId: 'STA-RANGE',
        title: 'Range',
        body: 'Range = maximum − minimum. A large range means the data is widely spread out, which tells you the mean alone is not a fair summary.',
      },
      {
        skillId: 'STA-QUART',
        title: 'Quartiles',
        body: 'Order the data, then split it into four equal sections. Q1, Q2 and Q3 are the values at the 25th, 50th and 75th percentiles, and the IQR is Q3 − Q1.',
      },
      {
        skillId: 'STA-DISPLAY',
        title: 'Data displays',
        body: 'Read the title, labels, intervals and scale before interpreting any graph. A display can mislead if its scale is distorted or truncated.',
      },
    ],
    [
      {
        skillId: 'STA-MEAN',
        title: 'Mean',
        prompt: '2, 4, 6, 8',
        steps: ['Add the values: 2 + 4 + 6 + 8 = 20', 'Count the values: 4', 'Mean = 20/4 = 5'],
        rationale: 'Divide by how many values there are, not by the number of steps between them.',
      },
      {
        skillId: 'STA-MEDIAN',
        title: 'Median',
        prompt: '3, 5, 7, 9, 11',
        steps: ['The data is already in order.', 'There are 5 values, so the middle is the third.', 'Median = 7'],
        rationale: 'With an even number of values you must average the two middle ones instead.',
      },
      {
        skillId: 'STA-RANGE',
        title: 'Range',
        prompt: '7, 12, 4, 19, 10',
        steps: ['Maximum = 19', 'Minimum = 4', 'Range = 19 − 4 = 15'],
        rationale: 'A range of 15 across five values is a wide spread, so quote the median alongside the mean.',
      },
      {
        skillId: 'STA-QUART',
        title: 'Quartiles',
        prompt: '1, 3, 4, 6, 7, 9, 12, 15',
        steps: [
          'Eight values, so each quartile covers two values.',
          'Q2 (median) = (6 + 7)/2 = 6,5',
          'Lower half 1, 3, 4, 6: Q1 = (3 + 4)/2 = 3,5',
          'Upper half 7, 9, 12, 15: Q3 = (9 + 12)/2 = 10,5',
        ],
        rationale: 'IQR = Q3 − Q1 = 10,5 − 3,5 = 7. Include the two middle values in the upper half.',
      },
    ],
  ),

  lessons(
    11,
    ['Probability scale', 'Sample spaces', 'Theoretical probability', 'Complement', 'Combined events', 'Reasoning'],
    [
      {
        skillId: 'PRB-SCALE',
        title: 'The probability scale',
        body: 'Probabilities lie between 0 and 1. Zero means impossible and one means certain. A probability greater than 1 or below 0 is always a mistake.',
      },
      {
        skillId: 'PRB-SPACE',
        title: 'Sample spaces',
        body: 'A sample space lists every possible outcome. It must be complete and the outcomes must not overlap, or your probability will be wrong.',
      },
      {
        skillId: 'PRB-THEO',
        title: 'Theoretical probability',
        body: 'For equally likely outcomes, probability = favourable outcomes ÷ total outcomes. Check that all outcomes really are equally likely before you divide.',
      },
      {
        skillId: 'PRB-COMP',
        title: 'Complement',
        body: 'P(not E) = 1 − P(E). This is much faster than listing every outcome that is not E.',
      },
      {
        skillId: 'PRB-COMBINED',
        title: 'Combined events',
        body: 'For multi-stage experiments draw a table or a tree diagram. With two fair coins the sample space is HH, HT, TH, TT — four equally likely outcomes.',
      },
      {
        skillId: 'PRB-REASON',
        title: 'Experimental vs theoretical',
        body: 'Experimental probability counts what actually happened in a trial; theoretical probability is the mathematical model based on equally likely outcomes. Over many trials the experimental result approaches the theoretical one.',
      },
    ],
    [
      {
        skillId: 'PRB-THEO',
        title: 'Rolling a die',
        prompt: 'P(rolling a 4)',
        steps: ['A fair die has 6 equally likely outcomes.', 'Only one of them is a 4.', 'P = 1/6'],
        rationale: 'Both the numerator and the denominator are counts of outcomes, so no units are needed.',
      },
      {
        skillId: 'PRB-COMP',
        title: 'Complement',
        prompt: 'P(rain) = 0,3',
        steps: ['P(no rain) = 1 − P(rain)', 'P(no rain) = 1 − 0,3', 'P(no rain) = 0,7'],
        rationale: 'Every outcome is either rain or no rain, so the two probabilities must total 1.',
      },
      {
        skillId: 'PRB-COMBINED',
        title: 'Two coins',
        prompt: 'P(at least one head)',
        steps: [
          'Sample space: HH, HT, TH, TT — 4 outcomes.',
          'Favourable outcomes: HH, HT, TH — 3 outcomes.',
          'P = 3/4',
        ],
        rationale: '"At least one" includes HH, so it is easier to use the complement: 1 − P(TT) = 1 − 1/4 = 3/4.',
      },
      {
        skillId: 'PRB-COMBINED',
        title: 'Two dice',
        prompt: 'P(sum is 7)',
        steps: [
          'Favourable outcomes: (1,6), (2,5), (3,4), (4,3), (5,2), (6,1) — 6 outcomes.',
          'Total outcomes: 6 × 6 = 36',
          'P = 6/36 = 1/6',
        ],
        rationale: 'Dice are distinguishable, so (1,6) and (6,1) are two different outcomes.',
      },
    ],
  ),
]

export default LESSONS_TERM3

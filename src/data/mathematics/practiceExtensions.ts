import type { Question } from '../types'
import { buildPracticeQuestions, type PracticeQuestion } from './questionBuilder'

// ── Module 1: Algebraic Expressions ─────────────────────────────────────────
// The guide's own fifteen questions never test "Algebraic language" directly,
// even though it is the module's first key-vocabulary term.
const M1: PracticeQuestion[] = [
  {
    slot: 'alglang-1', skillId: 'ALG-LANG', moduleNumber: 1, difficulty: 'easy',
    text: 'In the expression 4a^2 - 3ab + 7, which term is the constant?',
    options: ['4a^2', '-3ab', '7', '-3ab + 7'],
    correct: 2,
    explanation: 'A constant has no variable in it. 4a^2 and -3ab both contain letters, so the constant is 7.',
  },
  {
    slot: 'alglang-2', skillId: 'ALG-LANG', moduleNumber: 1, difficulty: 'easy',
    text: 'Write the coefficient of y in -9y + 4.',
    accepted: ['-9'],
    explanation: 'The coefficient is the number multiplying the variable, including its sign, so it is -9.',
  },
]

// ── Module 2: Exponents ─────────────────────────────────────────────────────
const M2: PracticeQuestion[] = [
  {
    slot: 'expprod-1', skillId: 'EXP-PROD', moduleNumber: 2, difficulty: 'easy',
    text: 'Simplify x^3 x x^4.', accepted: ['x^7'],
    explanation: 'Add the exponents when multiplying: 3 + 4 = 7, so x^3 x x^4 = x^7.',
  },
  {
    slot: 'expprod-2', skillId: 'EXP-PROD', moduleNumber: 2, difficulty: 'medium',
    text: 'Simplify 2^3 x 2^5.', accepted: ['2^8'],
    explanation: 'Keep the same base and add the exponents: 2^(3+5) = 2^8 = 256.',
  },
  {
    slot: 'exppow-1', skillId: 'EXP-POWER', moduleNumber: 2, difficulty: 'medium',
    text: 'Simplify (x^4)^3.', accepted: ['x^12'],
    explanation: 'Multiply the exponents when raising a power to a power: 4 x 3 = 12, so (x^4)^3 = x^12.',
  },
  {
    slot: 'exppow-2', skillId: 'EXP-POWER', moduleNumber: 2, difficulty: 'hard',
    text: 'Simplify (2x^3)^2.', accepted: ['4x^6', '4x6'],
    explanation: 'Square each part: 2^2 x^(3x2) = 4x^6.',
  },
  {
    slot: 'expzero-1', skillId: 'EXP-ZERO', moduleNumber: 2, difficulty: 'easy',
    text: 'Evaluate 7^0.', accepted: ['1'],
    explanation: 'Any non-zero number to the power of zero equals 1, so 7^0 = 1.',
  },
  {
    slot: 'expzero-2', skillId: 'EXP-ZERO', moduleNumber: 2, difficulty: 'medium',
    text: 'Simplify (3x^4)^0.', accepted: ['1'],
    explanation: 'The whole bracket is raised to zero, and any non-zero value to the power of zero is 1.',
  },
]

// ── Module 3: Number Patterns ───────────────────────────────────────────────
const M3: PracticeQuestion[] = [
  {
    slot: 'patrecog-1', skillId: 'PAT-RECOG', moduleNumber: 3, difficulty: 'easy',
    text: 'What comes next: 3, 7, 11, 15, ...?', accepted: ['19'],
    explanation: 'Each term is 4 more than the one before, so the next term is 15 + 4 = 19.',
  },
  {
    slot: 'patrecog-2', skillId: 'PAT-RECOG', moduleNumber: 3, difficulty: 'hard',
    text: 'What comes next: 2, 6, 18, 54, ...?', accepted: ['162'],
    explanation: 'Each term is multiplied by 3, so the next term is 54 x 3 = 162.',
  },
  {
    slot: 'patdiff-1', skillId: 'PAT-DIFF', moduleNumber: 3, difficulty: 'easy',
    text: 'Find the common difference of 7, 12, 17, 22, ...', accepted: ['5'],
    explanation: 'Common difference is the constant step between terms: 12 - 7 = 5.',
  },
  {
    slot: 'patdiff-2', skillId: 'PAT-DIFF', moduleNumber: 3, difficulty: 'medium',
    text: 'A sequence has a common difference of -3. If the first term is 20, what is the fourth term?',
    accepted: ['11'],
    explanation: '20, 17, 14, 11. Count three steps of -3 from the first term.',
  },
  {
    slot: 'patreason-1', skillId: 'PAT-REASON', moduleNumber: 3, difficulty: 'hard',
    text: 'Figure 1 has 1 dot and every figure adds 3 dots. How many dots are in figure 12?',
    accepted: ['34'],
    explanation: 'Figure n has 1 + 3(n - 1) dots, so figure 12 has 1 + 3(11) = 34.',
  },
  {
    slot: 'patreason-2', skillId: 'PAT-REASON', moduleNumber: 3, difficulty: 'hard',
    text: 'The pattern 2, 5, 10, 17, 26, ... continues. What is the seventh term?',
    accepted: ['50'],
    explanation: 'The differences are 3, 5, 7, 9, so the next differences are 11 and 13: 26 + 11 = 37, then 37 + 13 = 50.',
  },
]

// ── Module 4: Equations and Inequalities ────────────────────────────────────
const M4: PracticeQuestion[] = [
  {
    slot: 'eqnlin-1', skillId: 'EQN-LIN', moduleNumber: 4, difficulty: 'easy',
    text: 'Solve 4x - 7 = 17.', accepted: ['6', 'x=6'],
    explanation: 'Add 7 to both sides: 4x = 24, then divide by 4 to get x = 6.',
  },
  {
    slot: 'eqnlin-2', skillId: 'EQN-LIN', moduleNumber: 4, difficulty: 'medium',
    text: 'Solve 2x/5 = 8.', accepted: ['20', 'x=20'],
    explanation: 'Multiply both sides by 5: 2x = 40, then divide by 2 to get x = 20.',
  },
]

// ── Module 5: Trigonometry ─────────────────────────────────────────────────
const M5: PracticeQuestion[] = [
  {
    slot: 'trglabel-1', skillId: 'TRG-LABEL', moduleNumber: 5, difficulty: 'easy',
    text: 'In a right-angled triangle, which side is always the longest?',
    options: ['The hypotenuse', 'The base', 'The height', 'The vertical side'],
    correct: 0,
    explanation: 'The hypotenuse is the side opposite the right angle and is always the longest side.',
  },
  {
    slot: 'trglabel-2', skillId: 'TRG-LABEL', moduleNumber: 5, difficulty: 'easy',
    text: 'In SOHCAHTOA, which ratio means opposite divided by hypotenuse?',
    options: ['so', 'ca', 'toa', 'cot'],
    correct: 0,
    explanation: 'SOH = Sine = Opposite over Hypotenuse. CAH gives adjacent over hypotenuse.',
  },
  {
    slot: 'trgspecial-1', skillId: 'TRG-SPECIAL', moduleNumber: 5, difficulty: 'easy',
    text: 'Find sin 30 degrees.', accepted: ['0.5', '0,5', '1/2', '0.50'],
    explanation: 'sin 30 degrees is a special angle and equals 1/2 = 0,5.',
  },
  {
    slot: 'trgspecial-2', skillId: 'TRG-SPECIAL', moduleNumber: 5, difficulty: 'medium',
    text: 'Find cos 60 degrees.', accepted: ['0.5', '0,5', '1/2', '0.50'],
    explanation: 'cos 60 degrees is a special angle and equals 1/2 = 0,5.',
  },
]

// ── Module 6: Functions and Graphs ──────────────────────────────────────────
const M6: PracticeQuestion[] = [
  {
    slot: 'funlang-1', skillId: 'FUN-LANG', moduleNumber: 6, difficulty: 'easy',
    text: 'For y = 2x + 1, which statement is correct?',
    options: [
      'x is the dependent variable',
      'y is the dependent variable',
      'x and y are both independent variables',
      'y is the independent variable',
    ],
    correct: 1,
    explanation: 'x can be chosen freely, so x is independent. y depends on x, so y is dependent.',
  },
  {
    slot: 'funlang-2', skillId: 'FUN-LANG', moduleNumber: 6, difficulty: 'medium',
    text: 'f(x) = x^2 is defined on the domain -2 <= x <= 2. What is the range?',
    options: ['0 to 4', '-2 to 2', '0 to 2', '1 to 4'],
    correct: 0,
    explanation: 'The smallest value of x^2 is 0 at x = 0 and the largest is 4 at x = -2 or x = 2, so the range is 0 to 4.',
  },
]

// ── Module 7: Euclidean Geometry and Measurement ───────────────────────────
const M7: PracticeQuestion[] = [
  {
    slot: 'geoparallel-1', skillId: 'GEO-PARALLEL', moduleNumber: 7, difficulty: 'easy',
    text: 'Two parallel lines are cut by a transversal. One interior angle is 70 degrees. ' +
      'What is its co-interior (allied) angle?',
    accepted: ['110'],
    explanation: 'Co-interior angles add to 180 degrees, so the allied angle is 180 - 70 = 110 degrees.',
  },
  {
    slot: 'geoparallel-2', skillId: 'GEO-PARALLEL', moduleNumber: 7, difficulty: 'medium',
    text: 'A transversal cuts two parallel lines, making an angle of 65 degrees. ' +
      'What is the alternate interior angle?',
    options: ['65 degrees', '115 degrees', '25 degrees', '130 degrees'],
    correct: 0,
    explanation: 'Alternate interior angles are equal, so the angle on the opposite side is also 65 degrees.',
  },
  {
    slot: 'geotriangle-1', skillId: 'GEO-TRIANGLE', moduleNumber: 7, difficulty: 'easy',
    text: 'Two angles of a triangle are 48 degrees and 67 degrees. Find the third angle.',
    accepted: ['65'],
    explanation: 'Angles in a triangle add to 180 degrees: 180 - 48 - 67 = 65 degrees.',
  },
  {
    slot: 'geotriangle-2', skillId: 'GEO-TRIANGLE', moduleNumber: 7, difficulty: 'medium',
    text: 'A triangle has angles of 90 degrees and 35 degrees. Is the third angle acute, right or obtuse?',
    accepted: ['acute'],
    explanation: 'The third angle is 180 - 90 - 35 = 55 degrees. Below 90 degrees, so it is acute.',
  },
  {
    slot: 'geoquad-1', skillId: 'GEO-QUAD', moduleNumber: 7, difficulty: 'medium',
    text: 'Three angles of a quadrilateral are 90 degrees, 85 degrees and 100 degrees. Find the fourth angle.',
    accepted: ['85'],
    explanation: 'Interior angles of a quadrilateral add to 360 degrees: 360 - 275 = 85 degrees.',
  },
  {
    slot: 'geoquad-2', skillId: 'GEO-QUAD', moduleNumber: 7, difficulty: 'easy',
    text: 'What is the sum of the interior angles of any quadrilateral?', accepted: ['360'],
    explanation: 'A quadrilateral splits into two triangles along a diagonal, so the sum is 2 x 180 = 360 degrees.',
  },
]

// ── Module 8: Analytical Geometry ───────────────────────────────────────────
const M8: PracticeQuestion[] = [
  {
    slot: 'agtcoord-1', skillId: 'AGT-COORD', moduleNumber: 8, difficulty: 'easy',
    text: 'What is the x-coordinate of the point (-4, 7)?', accepted: ['-4'],
    explanation: 'Read across to the x-axis first: the x-coordinate is the first number, -4.',
  },
  {
    slot: 'agtcoord-2', skillId: 'AGT-COORD', moduleNumber: 8, difficulty: 'medium',
    text: 'Start at (2, 5) and move 3 units right and 2 units down. What are the new coordinates?',
    accepted: ['5,3', '(5,3)', '5;3'],
    explanation: 'Right adds to x: 2 + 3 = 5. Down subtracts from y: 5 - 2 = 3. The point is (5, 3).',
  },
]

// ── Module 9: Finance and Growth ────────────────────────────────────────────
const M9: PracticeQuestion[] = [
  {
    slot: 'fininfl-1', skillId: 'FIN-INFL', moduleNumber: 9, difficulty: 'easy',
    text: 'A television costs R5 000. Inflation is 10%. What does it cost after one year, in rand?',
    accepted: ['5500', '5 500', 'r5500', 'r 5500', 'R5 500'],
    explanation: '10% of 5 000 is 500, and 5 000 + 500 = 5 500. Inflation makes prices rise by the percentage.',
  },
  {
    slot: 'fininfl-2', skillId: 'FIN-INFL', moduleNumber: 9, difficulty: 'medium',
    text: 'An item costs R400. After 25% inflation, what does it cost in rand?',
    accepted: ['500'],
    explanation: '25% of 400 is 100, and 400 + 100 = 500.',
  },
]

// ── Module 10: Statistics ───────────────────────────────────────────────────
const M10: PracticeQuestion[] = [
  {
    slot: 'stadata-1', skillId: 'STA-DATA', moduleNumber: 10, difficulty: 'easy',
    text: 'Find the mean of 4, 8, 10 and 14.', accepted: ['9'],
    explanation: 'Add the values and divide by how many there are: (4 + 8 + 10 + 14) / 4 = 36 / 4 = 9.',
  },
  {
    slot: 'stadata-2', skillId: 'STA-DATA', moduleNumber: 10, difficulty: 'easy',
    text: 'What is the mode of 3, 7, 3, 9, 7, 3, 5?', accepted: ['3'],
    explanation: 'The mode is the value that appears most often. 3 appears three times, more than any other value.',
  },
  {
    slot: 'staquart-1', skillId: 'STA-QUART', moduleNumber: 10, difficulty: 'hard',
    text: 'Find the lower quartile of 2, 4, 6, 8, 10, 12, 14, 16.', accepted: ['5'],
    explanation: 'The lower half is 2, 4, 6, 8. Its median is the mean of the middle two: (4 + 6) / 2 = 5.',
  },
  {
    slot: 'staquart-2', skillId: 'STA-QUART', moduleNumber: 10, difficulty: 'hard',
    text: 'Find the interquartile range of 2, 4, 6, 8, 10, 12, 14, 16.', accepted: ['8'],
    explanation: 'Q1 = 5 and Q3 = (12 + 14) / 2 = 13, so the IQR is 13 - 5 = 8.',
  },
  {
    slot: 'stadisplay-1', skillId: 'STA-DISPLAY', moduleNumber: 10, difficulty: 'medium',
    text: 'Five values have a mean of 20, so they total 100. One value is increased by 10. ' +
      'What is the new mean?',
    accepted: ['22'],
    explanation: 'Increasing one value by 10 makes the new total 110, and the number of values has not changed, so the new mean is 110 / 5 = 22.',
  },
  {
    slot: 'stadisplay-2', skillId: 'STA-DISPLAY', moduleNumber: 10, difficulty: 'easy',
    text: 'Which display best shows how one value changed over time?',
    options: ['Bar graph', 'Line graph', 'Pie chart', 'Pictograph'],
    correct: 1,
    explanation: 'A line graph shows a trend over time clearly, which is what a changing value needs.',
  },
]

// ── Module 11: Probability ──────────────────────────────────────────────────
const M11: PracticeQuestion[] = [
  {
    slot: 'prbscale-1', skillId: 'PRB-SCALE', moduleNumber: 11, difficulty: 'easy',
    text: 'An event is certain to happen. What is its probability?',
    options: ['0', '0,5', '1', 'greater than 1'],
    correct: 2,
    explanation: 'A certain event has probability 1, an impossible event has probability 0, and everything else lies between them.',
  },
  {
    slot: 'prbscale-2', skillId: 'PRB-SCALE', moduleNumber: 11, difficulty: 'easy',
    text: 'Which of these is a valid probability?',
    options: ['1,2', '-0,3', '0,75', '2'],
    correct: 2,
    explanation: 'Probability must lie between 0 and 1 inclusive. 0,75 is the only option in that range.',
  },
  {
    slot: 'prbreason-1', skillId: 'PRB-REASON', moduleNumber: 11, difficulty: 'medium',
    text: 'A spinner has 8 equal sections and 3 are red. Give P(red) as a decimal.',
    accepted: ['0.375', '0,375'],
    explanation: 'P(red) = 3/8 = 0,375.',
  },
  {
    slot: 'prbreason-2', skillId: 'PRB-REASON', moduleNumber: 11, difficulty: 'hard',
    text: 'Two fair coins are tossed. What is the probability that both results are the same?',
    accepted: ['0.5', '0,5', '1/2'],
    explanation: 'The sample space is HH, HT, TH, TT. Two of the four outcomes match, so P = 2/4 = 0,5.',
  },
]

/**
 * Supplementary practice, one array per module so ids and topics stay tidy.
 * Kept separate from the guide bank so the guide's published counts are never
 * quietly changed.
 */
export const MATH_PRACTICE_QUESTIONS: Question[] = [
  ...buildPracticeQuestions(1, M1),
  ...buildPracticeQuestions(2, M2),
  ...buildPracticeQuestions(3, M3),
  ...buildPracticeQuestions(4, M4),
  ...buildPracticeQuestions(5, M5),
  ...buildPracticeQuestions(6, M6),
  ...buildPracticeQuestions(7, M7),
  ...buildPracticeQuestions(8, M8),
  ...buildPracticeQuestions(9, M9),
  ...buildPracticeQuestions(10, M10),
  ...buildPracticeQuestions(11, M11),
]

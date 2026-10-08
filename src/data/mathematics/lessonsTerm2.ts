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

export const LESSONS_TERM2: Lesson[] = [
  lessons(
    5,
    ['Triangle labels', 'SOHCAHTOA', 'Missing sides', 'Missing angles', 'Special angles', 'Applications'],
    [
      {
        skillId: 'TRG-LABEL',
        title: 'Labelling a right-angled triangle',
        body: 'The hypotenuse is the side opposite the right angle — it is always the longest side. Opposite and adjacent depend on the reference angle, so label the triangle relative to the angle you are working with.',
      },
      {
        skillId: 'TRG-SOHCAHTOA',
        title: 'The three ratios',
        body: 'sin θ = opposite/hypotenuse, cos θ = adjacent/hypotenuse, tan θ = opposite/adjacent. SOHCAHTOA is a memory aid for the order of each ratio, not a substitute for drawing and labelling the triangle.',
      },
      {
        skillId: 'TRG-SIDE',
        title: 'Missing sides',
        body: 'Choose the ratio that contains both the known side and the required side, substitute, then solve. Using the wrong ratio is the most common cause of a lost mark here.',
      },
      {
        skillId: 'TRG-ANGLE',
        title: 'Missing angles',
        body: 'Form the ratio from the two known sides, then apply the inverse trigonometric function. Keep your calculator in degree mode.',
      },
      {
        skillId: 'TRG-SPECIAL',
        title: 'Special angles',
        body: 'Know sin 30° = ½, cos 60° = ½ and tan 45° = 1 by heart. These shortcut a large share of exam questions.',
      },
      {
        skillId: 'TRG-APP',
        title: 'Applications',
        body: 'Angle of elevation, depression, ladders and shadows are all the same right triangle viewed from different positions. Draw the triangle, then name the reference angle before choosing a ratio.',
      },
    ],
    [
      {
        skillId: 'TRG-SIDE',
        title: 'Missing side',
        prompt: 'sin 30° = x/10',
        steps: [
          'x = 10 sin 30°',
          'sin 30° = ½',
          'x = 10 × ½ = 5',
        ],
        rationale: 'sin relates opposite and hypotenuse, and here the hypotenuse is the known side of 10.',
      },
      {
        skillId: 'TRG-ANGLE',
        title: 'Missing angle',
        prompt: 'tan θ = 6/8',
        steps: [
          'tan relates opposite and adjacent, so θ = tan⁻¹(6/8).',
          'tan⁻¹(0.75)',
          'θ ≈ 36.87°',
        ],
        rationale: 'Keep the calculator in degree mode. If it is in radians the answer will be wrong by a factor of about 57.',
      },
      {
        skillId: 'TRG-APP',
        title: 'Angle of elevation',
        prompt: 'tan 35° = h/20',
        steps: [
          'h = 20 tan 35°',
          'tan 35° ≈ 0.7002',
          'h ≈ 14.00 m',
        ],
        rationale: 'Angle of elevation is measured from the horizontal, so the horizontal distance is the adjacent side.',
      },
      {
        skillId: 'TRG-SIDE',
        title: 'Linking to Pythagoras',
        prompt: 'A right triangle has legs of 6 and 8. Find the hypotenuse.',
        steps: [
          'Pythagoras: c² = 6² + 8²',
          'c² = 36 + 64 = 100',
          'c = √100 = 10',
        ],
        rationale: 'Pythagoras finds the third side directly, without needing a trigonometric ratio at all.',
      },
    ],
  ),

  lessons(
    6,
    ['Function language', 'Linear graphs', 'Parabolas', 'Hyperbolas', 'Exponential graphs', 'Intercepts'],
    [
      {
        skillId: 'FUN-LANG',
        title: 'Functions',
        body: 'A function assigns each allowed input exactly one output. The domain is the set of permitted x-values; the range is the set of output values actually taken.',
      },
      {
        skillId: 'FUN-LIN',
        title: 'Straight lines',
        body: 'In y = mx + c, m is the gradient (change in y per change in x) and c is the y-intercept. Reading these off the graph is often faster than deriving them from two points.',
      },
      {
        skillId: 'FUN-PARA',
        title: 'Parabolas',
        body: 'In y = ax² + q the sign of a controls which way the parabola opens and q shifts the graph vertically. There is no x-term, so every parabola of this form is symmetric about x = 0.',
      },
      {
        skillId: 'FUN-HYP',
        title: 'Hyperbolas',
        body: 'In y = a/x + q the asymptotes x = 0 and y = q guide the sketch. The curve never touches an asymptote; it approaches it.',
      },
      {
        skillId: 'FUN-EXP',
        title: 'Exponential graphs',
        body: 'y = aˣ shows multiplicative growth when a > 1 and decay when 0 < a < 1. The graph is always above the x-axis and passes through (0, 1).',
      },
      {
        skillId: 'FUN-INT',
        title: 'Intercepts',
        body: 'The y-intercept comes from x = 0. The x-intercepts come from y = 0, which usually means factorising.',
      },
    ],
    [
      {
        skillId: 'FUN-LIN',
        title: 'Reading a line',
        prompt: 'y = 2x − 3',
        steps: ['The gradient is the coefficient of x: m = 2.', 'The y-intercept is the constant: c = −3.'],
        rationale: 'No working is needed — read the two values straight off the equation.',
      },
      {
        skillId: 'FUN-INT',
        title: 'x-intercepts',
        prompt: 'y = x² − 9',
        steps: [
          'Set y = 0: x² − 9 = 0',
          'Difference of squares: (x − 3)(x + 3) = 0',
          'x = 3 or x = −3',
        ],
        rationale: 'The x-intercepts are the points where the graph crosses the x-axis, so they are the answers as x-values.',
      },
      {
        skillId: 'FUN-INT',
        title: 'Intersection of two graphs',
        prompt: 'y = x + 2 and y = x² − 4',
        steps: [
          'Set them equal: x + 2 = x² − 4',
          'Bring to one side: x² − x − 6 = 0',
          'Factorise: (x + 3)(x − 2) = 0',
          'x = −2 or x = 3',
        ],
        rationale: 'For x = −2 the y-value is 0; for x = 3 it is 5. The intersection points are (−2, 0) and (3, 5).',
      },
      {
        skillId: 'FUN-EXP',
        title: 'Exponential table',
        prompt: 'Complete y = 2ˣ for x = −2, −1, 0, 1, 2',
        steps: [
          '2⁻² = 1/4',
          '2⁻¹ = 1/2',
          '2⁰ = 1',
          '2¹ = 2',
          '2² = 4',
        ],
        rationale: 'The x = 0 column is always 1, which is a useful checkpoint before plotting the rest.',
      },
    ],
  ),

  lessons(
    7,
    ['Angle facts', 'Parallel lines', 'Triangles', 'Quadrilaterals', 'Pythagoras', 'Measurement'],
    [
      {
        skillId: 'GEO-ANGLES',
        title: 'Basic angle facts',
        body: 'Angles on a straight line sum to 180°, angles around a point sum to 360°, and vertically opposite angles are equal.',
      },
      {
        skillId: 'GEO-PARALLEL',
        title: 'Parallel lines',
        body: 'Corresponding angles are equal and alternate interior angles are equal. Co-interior angles between parallel lines sum to 180°. Always use the arrow marks to identify which lines are parallel before naming the angle pair.',
      },
      {
        skillId: 'GEO-TRIANGLE',
        title: 'Triangles',
        body: 'The interior angles of any triangle total 180°. The exterior angle of a triangle equals the sum of the two opposite interior angles, which is often the shorter route to the answer.',
      },
      {
        skillId: 'GEO-QUAD',
        title: 'Quadrilaterals',
        body: 'Interior angles total 360°. Learn the defining properties: a parallelogram has both pairs of opposite sides parallel, a rectangle adds four right angles, a rhombus has four equal sides, and a square has all four right angles and four equal sides.',
      },
      {
        skillId: 'GEO-PYTH',
        title: 'Pythagoras',
        body: 'For a right-angled triangle, c² = a² + b². It only ever applies to right-angled triangles, and it finds the third side — not an angle.',
      },
      {
        skillId: 'GEO-MEASURE',
        title: 'Measurement formulae',
        body: 'Perimeter is a length, area is square units, and volume is cubic units. Circle: C = 2πr and A = πr². Always state the unit in your answer.',
      },
    ],
    [
      {
        skillId: 'GEO-ANGLES',
        title: 'Straight line',
        prompt: 'x + 65° = 180°',
        steps: ['Angles on a straight line sum to 180°.', 'x = 180° − 65°', 'x = 115°'],
        rationale: 'If the answer comes out larger than 180°, the two angles are probably not on a straight line.',
      },
      {
        skillId: 'GEO-TRIANGLE',
        title: 'Triangle angle sum',
        prompt: '48° + 71° + x = 180°',
        steps: ['Triangle interior angles total 180°.', 'x = 180° − 48° − 71°', 'x = 61°'],
        rationale: 'Check: 48 + 71 + 61 = 180, so the three angles are consistent.',
      },
      {
        skillId: 'GEO-PYTH',
        title: 'Pythagoras',
        prompt: '6² + 8² = c²',
        steps: ['c² = 36 + 64', 'c² = 100', 'c = 10'],
        rationale: 'Always take the positive square root — a length cannot be negative.',
      },
      {
        skillId: 'GEO-MEASURE',
        title: 'Area of a circle',
        prompt: 'r = 5',
        steps: ['A = πr²', 'A = π(5²)', 'A = 25π square units'],
        rationale: 'Leaving the answer in terms of π is acceptable unless the question asks for a decimal.',
      },
    ],
  ),

  lessons(
    8,
    ['Coordinates', 'Distance', 'Midpoint', 'Gradient', 'Straight-line equation', 'Geometric reasoning'],
    [
      {
        skillId: 'AGT-COORD',
        title: 'Coordinates',
        body: 'A point (x, y) locates a position on the Cartesian plane. x increases to the right and y increases upwards.',
      },
      {
        skillId: 'AGT-DIST',
        title: 'Distance between two points',
        body: 'Find the horizontal change Δx and the vertical change Δy, then apply Pythagoras to the right triangle they form.',
      },
      {
        skillId: 'AGT-MID',
        title: 'Midpoint',
        body: 'Average the two x-coordinates and average the two y-coordinates. The midpoint is always halfway between the points.',
      },
      {
        skillId: 'AGT-GRAD',
        title: 'Gradient',
        body: 'Gradient is change in y divided by change in x. A horizontal line has gradient 0; a vertical line has undefined gradient because the change in x is zero.',
      },
      {
        skillId: 'AGT-LINE',
        title: 'Straight-line equation',
        body: 'Use y = mx + c. Once you know m, substitute a known point to solve for c.',
      },
      {
        skillId: 'AGT-REASON',
        title: 'Geometric reasoning',
        body: 'Equal gradients prove parallel lines. The perpendicular bisector of a segment passes through its midpoint and is perpendicular to the segment. State the property you are using, not just the arithmetic.',
      },
    ],
    [
      {
        skillId: 'AGT-DIST',
        title: 'Distance',
        prompt: 'A(0, 0) and B(3, 4)',
        steps: [
          'Δx = 3 − 0 = 3 and Δy = 4 − 0 = 4',
          'd = √(3² + 4²)',
          'd = √25 = 5',
        ],
        rationale: 'A 3-4-5 triangle is the classic check that your working is right.',
      },
      {
        skillId: 'AGT-MID',
        title: 'Midpoint',
        prompt: 'A(2, 6) and B(8, 10)',
        steps: [
          'M = ((2 + 8)/2, (6 + 10)/2)',
          'M = (10/2, 16/2)',
          'M = (5, 8)',
        ],
        rationale: 'The midpoint sits exactly halfway between 2 and 8, and between 6 and 10.',
      },
      {
        skillId: 'AGT-GRAD',
        title: 'Gradient',
        prompt: 'A(1, 2) and B(5, 10)',
        steps: [
          'm = (10 − 2)/(5 − 1)',
          'm = 8/4',
          'm = 2',
        ],
        rationale: 'Keep the subtraction in the same order in the numerator and denominator to avoid a sign error.',
      },
      {
        skillId: 'AGT-LINE',
        title: 'Equation of a line',
        prompt: 'Through (2, 5) with m = 2',
        steps: [
          'Substitute the point into y = mx + c.',
          '5 = 2(2) + c',
          '5 = 4 + c, so c = 1',
          'y = 2x + 1',
        ],
        rationale: 'Check the point: 2(2) + 1 = 5, so (2, 5) does lie on the line.',
      },
    ],
  ),
]

export default LESSONS_TERM2

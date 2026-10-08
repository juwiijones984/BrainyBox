import type { Concept, Lesson, WorkedExample } from '../types'
import { moduleMeta, moduleTopicId } from './modules'

/** The guide's standing "Working Space Checklist", repeated in every module. */
export const WORKING_SPACE_CHECKLIST = [
  'I wrote each step.',
  'I checked signs and units.',
  'I did not look at the memo first.',
]

/** The guide repeats this line under every worked example in the book. */
const RATIONALE_DEFAULT =
  'Check signs, exponents, units and labels before moving on.'

type ModuleInput = Omit<Lesson, 'subjectId' | 'checklist'>

/** Fills in the fields that are identical across every study-guide module. */
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

export const LESSONS_TERM1: Lesson[] = [
  lessons(
    1,
    ['Algebraic language', 'Like terms', 'Expansion', 'Products of binomials', 'Factorisation', 'Algebraic fractions'],
    [
      {
        skillId: 'ALG-LANG',
        title: 'Algebraic language',
        body: 'Terms, coefficients, constants and variables form the vocabulary of algebra. Terms are separated by + or − signs, and two terms are like terms only when their variable parts match exactly.',
      },
      {
        skillId: 'ALG-LIKE',
        title: 'Combining like terms',
        body: 'Add or subtract coefficients of like terms and leave unlike terms untouched. In 5x² + 3x − 2x² + 4x − 1 the x² terms combine, the x terms combine, and − 1 stands alone.',
      },
      {
        skillId: 'ALG-EXP',
        title: 'Expansion',
        body: 'The distributive law multiplies the outside factor by every term inside the bracket. Watch the sign on every term: multiplying by a negative outside factor flips every sign inside.',
      },
      {
        skillId: 'ALG-BINOM',
        title: 'Products of binomials',
        body: 'With two binomials, multiply every term in the first bracket by every term in the second. That gives four products, so expect four terms before you collect like terms.',
      },
      {
        skillId: 'ALG-FACT',
        title: 'Factorisation',
        body: 'Factorisation reverses expansion. Check for a highest common factor first, then look for a trinomial pattern, then a difference of squares. If no pattern fits, leave it as a trinomial rather than forcing it.',
      },
      {
        skillId: 'ALG-FRAC',
        title: 'Algebraic fractions',
        body: 'Only whole factors may be cancelled — never a term inside a sum. Factorise the numerator and denominator first, cancel matching factors, and always state the excluded values where the original denominator was zero.',
      },
    ],
    [
      {
        skillId: 'ALG-LIKE',
        title: 'Combine like terms',
        prompt: '5x² + 3x − 2x² + 4x − 1',
        steps: [
          'Group the x² terms and the x terms.',
          '(5x² − 2x²) + (3x + 4x) − 1',
          '3x² + 7x − 1',
        ],
        rationale: 'Like terms have the same variable part, so only the coefficients change. The constant − 1 never combines with anything.',
      },
      {
        skillId: 'ALG-EXP',
        title: 'Expand one bracket',
        prompt: '−3(2x − 5)',
        steps: [
          'Multiply 2x by −3: −6x',
          'Multiply −5 by −3: +15',
          '−6x + 15',
        ],
        rationale: 'The negative sign sits outside the bracket, so it flips both signs inside. Two negatives make a positive.',
      },
      {
        skillId: 'ALG-BINOM',
        title: 'Expand two brackets',
        prompt: '(2x + 3)(x − 4)',
        steps: [
          '2x × x = 2x²',
          '2x × (−4) = −8x',
          '3 × x = 3x',
          '3 × (−4) = −12',
          'Collect: 2x² − 8x + 3x − 12',
          '2x² − 5x − 12',
        ],
        rationale: 'Multiply every term in the first bracket by every term in the second, then collect the two x terms.',
      },
      {
        skillId: 'ALG-FACT',
        title: 'Factorise',
        prompt: '2x² + 7x + 3',
        steps: [
          'Split the middle term so the products add to 7x: x and 6x.',
          '2x² + x + 6x + 3',
          'Group: x(2x + 1) + 3(2x + 1)',
          'Both groups share (2x + 1).',
          '(2x + 1)(x + 3)',
        ],
        rationale: 'Check by expanding back: 2x² + 6x + x + 3 = 2x² + 7x + 3. It matches, so the factorisation is correct.',
      },
    ],
  ),

  lessons(
    2,
    ['Product law', 'Quotient law', 'Power law', 'Zero exponent', 'Negative exponent', 'Exponential equations'],
    [
      {
        skillId: 'EXP-PROD',
        title: 'Meaning of an exponent',
        body: 'In aⁿ, a is the base and n is the exponent. The exponent tells you how many times the base is used as a factor, so 5³ = 5 × 5 × 5.',
      },
      {
        skillId: 'EXP-QUOT',
        title: 'The three laws',
        body: 'Multiplying equal bases adds the exponents. Dividing equal bases subtracts them. Raising a power to a power multiplies them. Each law only works when the bases are the same.',
      },
      {
        skillId: 'EXP-POWER',
        title: 'Power law',
        body: 'In (aᵐ)ⁿ every factor in the bracket is raised to the power n, so the exponents multiply: (aᵐ)ⁿ = aᵐⁿ.',
      },
      {
        skillId: 'EXP-ZERO',
        title: 'Zero exponent',
        body: 'For any non-zero base, a⁰ = 1. This is the one result learners most often forget, so test it deliberately.',
      },
      {
        skillId: 'EXP-NEG',
        title: 'Negative exponents',
        body: 'A negative exponent means the reciprocal: a⁻ⁿ = 1/aⁿ. To write the answer with positive exponents, move the base to the denominator.',
      },
      {
        skillId: 'EXP-EQ',
        title: 'Exponential equations',
        body: 'Rewrite both sides with a common base, then equate the exponents. Always substitute your solution back into the original equation to check it.',
      },
    ],
    [
      {
        skillId: 'EXP-PROD',
        title: 'Product law',
        prompt: 'x³ × x⁵',
        steps: ['Bases are equal, so add the exponents.', 'x^(3 + 5)', 'x⁸'],
        rationale: 'Adding exponents is only valid because both bases are the same variable.',
      },
      {
        skillId: 'EXP-QUOT',
        title: 'Quotient law',
        prompt: 'a¹¹ ÷ a⁴',
        steps: ['Bases are equal, so subtract the exponents.', 'a^(11 − 4)', 'a⁷'],
        rationale: 'Division divides the powers, so the exponent on top is reduced by the one underneath.',
      },
      {
        skillId: 'EXP-NEG',
        title: 'Negative exponent',
        prompt: 'x⁻⁴',
        steps: ['A negative exponent means the reciprocal.', 'x⁻⁴ = 1/x⁴', '1/x⁴'],
        rationale: 'The base moves to the denominator and loses its sign. The base itself never changes sign.',
      },
      {
        skillId: 'EXP-EQ',
        title: 'Exponential equation',
        prompt: '8^(x − 1) = 4^(x + 1)',
        steps: [
          'Write both sides with base 2: 8 = 2³ and 4 = 2².',
          '2^(3x − 3) = 2^(2x + 2)',
          'Equal bases with equal values have equal exponents.',
          '3x − 3 = 2x + 2',
          'x = 5',
        ],
        rationale: 'Check: 8⁴ = 4096 and 4⁶ = 4096. Both sides agree, so x = 5 is correct.',
      },
    ],
  ),

  lessons(
    3,
    ['Recognise pattern', 'Common difference', 'General term', 'Term position', 'Reverse problems', 'Pattern reasoning'],
    [
      {
        skillId: 'PAT-RECOG',
        title: 'Sequences',
        body: 'A sequence is an ordered list. A linear sequence has a constant first difference; if the differences keep changing, the sequence is not linear and you should not force a linear rule on it.',
      },
      {
        skillId: 'PAT-DIFF',
        title: 'Common difference',
        body: 'The common difference d is the constant gap between consecutive terms. In 5, 8, 11, 14, … the difference is 3, and a difference of −4 is just as valid as a positive one.',
      },
      {
        skillId: 'PAT-GEN',
        title: 'General term',
        body: 'For a constant-difference sequence the general term is Tₙ = an + b, where the coefficient a equals the common difference and b is found by substituting the first term.',
      },
      {
        skillId: 'PAT-POS',
        title: 'Finding a term and a position',
        body: 'To find Tₙ, substitute the term number for n. To find which term a value is, set Tₙ equal to that value and solve for n — then check n is a positive whole number.',
      },
      {
        skillId: 'PAT-REV',
        title: 'Reverse problems',
        body: 'Some questions hand you a term and the difference instead of the sequence. Use the term to build the equation, solve for b, and write the full rule.',
      },
      {
        skillId: 'PAT-REASON',
        title: 'Pattern reasoning',
        body: 'Always justify why a sequence is or is not linear. Pointing at the first differences and showing they are not constant is a complete argument.',
      },
    ],
    [
      {
        skillId: 'PAT-GEN',
        title: 'Find the rule',
        prompt: '5, 8, 11, 14, …',
        steps: [
          'First differences are constant at 3, so d = 3.',
          'Start with 3n.',
          'T₁ = 5, so 3(1) + b = 5.',
          'b = 2',
          'Tₙ = 3n + 2',
        ],
        rationale: 'Test it: T₄ = 3(4) + 2 = 14, which matches the fourth term of the sequence.',
      },
      {
        skillId: 'PAT-POS',
        title: 'Find a term',
        prompt: 'Tₙ = 3n + 2, find T₂₀',
        steps: ['Substitute n = 20.', 'T₂₀ = 3(20) + 2', 'T₂₀ = 62'],
        rationale: 'Substituting straight into the rule is quicker and safer than extending the list by hand.',
      },
      {
        skillId: 'PAT-POS',
        title: 'Find a position',
        prompt: 'Tₙ = 4n + 1 and Tₙ = 61. Which term?',
        steps: ['Set the rule equal to the value.', '4n + 1 = 61', '4n = 60', 'n = 15'],
        rationale: 'The answer must be a positive whole number. 15 is, so the value really is the fifteenth term.',
      },
      {
        skillId: 'PAT-REV',
        title: 'Reverse information',
        prompt: 'T₄ = 17 and d = 5. Find the rule.',
        steps: [
          'With d = 5 the rule is Tₙ = 5n + b.',
          'Substitute T₄ = 17: 5(4) + b = 17',
          '20 + b = 17, so b = −3',
          'Tₙ = 5n − 3',
        ],
        rationale: 'Check T₄ = 5(4) − 3 = 17, which matches the information given.',
      },
    ],
  ),

  lessons(
    4,
    ['Linear equations', 'Brackets', 'Fractions', 'Quadratics', 'Simultaneous equations', 'Inequalities'],
    [
      {
        skillId: 'EQN-LIN',
        title: 'Linear equations',
        body: 'Keep the equation balanced: whatever operation you perform on one side must be performed on the other. Then undo the operations in reverse order to isolate the unknown.',
      },
      {
        skillId: 'EQN-BRACKET',
        title: 'Brackets',
        body: 'Expand the bracket before you do anything else, otherwise the bracket hides the sign changes you need.',
      },
      {
        skillId: 'EQN-FRAC',
        title: 'Fractions',
        body: 'When a variable sits in a denominator, multiply every term by the lowest common denominator of the whole equation, not just the term it appears in.',
      },
      {
        skillId: 'EQN-QUAD',
        title: 'Quadratics',
        body: 'Bring all terms to one side, factorise, then use the zero-product rule: if the product of two factors is zero, one of the factors must be zero.',
      },
      {
        skillId: 'EQN-SIM',
        title: 'Simultaneous equations',
        body: 'Two equations are solved together. Elimination multiplies the equations to match a variable; substitution replaces a variable with its expression from the other equation.',
      },
      {
        skillId: 'EQN-INEQ',
        title: 'Inequalities',
        body: 'Solve an inequality exactly like an equation, with one exception: when you multiply or divide by a negative number the sign reverses.',
      },
    ],
    [
      {
        skillId: 'EQN-LIN',
        title: 'Linear equation',
        prompt: '3x + 5 = 20',
        steps: ['Subtract 5 from both sides.', '3x = 15', 'Divide both sides by 3.', 'x = 5'],
        rationale: 'The equation stays balanced because the same operation is applied to both sides at every step.',
      },
      {
        skillId: 'EQN-BRACKET',
        title: 'Brackets',
        prompt: '2(x − 3) + 5 = 11',
        steps: [
          'Expand: 2x − 6 + 5 = 11',
          'Collect: 2x − 1 = 11',
          'Add 1: 2x = 12',
          'Divide by 2: x = 6',
        ],
        rationale: 'Expanding first exposes the −6 so it can be combined with the +5 before you isolate x.',
      },
      {
        skillId: 'EQN-QUAD',
        title: 'Quadratic',
        prompt: 'x² − 5x + 6 = 0',
        steps: [
          'All terms are already on one side.',
          'Factorise: two numbers multiplying to 6 and adding to −5.',
          '(x − 2)(x − 3) = 0',
          'Zero-product rule: x − 2 = 0 or x − 3 = 0',
          'x = 2 or x = 3',
        ],
        rationale: 'A quadratic normally has two solutions, so always list both rather than stopping at the first.',
      },
      {
        skillId: 'EQN-INEQ',
        title: 'Inequality',
        prompt: '−2x > 6',
        steps: [
          'Divide both sides by −2.',
          'Dividing by a negative reverses the sign.',
          'x < −3',
        ],
        rationale: 'Reversing the sign is the single most common error in inequalities. Check your answer by testing a value against the original.',
      },
    ],
  ),
]

export default LESSONS_TERM1

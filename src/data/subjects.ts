import type { Subject, SubjectId } from './types'

// ── Subjects ───────────────────────────────────────────────────────────────
// `capsComponents` is the honest bit: an app subject is a study grouping, not
// a CAPS subject. Social Sciences carries Geography and History, and Economic
// Sciences carries Accounting, Business Studies and Economics, and each of
// those has its own Programme of Assessment and its own cognitive weighting.
// Mathematics is listed but is deliberately not amended by the 2020 booklet.
export const SUBJECTS: Subject[] = [
  {
    id: 'mathematics',
    name: 'Mathematics',
    shortName: 'Maths',
    code: 'MATH',
    color: '#014E8C',
    pairing: 'Physical Sciences or Life Sciences',
    capsComponents: ['mathematics'],
    glyph: '∑',
  },
  {
    id: 'mathematical-literacy',
    name: 'Mathematical Literacy',
    shortName: 'Math Lit',
    code: 'MATL',
    color: '#8b5cf6',
    pairing: 'Any other FET subject',
    capsComponents: ['mathematical-literacy'],
    glyph: '%',
  },
  {
    id: 'physical-sciences',
    name: 'Physical Sciences',
    shortName: 'Phys Sci',
    code: 'PHSC',
    color: '#0ea5e9',
    pairing: 'Mathematics',
    capsComponents: ['physical-sciences'],
    glyph: '⚛',
  },
  {
    id: 'life-sciences',
    name: 'Life Sciences',
    shortName: 'Life Sci',
    code: 'LISC',
    color: '#047857',
    pairing: 'Mathematics',
    capsComponents: ['life-sciences'],
    glyph: '⚕',
  },
  {
    id: 'social-sciences',
    name: 'Social Sciences',
    shortName: 'Soc Sci',
    code: 'SOCS',
    color: '#B45309',
    pairing: 'Mathematical Literacy',
    capsComponents: ['geography', 'history'],
    glyph: '◎',
  },
  {
    id: 'economic-sciences',
    name: 'Economic Sciences',
    shortName: 'Econ Sci',
    code: 'ECON',
    color: '#ec4899',
    pairing: 'Mathematical Literacy',
    capsComponents: ['accounting', 'business-studies', 'economics'],
    glyph: '◈',
  },
]

export const SUBJECT_MAP: Record<SubjectId, Subject> = Object.fromEntries(
  SUBJECTS.map(s => [s.id, s]),
) as Record<SubjectId, Subject>

// ── Skill seeds ────────────────────────────────────────────────────────────
// A skill seed carries only what cannot be derived, and that is now just
// identity: an id, a name, and the topic it belongs to.
//
// Mastery is deliberately not seedable. Every field that used to be here —
// `baseline`, `current`, `attempts`, `correct`, `trend`, `lastPracticed` — was
// either a literal invented for the demo or a hash of the skill's own id, so it
// described no real learning. The optionality was the giveaway: any skill
// without a hand-authored number silently got a fabricated one. Mastery is now
// per-learner evidence in Firestore (`learners/{uid}/mastery/{skillId}`) and a
// skill nobody has attempted has no mastery at all.
interface SkillSeed {
  id: string
  name: string
  topic: string
}

interface SubjectSeed {
  /** Topic name → CAPS term. */
  terms: Record<string, number>
  /**
   * Topic name → how the study guide labels that placement, e.g. "Terms 1–2".
   * Topics without an entry fall back to `Term ${terms[name]}`.
   */
  termLabels?: Record<string, string>
  skills: SkillSeed[]
}

// ── Mathematics ────────────────────────────────────────────────────────────
// The eleven modules and sixty-six skills below are taken from the BrainyBox
// Grade 10 Mathematics Study Guide. Module numbers and skill names match the
// guide so a learner reading the guide and the app sees the same vocabulary.
const MATHEMATICS: SubjectSeed = {
  terms: {
    'Algebraic Expressions': 1,
    Exponents: 1,
    'Number Patterns': 1,
    'Equations and Inequalities': 1,
    Trigonometry: 1,
    'Functions and Graphs': 2,
    'Euclidean Geometry and Measurement': 2,
    'Analytical Geometry': 3,
    'Finance and Growth': 3,
    Statistics: 3,
    Probability: 3,
  },
  termLabels: {
    Trigonometry: 'Terms 1–2',
    'Euclidean Geometry and Measurement': 'Terms 2–3',
    Probability: 'Terms 3–4',
  },
  skills: [
    // Module 1 — Algebraic Expressions
    { id: 'ALG-LANG',  name: 'Algebraic language',       topic: 'Algebraic Expressions' },
    { id: 'ALG-LIKE',  name: 'Like terms',               topic: 'Algebraic Expressions' },
    { id: 'ALG-EXP',   name: 'Expansion',                topic: 'Algebraic Expressions' },
    { id: 'ALG-BINOM', name: 'Products of binomials',    topic: 'Algebraic Expressions' },
    { id: 'ALG-FACT',  name: 'Factorisation',            topic: 'Algebraic Expressions' },
    { id: 'ALG-FRAC',  name: 'Algebraic fractions',      topic: 'Algebraic Expressions' },

    // Module 2 — Exponents
    { id: 'EXP-PROD',   name: 'Product law',             topic: 'Exponents' },
    { id: 'EXP-QUOT',   name: 'Quotient law',            topic: 'Exponents' },
    { id: 'EXP-POWER',  name: 'Power law',               topic: 'Exponents' },
    { id: 'EXP-ZERO',   name: 'Zero exponent',           topic: 'Exponents' },
    { id: 'EXP-NEG',    name: 'Negative exponent',       topic: 'Exponents' },
    { id: 'EXP-EQ',     name: 'Exponential equations',   topic: 'Exponents' },

    // Module 3 — Number Patterns
    { id: 'PAT-RECOG',   name: 'Recognise pattern',      topic: 'Number Patterns' },
    { id: 'PAT-DIFF',    name: 'Common difference',      topic: 'Number Patterns' },
    { id: 'PAT-GEN',     name: 'General term',           topic: 'Number Patterns' },
    { id: 'PAT-POS',     name: 'Term position',          topic: 'Number Patterns' },
    { id: 'PAT-REV',     name: 'Reverse problems',       topic: 'Number Patterns' },
    { id: 'PAT-REASON',  name: 'Pattern reasoning',      topic: 'Number Patterns' },

    // Module 4 — Equations and Inequalities
    { id: 'EQN-LIN',     name: 'Linear equations',         topic: 'Equations and Inequalities' },
    { id: 'EQN-BRACKET', name: 'Brackets',                topic: 'Equations and Inequalities' },
    { id: 'EQN-FRAC',    name: 'Fractions',               topic: 'Equations and Inequalities' },
    { id: 'EQN-QUAD',    name: 'Quadratics',              topic: 'Equations and Inequalities' },
    { id: 'EQN-SIM',     name: 'Simultaneous equations',  topic: 'Equations and Inequalities' },
    { id: 'EQN-INEQ',    name: 'Inequalities',            topic: 'Equations and Inequalities' },

    // Module 5 — Trigonometry (the learner's weakest module)
    { id: 'TRG-LABEL',  name: 'Triangle labels',          topic: 'Trigonometry' },
    { id: 'TRG-SOHCAHTOA', name: 'SOHCAHTOA',             topic: 'Trigonometry' },
    { id: 'TRG-SIDE',   name: 'Missing sides',            topic: 'Trigonometry' },
    { id: 'TRG-ANGLE',  name: 'Missing angles',           topic: 'Trigonometry' },
    { id: 'TRG-SPECIAL', name: 'Special angles',         topic: 'Trigonometry' },
    { id: 'TRG-APP',    name: 'Applications',             topic: 'Trigonometry' },

    // Module 6 — Functions and Graphs
    { id: 'FUN-LANG',  name: 'Function language',   topic: 'Functions and Graphs' },
    { id: 'FUN-LIN',   name: 'Linear graphs',       topic: 'Functions and Graphs' },
    { id: 'FUN-PARA',  name: 'Parabolas',           topic: 'Functions and Graphs' },
    { id: 'FUN-HYP',   name: 'Hyperbolas',          topic: 'Functions and Graphs' },
    { id: 'FUN-EXP',   name: 'Exponential graphs',  topic: 'Functions and Graphs' },
    { id: 'FUN-INT',   name: 'Intercepts',          topic: 'Functions and Graphs' },

    // Module 7 — Euclidean Geometry and Measurement
    { id: 'GEO-ANGLES',    name: 'Angle facts',   topic: 'Euclidean Geometry and Measurement' },
    { id: 'GEO-PARALLEL',  name: 'Parallel lines', topic: 'Euclidean Geometry and Measurement' },
    { id: 'GEO-TRIANGLE',  name: 'Triangles',     topic: 'Euclidean Geometry and Measurement' },
    { id: 'GEO-QUAD',      name: 'Quadrilaterals', topic: 'Euclidean Geometry and Measurement' },
    { id: 'GEO-PYTH',      name: 'Pythagoras',    topic: 'Euclidean Geometry and Measurement' },
    { id: 'GEO-MEASURE',   name: 'Measurement',   topic: 'Euclidean Geometry and Measurement' },

    // Module 8 — Analytical Geometry
    { id: 'AGT-COORD',  name: 'Coordinates',           topic: 'Analytical Geometry' },
    { id: 'AGT-DIST',   name: 'Distance',              topic: 'Analytical Geometry' },
    { id: 'AGT-MID',    name: 'Midpoint',              topic: 'Analytical Geometry' },
    { id: 'AGT-GRAD',   name: 'Gradient',              topic: 'Analytical Geometry' },
    { id: 'AGT-LINE',   name: 'Straight-line equation', topic: 'Analytical Geometry' },
    { id: 'AGT-REASON', name: 'Geometric reasoning',  topic: 'Analytical Geometry' },

    // Module 9 — Finance and Growth
    { id: 'FIN-PERC',     name: 'Percentages',         topic: 'Finance and Growth' },
    { id: 'FIN-SIMPLE',   name: 'Simple growth',       topic: 'Finance and Growth' },
    { id: 'FIN-COMPOUND', name: 'Compound growth',     topic: 'Finance and Growth' },
    { id: 'FIN-DEPREC',   name: 'Depreciation',        topic: 'Finance and Growth' },
    { id: 'FIN-INFL',     name: 'Inflation',           topic: 'Finance and Growth' },
    { id: 'FIN-REASON',   name: 'Financial reasoning', topic: 'Finance and Growth' },

    // Module 10 — Statistics
    { id: 'STA-DATA',    name: 'Data',            topic: 'Statistics' },
    { id: 'STA-MEAN',    name: 'Mean',            topic: 'Statistics' },
    { id: 'STA-MEDIAN',  name: 'Median and mode', topic: 'Statistics' },
    { id: 'STA-RANGE',   name: 'Range',           topic: 'Statistics' },
    { id: 'STA-QUART',   name: 'Quartiles',       topic: 'Statistics' },
    { id: 'STA-DISPLAY', name: 'Data displays',   topic: 'Statistics' },

    // Module 11 — Probability
    { id: 'PRB-SCALE',   name: 'Probability scale',      topic: 'Probability' },
    { id: 'PRB-SPACE',   name: 'Sample spaces',          topic: 'Probability' },
    { id: 'PRB-THEO',    name: 'Theoretical probability', topic: 'Probability' },
    { id: 'PRB-COMP',    name: 'Complement',             topic: 'Probability' },
    { id: 'PRB-COMBINED', name: 'Combined events',       topic: 'Probability' },
    { id: 'PRB-REASON',  name: 'Reasoning',              topic: 'Probability' },
  ],
}

// ── Mathematical Literacy ──────────────────────────────────────────────────
const MATHEMATICAL_LITERACY: SubjectSeed = {
  terms: {
    Number: 1,
    'Financial Management': 2,
    'Measurements in Daily Life': 1,
    'Scale and Drawing': 3,
    'Calculations in an Everyday Context': 2,
    'Data and Probability': 1,
    'Probability Models': 2,
    'Pythagoras and Trigonometry': 3,
    'Maps and Bearings': 3,
  },
  skills: [
    { id: 'ML-NUM-PAT', name: 'Number Patterns',                    topic: 'Number' },
    { id: 'ML-NUM-RAT', name: 'Rational Numbers & Place Value',     topic: 'Number' },
    { id: 'ML-NUM-INT', name: 'Integers & Number Operations',       topic: 'Number' },
    { id: 'ML-NUM-EXP', name: 'Exponents in Context',               topic: 'Number' },
    { id: 'ML-FIN-LIT', name: 'Financial Literacy',                 topic: 'Financial Management' },
    { id: 'ML-FIN-INT', name: 'Simple & Compound Interest',         topic: 'Financial Management' },
    { id: 'ML-FIN-BUD', name: 'Budgeting & Financial Planning',     topic: 'Financial Management' },
    { id: 'ML-MEAS-UNIT', name: 'Standard Units & Conversions',      topic: 'Measurements in Daily Life' },
    { id: 'ML-MEAS-AREA', name: 'Perimeter, Area & Volume',          topic: 'Measurements in Daily Life' },
    { id: 'ML-SCL-RATIO', name: 'Scale & Ratio',                      topic: 'Scale and Drawing' },
    { id: 'ML-SCL-DRAW', name: 'Scale Drawings',                     topic: 'Scale and Drawing' },
    { id: 'ML-EVR-RATIO', name: 'Ratio & Proportion',                 topic: 'Calculations in an Everyday Context' },
    { id: 'ML-EVR-RATE',  name: 'Rate & Unit Rate',                  topic: 'Calculations in an Everyday Context' },
    { id: 'ML-EVR-PCT',   name: 'Percentage Increase & Decrease',    topic: 'Calculations in an Everyday Context' },
    { id: 'ML-EVR-VAT',   name: 'VAT, Discounts & Taxation',         topic: 'Calculations in an Everyday Context' },
    { id: 'ML-DAT-STAT',  name: 'Statistical Graphs & Summaries',    topic: 'Data and Probability' },
    { id: 'ML-DAT-PROB',  name: 'Probability of Events',             topic: 'Data and Probability' },
    { id: 'ML-PRB-IND',   name: 'Independent Events',                topic: 'Probability Models' },
    { id: 'ML-PRB-TREE',  name: 'Tree Diagrams',                     topic: 'Probability Models' },
    { id: 'ML-PRB-COMB',  name: 'Combinations & Plans',              topic: 'Probability Models' },
    { id: 'ML-PYT-THM',   name: 'Pythagoras Theorem',                 topic: 'Pythagoras and Trigonometry' },
    { id: 'ML-PYT-TRIG',  name: 'Trigonometric Ratios',              topic: 'Pythagoras and Trigonometry' },
    { id: 'ML-MAP-BEAR',  name: 'Bearings & Compass Directions',     topic: 'Maps and Bearings' },
    { id: 'ML-MAP-GIS',   name: 'Map Scale & Interpretations',       topic: 'Maps and Bearings' },
  ],
}

// ── Physical Sciences ──────────────────────────────────────────────────────
const PHYSICAL_SCIENCES: SubjectSeed = {
  terms: {
    'Matter and Materials': 1,
    'Chemical Reactions': 2,
    'Acids and Bases': 2,
    'Quantitative Chemistry': 3,
    'Organic Chemistry': 3,
    'Electrochemistry': 4,
    Motion: 1,
    Forces: 2,
    Energy: 2,
    'Electricity and Magnetism': 3,
    Waves: 3,
    Sound: 3,
    Light: 4,
    Thermodynamics: 4,
    Machines: 4,
  },
  skills: [
    { id: 'PS-CH-MAT',   name: 'Classification of Matter',           topic: 'Matter and Materials' },
    { id: 'PS-CH-ATOM',  name: 'Atomic Structure & Periodic Table',  topic: 'Matter and Materials' },
    { id: 'PS-CH-BOND',  name: 'Chemical Bonding',                   topic: 'Matter and Materials' },
    { id: 'PS-CH-MIX',   name: 'Mixtures & Separation',              topic: 'Matter and Materials' },
    { id: 'PS-RXN-TYPE', name: 'Types of Chemical Reactions',        topic: 'Chemical Reactions' },
    { id: 'PS-RXN-BAL',  name: 'Balancing Equations',               topic: 'Chemical Reactions' },
    { id: 'PS-RXN-RATE', name: 'Reaction Rates & Catalysts',        topic: 'Chemical Reactions' },
    { id: 'PS-AB-DEF',   name: 'Acids, Bases & pH',                 topic: 'Acids and Bases' },
    { id: 'PS-AB-NEU',   name: 'Neutralisation & Titration',         topic: 'Acids and Bases' },
    { id: 'PS-QC-MOL',   name: 'The Mole Concept',                   topic: 'Quantitative Chemistry' },
    { id: 'PS-QC-STOICH',name: 'Stoichiometry',                      topic: 'Quantitative Chemistry' },
    { id: 'PS-QC-CONC',  name: 'Concentration & Dilution',          topic: 'Quantitative Chemistry' },
    { id: 'PS-ORG-STR',  name: 'Organic Structures & Functional Groups', topic: 'Organic Chemistry' },
    { id: 'PS-ORG-CHEM', name: 'Organic Reaction Types',             topic: 'Organic Chemistry' },
    { id: 'PS-ORG-POLY', name: 'Polymers',                           topic: 'Organic Chemistry' },
    { id: 'PS-EC-CELL',  name: 'Galvanic Cells & Electrodes',        topic: 'Electrochemistry' },
    { id: 'PS-EC-ELEC',  name: 'Electrolytic Cells',                 topic: 'Electrochemistry' },
    { id: 'PS-PHY-VEL',  name: 'Velocity & Acceleration',            topic: 'Motion' },
    { id: 'PS-PHY-MOT',  name: 'Motion Graphs',                      topic: 'Motion' },
    { id: 'PS-PHY-PROJ', name: 'Projectile Motion',                  topic: 'Motion' },
    { id: 'PS-FOR-NL',   name: "Newton's Laws",                      topic: 'Forces' },
    { id: 'PS-FOR-FRIC', name: 'Friction & Equilibrium',             topic: 'Forces' },
    { id: 'PS-FOR-GRAV', name: 'Gravitational Force & Weight',       topic: 'Forces' },
    { id: 'PS-ENE-DEF',  name: 'Work & Energy',                      topic: 'Energy' },
    { id: 'PS-ENE-POT',  name: 'Kinetic & Potential Energy',         topic: 'Energy' },
    { id: 'PS-ENE-CONS', name: 'Conservation of Energy',             topic: 'Energy' },
    { id: 'PS-ENE-PWR',  name: 'Power',                              topic: 'Energy' },
    { id: 'PS-ELM-OHM',  name: "Ohm's Law & Resistance",             topic: 'Electricity and Magnetism' },
    { id: 'PS-ELM-CIRC', name: 'Series & Parallel Circuits',         topic: 'Electricity and Magnetism' },
    { id: 'PS-ELM-MAG',  name: 'Magnetic Fields & Electromagnetism', topic: 'Electricity and Magnetism' },
    { id: 'PS-ELM-EMF',  name: 'EMF & Current',                      topic: 'Electricity and Magnetism' },
    { id: 'PS-WAV-PROP', name: 'Wave Properties',                    topic: 'Waves' },
    { id: 'PS-WAV-EM',   name: 'Electromagnetic Spectrum',           topic: 'Waves' },
    { id: 'PS-SND-PROP', name: 'Sound as a Wave',                    topic: 'Sound' },
    { id: 'PS-SND-HEAR', name: 'Hearing & Ultrasound',               topic: 'Sound' },
    { id: 'PS-LGT-REF',  name: 'Refraction & Lenses',                topic: 'Light' },
    { id: 'PS-LGT-REFL', name: 'Reflection & Mirrors',               topic: 'Light' },
    { id: 'PS-THM-HEAT', name: 'Thermal Energy & Specific Heat',     topic: 'Thermodynamics' },
    { id: 'PS-THM-GAS',  name: 'Gas Laws',                           topic: 'Thermodynamics' },
    { id: 'PS-MAC-LEVER',name: 'Machines & Levers',                  topic: 'Machines' },
    { id: 'PS-MAC-IMA',  name: 'Mechanical Advantage & MA',           topic: 'Machines' },
  ],
}

// ── Life Sciences ──────────────────────────────────────────────────────────
const LIFE_SCIENCES: SubjectSeed = {
  terms: {
    'Cellular Organisation': 1,
    Biosphere: 1,
    'Environmental Issues': 2,
    'Diversity of Life': 2,
    'Systematic and Fossil Study': 2,
    'Functional Systems': 2,
    'Human Physiology': 3,
    'Human Reproduction': 3,
    'Human Evolution': 4,
    'Population Dynamics': 4,
  },
  skills: [
    { id: 'LS-CELL-ORG',  name: 'Cell Structure & Organisation',   topic: 'Cellular Organisation' },
    { id: 'LS-CELL-MICR', name: 'Microscope Techniques',           topic: 'Cellular Organisation' },
    { id: 'LS-CELL-FUNC', name: 'Cell Functions & Membranes',      topic: 'Cellular Organisation' },
    { id: 'LS-BIO-BIO',   name: 'Biological Molecules',            topic: 'Cellular Organisation' },
    { id: 'LS-BIO-BIOS',  name: 'The Biosphere',                   topic: 'Biosphere' },
    { id: 'LS-BIO-ECOL',  name: 'Ecology & Ecosystems',            topic: 'Biosphere' },
    { id: 'LS-ENV-CLIM',  name: 'Climate Change',                  topic: 'Environmental Issues' },
    { id: 'LS-ENV-POLL',  name: 'Pollution & Human Impact',        topic: 'Environmental Issues' },
    { id: 'LS-DIV-BIO',   name: 'Biodiversity & Classification',   topic: 'Diversity of Life' },
    { id: 'LS-DIV-KING',  name: 'The Five Kingdoms',               topic: 'Diversity of Life' },
    { id: 'LS-DIV-PLANT', name: 'Plant Diversity',                 topic: 'Diversity of Life' },
    { id: 'LS-SYS-BINOM', name: 'Binomial Nomenclature',           topic: 'Systematic and Fossil Study' },
    { id: 'LS-SYS-FOSS',  name: 'Fossils & Evolution Evidence',    topic: 'Systematic and Fossil Study' },
    { id: 'LS-FUN-CELL',  name: 'Cellular Respiration',            topic: 'Functional Systems' },
    { id: 'LS-FUN-PHOTO', name: 'Photosynthesis',                  topic: 'Functional Systems' },
    { id: 'LS-FUN-TRANS', name: 'Transport in Plants & Animals',  topic: 'Functional Systems' },
    { id: 'LS-PHY-DIG',   name: 'The Digestive System',            topic: 'Human Physiology' },
    { id: 'LS-PHY-CIRC',  name: 'The Circulatory System',          topic: 'Human Physiology' },
    { id: 'LS-PHY-RESP',  name: 'The Respiratory System',          topic: 'Human Physiology' },
    { id: 'LS-PHY-EXCR',  name: 'Excretion & Osmoregulation',      topic: 'Human Physiology' },
    { id: 'LS-PHY-NERV',  name: 'The Nervous System',              topic: 'Human Physiology' },
    { id: 'LS-PHY-ENDO',  name: 'Endocrine System & Hormones',     topic: 'Human Physiology' },
    { id: 'LS-REP-MALE',  name: 'Male Reproductive System',        topic: 'Human Reproduction' },
    { id: 'LS-REP-FEM',   name: 'Female Reproductive System',      topic: 'Human Reproduction' },
    { id: 'LS-REP-FOET',  name: 'Embryology & Pregnancy',         topic: 'Human Reproduction' },
    { id: 'LS-REP-STIS',  name: 'Sexually Transmitted Infections', topic: 'Human Reproduction' },
    { id: 'LS-EVO-MECH',  name: 'Mechanisms of Evolution',         topic: 'Human Evolution' },
    { id: 'LS-EVO-HOMI',  name: 'Human Evolution & Classification', topic: 'Human Evolution' },
    { id: 'LS-POP-SIZE',  name: 'Population Size & Growth',        topic: 'Population Dynamics' },
    { id: 'LS-POP-DENS',  name: 'Population Distribution',         topic: 'Population Dynamics' },
  ],
}

// ── Social Sciences ────────────────────────────────────────────────────────
const SOCIAL_SCIENCES: SubjectSeed = {
  terms: {
    Atmosphere: 1,
    Hydrosphere: 1,
    Lithosphere: 2,
    'Human Geography': 3,
    Cartography: 2,
    'World History 1800–1914': 1,
    'South Africa 1900–1945': 2,
    'World War II & After': 3,
    'Apartheid & Resistance': 4,
  },
  skills: [
    { id: 'SS-GEO-ATMO',   name: 'Atmospheric Circulation & Winds',   topic: 'Atmosphere' },
    { id: 'SS-GEO-CLIM',   name: 'Climate & Biomes',                   topic: 'Atmosphere' },
    { id: 'SS-GEO-OX',     name: 'Ocean Currents & Salinity',          topic: 'Atmosphere' },
    { id: 'SS-GEO-HYD',    name: 'Hydrosphere & Water Resources',      topic: 'Hydrosphere' },
    { id: 'SS-GEO-FLOOD',  name: 'Flooding & Water Management',        topic: 'Hydrosphere' },
    { id: 'SS-GEO-LITH',   name: 'Rocks, Minerals & Plate Tectonics',  topic: 'Lithosphere' },
    { id: 'SS-GEO-SOIL',   name: 'Soil Formation & Land Use',          topic: 'Lithosphere' },
    { id: 'SS-GEO-FIG',    name: 'Geomorphology & Fold/Mountain Types', topic: 'Lithosphere' },
    { id: 'SS-HG-URB',     name: 'Urban Settlements & Growth',         topic: 'Human Geography' },
    { id: 'SS-HG-POP',     name: 'Population Distribution & Migration', topic: 'Human Geography' },
    { id: 'SS-HG-ECON',    name: 'Economic Geography & Trade',        topic: 'Human Geography' },
    { id: 'SS-CAR-MAP',    name: 'Map Skills & Atlas Interpretation',  topic: 'Cartography' },
    { id: 'SS-CAR-GIS',    name: 'GIS & Remote Sensing',               topic: 'Cartography' },
    { id: 'SS-HIS-IMP',    name: 'Industrial Revolution & Imperialism', topic: 'World History 1800–1914' },
    { id: 'SS-HIS-SRC',    name: 'Sources & Source Evaluation',        topic: 'World History 1800–1914' },
    { id: 'SS-HIS-SAX',    name: 'South Africa 1910–1945',             topic: 'South Africa 1900–1945' },
    { id: 'SS-HIS-GOLD',   name: 'The Gold Rush & African Migrant Labour', topic: 'South Africa 1900–1945' },
    { id: 'SS-HIS-HER',    name: 'Heritage & Heritage Sites',          topic: 'South Africa 1900–1945' },
    { id: 'SS-HIS-WWII',   name: 'World War II Causes & Course',       topic: 'World War II & After' },
    { id: 'SS-HIS-COLD',   name: 'The Cold War',                       topic: 'World War II & After' },
    { id: 'SS-HIS-UNLOC',  name: 'Decolonisation & UN',                topic: 'World War II & After' },
    { id: 'SS-HIS-APP',    name: 'Apartheid Legislation & Resistance', topic: 'Apartheid & Resistance' },
    { id: 'SS-HIS-1994',   name: '1994 & the Democratic Transition',   topic: 'Apartheid & Resistance' },
  ],
}

// ── Economic Sciences ──────────────────────────────────────────────────────
const ECONOMIC_SCIENCES: SubjectSeed = {
  terms: {
    'Introduction to Economics': 1,
    'Economic Systems': 1,
    Markets: 2,
    'Economic Sectors': 2,
    'Prices & Price Determination': 3,
    Macroeconomics: 3,
    'Public Sector': 4,
    'International Economics': 4,
    'Introduction to Business': 1,
    'Business Environments': 2,
    'Business Operations': 2,
    Entrepreneurship: 3,
    'Financial Management': 3,
    Marketing: 4,
    Management: 4,
  },
  skills: [
    { id: 'EC-ECO-INTRO', name: 'Basic Economic Concepts',      topic: 'Introduction to Economics' },
    { id: 'EC-ECO-SYS',   name: 'Economic Systems',             topic: 'Economic Systems' },
    { id: 'EC-ECO-CYCLE', name: 'Circular Flow & Factor Markets', topic: 'Economic Sectors' },
    { id: 'EC-ECO-SECT',  name: 'Primary, Secondary & Tertiary', topic: 'Economic Sectors' },
    { id: 'EC-MKT-DEM',   name: 'Demand & Supply',              topic: 'Markets' },
    { id: 'EC-MKT-ELAS',  name: 'Price Elasticity',             topic: 'Markets' },
    { id: 'EC-MKT-MARKET',name: 'Market Structures & Competition', topic: 'Markets' },
    { id: 'EC-PRC-PRICE', name: 'Price Determination',         topic: 'Prices & Price Determination' },
    { id: 'EC-PRC-MONEY', name: 'Money & Inflation',           topic: 'Prices & Price Determination' },
    { id: 'EC-MAC-GDP',   name: 'GDP & Economic Indicators',    topic: 'Macroeconomics' },
    { id: 'EC-MAC-ECON',  name: 'Economic Growth & Development', topic: 'Macroeconomics' },
    { id: 'EC-MAC-UNEMP', name: 'Unemployment & Labour Markets', topic: 'Macroeconomics' },
    { id: 'EC-PUB-GOV',   name: 'Government & Public Finance',  topic: 'Public Sector' },
    { id: 'EC-PUB-TAX',   name: 'Taxation & Fiscal Policy',     topic: 'Public Sector' },
    { id: 'EC-INT-TRADE', name: 'International Trade',         topic: 'International Economics' },
    { id: 'EC-INT-EXCH',  name: 'Exchange Rates',              topic: 'International Economics' },
    { id: 'EC-BUS-INTRO', name: 'Business Sectors & Ownership', topic: 'Introduction to Business' },
    { id: 'EC-BUS-ENV',   name: 'Business Environments',       topic: 'Business Environments' },
    { id: 'EC-BUS-OPS',   name: 'Business Operations & Production', topic: 'Business Operations' },
    { id: 'EC-BUS-ENTRE', name: 'Entrepreneurship & Business Plans', topic: 'Entrepreneurship' },
    { id: 'EC-BUS-FIN',   name: 'Financial Management',        topic: 'Financial Management' },
    { id: 'EC-BUS-STAFF', name: 'Human Resource Management',   topic: 'Management' },
    { id: 'EC-BUS-MKT',   name: 'Marketing & The Marketing Mix', topic: 'Marketing' },
    { id: 'EC-BUS-MGMT',  name: 'Management Functions & Leadership', topic: 'Management' },
  ],
}

export const CURRICULUM: Record<SubjectId, SubjectSeed> = {
  mathematics: MATHEMATICS,
  'mathematical-literacy': MATHEMATICAL_LITERACY,
  'physical-sciences': PHYSICAL_SCIENCES,
  'life-sciences': LIFE_SCIENCES,
  'social-sciences': SOCIAL_SCIENCES,
  'economic-sciences': ECONOMIC_SCIENCES,
}

// This file is curriculum only.
//
// There is no learner here, no class roster and no revision plan. Those used to
// be hardcoded — a fixed learner with a seven-day streak, twelve invented
// classmates with invented scores and weak topics, and eight revision items on
// fixed September dates — so every teacher and parent screen was populated with
// learners who do not exist.
//
// A learner's identity and progress now come from `users/{uid}` and
// `learners/{uid}/mastery/{skillId}`; class membership from real enrolment
// documents; and the revision plan is generated from assessed mastery in
// `lib/revision.ts`. See `lib/roster.ts` for the class aggregation.

import { useMemo, useState } from 'react'
import {
  CAPS_AMENDMENTS, CAPS_POLICIES, GRADE10_STANDARD_IDS, MATHEMATICS_LEARNING_OUTCOMES,
  MATHEMATICS_MODULE_STANDARDS, MATHEMATICS_NCS, MATHEMATICS_PROMOTION_STATEMENT,
  NCS_ACHIEVEMENT_SCALE, PENDING_VERBATIM_STANDARDS, SUBJECT_MAP, capsFinalMarks, capsPolicyFor,
  capsSbaWeightTotal, capsTaskMarks, crossGradeSkills,
  type CapsSubjectPolicy, type CapsWeighting,
} from '@/data'
import { useAppStore } from '@/store/AppStore'
import { Card, Divider, EmptyState, Pill, SectionLabel, Segmented, StatTile } from '@/components/ui'

/** Renders a CAPS percentage split as a bar plus its labels. */
function WeightingBar({ items, accent }: { items: CapsWeighting[]; accent: string }) {
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden bg-tint-strong" role="img"
        aria-label={items.map(i => `${i.label} ${i.pct}%`).join(', ')}>
        {items.map((item, i) => (
          <span
            key={item.label}
            style={{ width: `${item.pct}%`, background: accent, opacity: 0.35 + (i % 3) * 0.3 }}
          />
        ))}
      </div>
      <ul className="mt-2 space-y-1">
        {items.map(item => (
          <li key={item.label} className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-ink-70">{item.label}</span>
            <span className="font-mono-data text-ink-80 shrink-0">
              {item.pct}%{item.tolerance ? ` ±${item.tolerance}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Mathematics is the one subject with no Programme of Assessment in the data,
 * because the document that supplies its curriculum does not contain one. So
 * this panel shows what the NCS *does* give — the outcomes, the standards, the
 * official scale — and states plainly what is still missing. A learner should
 * not have to guess why Mathematics looks different from the other subjects.
 */
function NcsMathematicsPanel() {
  const uncovered = GRADE10_STANDARD_IDS.filter(
    id => !MATHEMATICS_MODULE_STANDARDS.some(m => m.standards.includes(id)),
  )
  const crossGrade = crossGradeSkills()

  return (
    <div className="space-y-4 rounded-lg bg-tint-strong border border-line p-4">
      <div>
        <SectionLabel className="!mb-1">Learning Outcomes</SectionLabel>
        <ul className="space-y-1.5">
          {MATHEMATICS_LEARNING_OUTCOMES.map(lo => (
            <li key={lo.number} className="flex items-baseline gap-2 text-xs">
              <span className="font-mono-data text-ink-60 shrink-0">LO{lo.number}</span>
              <span className="text-ink-80 flex-1">{lo.title}</span>
              <span className="font-mono-data text-ink-60 shrink-0">
                {lo.standards.length} std
              </span>
            </li>
          ))}
        </ul>
        <p className="text-ink-60 text-xs mt-2 font-mono-data">
          {GRADE10_STANDARD_IDS.length} Grade 10 Assessment Standards
        </p>
      </div>

      <Divider />

      <div>
        <SectionLabel className="!mb-1">Official achievement scale</SectionLabel>
        <ul className="space-y-1">
          {[...NCS_ACHIEVEMENT_SCALE].reverse().map(b => (
            <li key={b.level} className="flex items-baseline gap-2 text-xs">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: b.color }}
                aria-hidden="true"
              />
              <span className="font-mono-data text-ink-60 w-8 shrink-0">L{b.level}</span>
              <span className="text-ink-80 flex-1">{b.label}</span>
              <span className="font-mono-data text-ink-60 shrink-0">
                {b.minPct}–{b.maxPct}%
              </span>
            </li>
          ))}
        </ul>
        <p className="text-ink-60 text-xs mt-2 leading-relaxed">
          This is the scale a result is reported on. The Marks Map in the app uses four bands instead,
          and the two are not interchangeable — 55% is Weak on the Marks Map and Satisfactory (L4) here.
        </p>
      </div>

      <Divider />

      <div>
        <SectionLabel className="!mb-1">Standard coverage</SectionLabel>
        <p className="text-ink-70 text-xs leading-relaxed">
          {GRADE10_STANDARD_IDS.length - uncovered.length} of {GRADE10_STANDARD_IDS.length} standards are
          traced to a study-guide module. Not covered: {uncovered.join(', ')} — three integrative standards
          that cut across modules, and two the eleven-module guide has no home for.
        </p>
      </div>

      {crossGrade.length > 0 && (
        <div>
          <SectionLabel className="!mb-1">Taught beyond Grade 10</SectionLabel>
          <ul className="space-y-1.5">
            {crossGrade.map(c => (
              <li key={c.skillId} className="text-xs leading-relaxed">
                <span className="font-mono-data text-ember/80">{c.skillId}</span>
                <span className="text-ink-70"> — Grade {c.grade} content, kept as revision. Not counted as{' '}
                Grade 10 coverage.</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Divider />

      <div>
        <SectionLabel className="!mb-1">Still missing</SectionLabel>
        <p className="text-ink-70 text-xs leading-relaxed">{MATHEMATICS_NCS.standing}</p>
        <p className="text-ink-70 text-xs mt-2 leading-relaxed">{MATHEMATICS_PROMOTION_STATEMENT}</p>
        <p className="text-ink-60 text-xs mt-2 font-mono-data">
          standards awaiting verbatim text: {PENDING_VERBATIM_STANDARDS.join(', ')}
        </p>
      </div>
    </div>
  )
}

function PolicyCard({ policy, accent }: { policy: CapsSubjectPolicy; accent: string }) {
  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display font-bold text-ink">{policy.name}</h3>
          <p className="text-ink-60 text-xs font-mono-data mt-0.5">
            Grade {policy.grade} · {policy.section}
          </p>
        </div>
        <Pill color={accent}>{policy.status === 'amended' ? 'Amended' : 'Not amended'}</Pill>
      </div>

      {policy.id === 'mathematics' && <NcsMathematicsPanel />}

      {policy.status === 'not-amended' ? (
        <p className="text-ink-70 text-sm leading-relaxed">{policy.notes}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="SBA" value={`${policy.sbaWeightPct}%`} accent={accent} />
            <StatTile label="Final" value={`${policy.finalWeightPct}%`} accent={accent} />
            <StatTile label="Promotion" value={`${policy.promotionMark}`} sub="marks" accent={accent} />
          </div>

          {/* The term-by-term plan — the part a learner and a parent argue about. */}
          <div>
            <SectionLabel className="!mb-2">By term</SectionLabel>
            <div className="space-y-1.5">
              {[1, 2, 3, 4].map(term => {
                const inTerm = policy.tasks.filter(t => t.term === term)
                if (!inTerm.length) return null
                const weight = inTerm.reduce((sum, t) => sum + t.sbaWeightPct, 0)
                return (
                  <div key={term} className="flex items-center gap-2 text-xs">
                    <span className="w-14 shrink-0 font-display text-ink-70">Term {term}</span>
                    <span className="flex-1 text-ink-80 leading-snug">
                      {inTerm.map(t => t.name).join(' · ')}
                    </span>
                    <span className="font-mono-data text-ink-80 shrink-0">
                      {term === 4 ? `${capsFinalMarks(policy)} raw` : `${weight}%`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {policy.sbaWeightNote && (
            <p className="text-ember/80 text-xs leading-relaxed">
              <span className="font-semibold">Printed weightings total {capsSbaWeightTotal(policy)}%. </span>
              {policy.sbaWeightNote}
            </p>
          )}

          <Divider />

          {/* Every prescribed task, with the papers it is written in. */}
          <div className="space-y-3">
            {policy.tasks.map(t => (
              <div key={t.id} className="rounded-lg bg-tint-strong border border-line p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-display font-semibold text-ink">{t.name}</span>
                  <span className="font-mono-data text-xs shrink-0"
                    style={{ color: t.term === 4 ? accent : 'rgba(5,31,46,0.12)' }}>
                    {t.term === 4 ? 'final · 75%' : `${t.sbaWeightPct}% SBA`}
                  </span>
                </div>
                <p className="text-ink-60 text-xs mt-0.5 capitalize">{t.type} · {capsTaskMarks(t)} marks</p>
                {t.papers.length > 1 && (
                  <p className="text-ink-70 text-xs mt-1 font-mono-data">
                    {t.papers.map(p => `${p.label} ${p.rawMarks}`).join(' · ')}
                    {t.papers.every(p => p.durationMin) && ` · ${t.papers[0].durationMin} min each`}
                  </p>
                )}
                {t.papers.length === 1 && t.papers[0].durationMin && (
                  <p className="text-ink-70 text-xs mt-1 font-mono-data">{t.papers[0].durationMin} min</p>
                )}
                {t.papers[0].structure && (
                  <p className="text-ink-70 text-xs mt-1">{t.papers[0].structure}</p>
                )}
                {t.notes && <p className="text-ink-70 text-xs mt-1.5 leading-relaxed">{t.notes}</p>}
              </div>
            ))}
          </div>

          {policy.difficulty && (
            <div>
              <SectionLabel className="!mb-2">Degrees of difficulty</SectionLabel>
              <WeightingBar items={policy.difficulty} accent={accent} />
            </div>
          )}

          {policy.notes && (
            <p className="text-ink-70 text-xs leading-relaxed border-t border-line pt-3">
              {policy.notes}
            </p>
          )}
        </>
      )}
    </Card>
  )
}

export default function ProgrammePage() {
  const { activeSubjectId } = useAppStore()
  const [grade, setGrade] = useState<'10' | '11'>('10')

  const accent = SUBJECT_MAP[activeSubjectId].color
  const components = SUBJECT_MAP[activeSubjectId].capsComponents

  const policies = useMemo(
    () => components.map(id => capsPolicyFor(id, Number(grade) as 10 | 11)).filter(
      (p): p is CapsSubjectPolicy => !!p,
    ),
    [components, grade],
  )

  // Where the booklet gives a cognitive split for a final paper, show it: this
  // is the weighting a paper is moderated against, so it belongs next to the plan.
  const withCognitive = policies.find(p =>
    p.status === 'amended' && p.tasks.some(t => t.term === 4 && t.papers[0]?.cognitive.length),
  )
  const cognitivePaper = withCognitive?.tasks
    .filter(t => t.term === 4)
    .flatMap(t => t.papers)
    .find(p => p.cognitive.length > 0)

  return (
    <div className="space-y-5">
      <div>
        <p className="text-ink-70 text-xs font-semibold tracking-widest uppercase font-display">
          Curriculum &amp; Assessment
        </p>
        <h2 className="font-display text-2xl font-bold text-ink mt-0.5">Programme of Assessment</h2>
        <p className="text-ink-60 text-xs font-mono-data mt-1">
          {SUBJECT_MAP[activeSubjectId].name} · Grade {grade}
        </p>
      </div>

      {components.length > 1 && (
        <Card className="!border-orange/30 !bg-orange/[0.06]">
          <p className="text-ember text-xs leading-relaxed">
            {SUBJECT_MAP[activeSubjectId].name} combines {components.length} CAPS subjects, each with its own
            Programme of Assessment. They are listed separately below rather than merged.
          </p>
        </Card>
      )}

      <Segmented
        value={grade}
        onChange={setGrade}
        options={[{ value: '10', label: 'Grade 10' }, { value: '11', label: 'Grade 11' }]}
      />

      {/* Mathematics, Accounting, Business Studies and Economics carry no Grade 11
          policy in CAPS_POLICIES, and `capsPolicyFor` returns null for those. The
          Grade 11 toggle is offered for every subject, so without this the list
          rendered as an empty gap with no explanation. */}
      {policies.length === 0 ? (
        <EmptyState
          icon="◈"
          title={`No Grade ${grade} programme encoded`}
          body={`${SUBJECT_MAP[activeSubjectId].name} has no Grade ${grade} Programme of Assessment in this app yet. Grade 10 is available, and the Grade ${grade} requirements will appear here once they are added.`}
        />
      ) : (
        <div className="space-y-4">
          {policies.map(policy => (
            <PolicyCard key={`${policy.id}-${policy.grade}`} policy={policy} accent={accent} />
          ))}
        </div>
      )}

      {cognitivePaper && withCognitive && (
        <Card className="space-y-3">
          <div>
            <SectionLabel className="!mb-1">How {withCognitive.name} papers are pitched</SectionLabel>
            <p className="text-ink-60 text-xs">{cognitivePaper.label} · {cognitivePaper.rawMarks} marks</p>
          </div>
          <WeightingBar items={cognitivePaper.cognitive} accent={accent} />
        </Card>
      )}

      {/* What the app will and will not claim. The honest footer matters more
          than a badge: a learner must not read "CAPS aligned" as "this paper
          counts towards my SBA". */}
      <Card className="space-y-3">
        <SectionLabel className="!mb-1">What this app counts</SectionLabel>
        <ul className="space-y-2 text-xs leading-relaxed">
          <li className="text-ink-70">
            <span className="text-ink font-semibold">Every quiz in BrainyBox is formative.</span> Practice,
            diagnostics and mini-tests are learning tools. None of them is moderated, reported to the DBE, or
            counted towards a learner's School-Based Assessment.
          </li>
          <li className="text-ink-70">
            A quiz only counts as an <span className="text-ink font-semibold">official task</span> once it is
            built to a prescribed task above — the right papers, marks, duration and cognitive mix. The data checks
            fail the build if a quiz claims that without matching.
          </li>
          <li className="text-ink-70">
            Informal work — practice activities, a project, experiments that are not formally assessed — is
            recorded in each subject's notes. It carries no marks and no moderation, so it is not listed as a
            weighted task.
          </li>
        </ul>
      </Card>

      <div className="text-ink-60 text-xs leading-relaxed space-y-1">
        <p className="font-display font-semibold text-ink-70">Sources</p>
        <p>{CAPS_AMENDMENTS.title}</p>
        <p>
          {CAPS_AMENDMENTS.publisher} · implementation {CAPS_AMENDMENTS.implementationDate}
        </p>
        <p>{CAPS_AMENDMENTS.standing}</p>
        <p>
          {CAPS_POLICIES.filter(p => p.status === 'amended').length} amended subject programmes and{' '}
          {CAPS_POLICIES.filter(p => p.status === 'not-amended').length} deliberately unamended are encoded from
          this booklet.
        </p>
        <p className="pt-2">
          {MATHEMATICS_NCS.title} — curriculum for Mathematics, which this booklet excludes.
        </p>
        <p>
          {MATHEMATICS_NCS.publisher} · {MATHEMATICS_NCS.year} · ISBN {MATHEMATICS_NCS.isbn}
        </p>
        <p>{MATHEMATICS_NCS.standing}</p>
      </div>
    </div>
  )
}

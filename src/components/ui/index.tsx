import { Link } from 'react-router'
import { getMasteryLevel, masteryColor, masteryLabel, ncsRating, SUBJECT_MAP, type MasteryLevel, type SubjectId } from '@/data'

// ── Progress Bar ───────────────────────────────────────────────────────────
export function ProgressBar({
  value,
  color,
  height = 'h-1.5',
  className = '',
}: {
  /** `null` shows an empty track, so a missing score is not a full bar. */
  value: number | null
  color: string
  height?: string
  className?: string
}) {
  return (
    <div className={`${height} w-full rounded-full bg-tint-press overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-700"
        // No measurement is a zero-width bar, never a negative or NaN width.
        style={{
          width: value === null ? '0%' : `${Math.min(100, Math.max(0, value))}%`,
          backgroundColor: color,
        }}
      />
    </div>
  )
}

// ── Score Chip ─────────────────────────────────────────────────────────────
/**
 * A score, or the absence of one.
 *
 * `null` renders as a muted "not assessed" rather than 0%. That distinction
 * matters: a learner who has not sat the diagnostic has an unknown score, and
 * showing them a red 0% would be reporting a failure they were never given the
 * chance to commit.
 */
export function ScoreChip({ score, size = 'sm' }: { score: number | null; size?: 'xs' | 'sm' | 'lg' | 'xl' }) {
  const cls = { xs: 'text-xs font-semibold', sm: 'text-sm font-bold', lg: 'text-2xl font-extrabold', xl: 'text-5xl font-black' }[size]
  if (score === null) {
    return (
      <span className={`font-mono-data ${cls} text-ink-60`} title="Not yet assessed">
        —
      </span>
    )
  }
  const color = masteryColor(getMasteryLevel(score)!)
  return <span className={`font-mono-data ${cls}`} style={{ color }}>{score}%</span>
}

// ── Delta Badge ────────────────────────────────────────────────────────────
/**
 * Change since the diagnostic.
 *
 * Rendered as nothing at all until both figures exist — a delta needs two
 * measurements, and with only the current score there is no movement to report.
 */
export function DeltaBadge({ baseline, current, className = '' }: { baseline: number | null; current: number | null; className?: string }) {
  if (baseline === null || current === null) return null
  const delta = current - baseline
  return (
    <span className={`font-mono-data text-xs font-semibold ${delta >= 0 ? 'text-emerald-400' : 'text-rose-400'} ${className}`}>
      {delta >= 0 ? '+' : ''}{delta} pp
    </span>
  )
}

// ── Mastery Dot ────────────────────────────────────────────────────────────
/** A hollow dot for an unassessed skill, so a real band never reads as empty. */
export function MasteryDot({ level, size = 'sm' }: { level: MasteryLevel | null; size?: 'xs' | 'sm' }) {
  const dim = size === 'xs' ? 'w-1.5 h-1.5' : 'w-2 h-2'
  if (level === null) {
    return (
      <span
        className={`inline-block ${dim} rounded-full flex-shrink-0 border border-dashed border-line-strong`}
        title="Not yet assessed"
      />
    )
  }
  return <span className={`inline-block ${dim} rounded-full flex-shrink-0`} style={{ backgroundColor: masteryColor(level) }} />
}

// ── Mastery Badge ──────────────────────────────────────────────────────────
export function MasteryBadge({ score }: { score: number | null }) {
  const level = getMasteryLevel(score)
  if (level === null) {
    return (
      <span className="text-xs font-display font-semibold px-2 py-0.5 rounded-full whitespace-nowrap bg-tint-strong text-ink-70">
        Not assessed
      </span>
    )
  }
  const color = masteryColor(level)
  return (
    <span className="text-xs font-display font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: `${color}18`, color }}>
      {masteryLabel(level)}
    </span>
  )
}

// The official NCS six-point rating, shown separately from `MasteryBadge` on
// purpose. The Marks Map band and the NCS level are different scales — a 55% is
// "Weak" on the guide and "Satisfactory (4)" on the NCS — so this is never
// substituted for the guide band, only shown beside it with its own label.
export function NcsRatingBadge({ score, className = '' }: { score: number; className?: string }) {
  const band = ncsRating(score)
  return (
    <span
      className={`inline-flex items-baseline gap-1 font-mono-data text-xs font-semibold whitespace-nowrap ${className}`}
      style={{ color: band.color }}
    >
      <span aria-hidden="true">NCS {band.level}</span>
      <span className="font-display">{band.label}</span>
    </span>
  )
}

// ── Card ───────────────────────────────────────────────────────────────────
/**
 * A surface that becomes a real `<button>` when it is clickable.
 *
 * Callers must not put a `<button>`, `<a>`, or another control inside a clickable
 * Card: that nests interactive content, which is invalid HTML, splits the click
 * target, and leaves assistive technology with a tree the browser has silently
 * rewritten. Put a plain Card around such content and let the inner control act,
 * or split the card into sibling controls.
 */
export function Card({
  children,
  className = '',
  onClick,
  hover = false,
  style,
  as = 'div',
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  hover?: boolean
  style?: React.CSSProperties
  /** Render as a real <button> so taps get keyboard and AT semantics. */
  as?: 'div' | 'button'
}) {
  const interactive = Boolean(onClick)
  const classes = [
    'w-full text-left rounded-xl bg-surface border border-line-hover shadow-[0_1px_2px_rgba(5,31,46,0.03),0_8px_24px_rgba(5,31,46,0.035)]',
    interactive ? 'pressable cursor-pointer' : '',
    interactive ? 'hover:border-line-strong hover:shadow-[0_8px_28px_rgba(5,31,46,0.09)] active:border-line-strong' : '',
    className,
  ].join(' ')

  if (as === 'button' || interactive) {
    return (
      <button type="button" onClick={onClick} style={style} className={classes}>
        {children}
      </button>
    )
  }

  return <div style={style} className={classes}>{children}</div>
}

// ── Section Label ──────────────────────────────────────────────────────────
export function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-ink-70 text-xs font-semibold tracking-widest uppercase font-display mb-3 ${className}`}>
      {children}
    </p>
  )
}

// ── Button ─────────────────────────────────────────────────────────────────
export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
  className = '',
  full = false,
  style,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
  full?: boolean
  style?: React.CSSProperties
}) {
  const variants = {
    primary:   'bg-blue active:bg-navy text-white',
    secondary: 'bg-tint-strong active:bg-tint-press text-ink',
    ghost:     'border border-line-hover active:bg-tint-press text-ink-80',
    danger:    'bg-rose-500 active:bg-rose-400 text-white',
    accent:    'bg-orange active:bg-ember text-ink',
  }
  // Mobile-first: the default size clears a 44px touch target.
  const sizes = {
    sm: 'px-3.5 py-2.5 text-xs min-h-[40px]',
    md: 'px-4 py-3 text-sm min-h-[48px]',
    lg: 'px-5 py-4 text-sm min-h-[54px]',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={style}
      className={`inline-flex items-center justify-center gap-2 font-display font-bold rounded-xl transition-colors duration-150 disabled:opacity-30 disabled:pointer-events-none touch-manipulation ${variants[variant]} ${sizes[size]} ${full ? 'w-full' : ''} ${className}`}
    >
      {children}
    </button>
  )
}

// ── Stat Tile ──────────────────────────────────────────────────────────────
export function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-surface rounded-xl p-3 border border-line-hover text-center min-w-0">
      <p className="text-ink-70 text-xs font-display mb-1 truncate">{label}</p>
      <p className="font-display font-bold text-ink text-sm leading-tight break-anywhere"
        style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      {sub && <p className="text-ink-60 text-xs font-mono-data mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

// ── Unassessed ─────────────────────────────────────────────────────────────
/**
 * The cold-start panel.
 *
 * A learner's first visit has no mastery, and the app must not fill that gap
 * with an invented score. Wherever a page would otherwise show a percentage, a
 * band or a chart, it shows this instead: an explanation that nothing has been
 * measured, and the one action that changes that — the diagnostic.
 *
 * The distinction from `EmptyState` is intent. `EmptyState` means "there is
 * nothing here for you". This means "there is nothing here *about you* yet", and
 * it is always paired with a route to the diagnostic.
 */
export function NotAssessed({
  what = 'your progress',
  body,
  diagnosticHref,
  compact = false,
  className = '',
}: {
  /** What is unknown, e.g. "Trigonometry" or "your overall progress". */
  what?: string
  /** Overrides the default explanation. Pass '' to render the heading alone. */
  body?: string
  /** Where taking the first diagnostic leads. Omit to render without a button. */
  diagnosticHref?: string
  compact?: boolean
  className?: string
}) {
  const text = body ?? (compact
    ? `Nothing has been measured for ${what} yet.`
    : `There is no mark for ${what} yet, because you have not been asked any questions about it. Take the diagnostic and your Marks Map, revision plan and focus areas all build from what you actually know.`)

  const content = (
    <>
      <p className="font-display font-bold text-ink text-sm">
        Not yet assessed
      </p>
      {text && <p className="text-ink-70 text-xs mt-1 max-w-[46ch]">{text}</p>}
    </>
  )

  if (diagnosticHref && !compact) {
    return (
      <div className={`rounded-2xl border border-dashed border-line-strong bg-tint p-5 text-center flex flex-col items-center gap-3 ${className}`}>
        <span className="text-2xl" aria-hidden="true">◇</span>
        {content}
        <Link
          to={diagnosticHref}
          className="inline-flex items-center gap-2 text-sm font-display font-bold px-4 py-3 rounded-xl text-ink min-h-[48px]"
          style={{ background: 'rgba(5,31,46,0.12)' }}
        >
          Take the diagnostic →
        </Link>
      </div>
    )
  }

  return (
    <div className={`text-center py-2 ${className}`}>
      {content}
    </div>
  )
}

// ── Empty State ────────────────────────────────────────────────────────────
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: string
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center px-6">
      <span className="text-4xl" aria-hidden="true">{icon}</span>
      <p className="font-display font-bold text-ink">{title}</p>
      <p className="text-ink-70 text-sm max-w-xs">{body}</p>
      {action}
    </div>
  )
}

// ── Segmented Control ──────────────────────────────────────────────────────
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={`flex rounded-xl bg-surface border border-line-hover p-1 gap-1 ${className}`}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className="flex-1 min-h-[40px] px-2 rounded-lg font-display text-sm font-semibold transition-colors duration-150 truncate"
          style={{
            background: value === option.value ? '#027FC4' : 'transparent',
            color: value === option.value ? '#fff' : 'rgba(5,31,46,0.55)',
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

// ── Filter Rail ────────────────────────────────────────────────────────────
/** Horizontally swipeable single-select chips. */
export function FilterRail({
  options,
  value,
  onChange,
  accent = '#027FC4',
  className = '',
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  accent?: string
  className?: string
}) {
  return (
    <div className={`scroll-x gap-2 -mx-4 px-4 py-1 ${className}`} role="tablist">
      {options.map(option => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className="px-3.5 min-h-[38px] rounded-full text-xs font-display font-semibold whitespace-nowrap transition-colors duration-150 touch-manipulation"
            style={{
              background: active ? accent : 'rgba(5,31,46,0.06)',
              color: active ? '#fff' : 'rgba(5,31,46,0.55)',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Subject Chip ───────────────────────────────────────────────────────────
export function SubjectChip({
  subjectId,
  selected,
  onClick,
  className = '',
}: {
  subjectId: SubjectId
  selected: boolean
  onClick: () => void
  className?: string
}) {
  const subject = SUBJECT_MAP[subjectId]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex items-center gap-2 pl-1.5 pr-3.5 min-h-[44px] rounded-xl border transition-colors duration-150 touch-manipulation ${className}`}
      style={{
        background: selected ? subject.color : '#FFFFFF',
        borderColor: selected ? subject.color : '#E2EAF2',
        boxShadow: selected ? `0 4px 12px ${subject.color}33` : '0 1px 3px rgba(5,31,46,0.04)',
      }}
    >
      <span
        className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
        style={{ background: selected ? 'rgba(255,255,255,0.18)' : `${subject.color}18`, color: selected ? '#fff' : subject.color }}
        aria-hidden="true"
      >
        {subject.glyph}
      </span>
      <span className="text-left min-w-0">
        <span className="block text-xs font-display font-bold leading-tight truncate"
          style={{ color: selected ? '#fff' : '#526779' }}>
          {subject.shortName}
        </span>
      </span>
    </button>
  )
}

// ── Divider ────────────────────────────────────────────────────────────────
export function Divider({ className = '' }: { className?: string }) {
  return <div className={`h-px bg-tint-strong ${className}`} />
}

// ── Pill ───────────────────────────────────────────────────────────────────
export function Pill({
  children,
  color = '#027FC4',
  className = '',
}: {
  children: React.ReactNode
  color?: string
  className?: string
}) {
  return (
    <span className={`text-xs font-display font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${className}`}
      style={{ background: `${color}18`, color }}>
      {children}
    </span>
  )
}

export const difficultyColor = (difficulty: 'easy' | 'medium' | 'hard') =>
  difficulty === 'easy'
    ? { bg: 'rgba(16,185,129,0.12)', color: '#047857' }
    : difficulty === 'medium'
      ? { bg: 'rgba(245,158,11,0.12)', color: '#B45309' }
      : { bg: 'rgba(244,63,94,0.12)', color: '#f43f5e' }

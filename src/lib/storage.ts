// ── localStorage JSON store ────────────────────────────────────────────────
// Everything except uploaded file bytes lives here. Writes are namespaced and
// versioned so a schema change can drop stale state instead of crashing on a
// shape mismatch.

const PREFIX = 'brainybox:'
const VERSION_KEY = `${PREFIX}version`
const CURRENT_VERSION = 1

export function loadVersion(): number {
  if (typeof localStorage === 'undefined') return CURRENT_VERSION
  const raw = localStorage.getItem(VERSION_KEY)
  return raw ? Number(raw) : CURRENT_VERSION
}

export function writeVersion(version: number): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(VERSION_KEY, String(version))
}

/**
 * Read and parse a namespaced key. Returns `fallback` on any failure —
 * a corrupted or absent entry must never take the app down.
 */
export function read<T>(key: string, fallback: T): T {
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function write(key: string, value: unknown): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Quota exceeded. The in-memory state is still correct, so the session
    // carries on; the data will simply not survive a reload.
  }
}

export function remove(key: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(PREFIX + key)
}

/** Remove every BrainyBox key — used by the "reset demo data" action. */
export function clearAll(): void {
  if (typeof localStorage === 'undefined') return
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(PREFIX)) keys.push(key)
  }
  keys.forEach(key => localStorage.removeItem(key))
}

/**
 * Local `YYYY-MM-DD` for the learner's own timezone.
 *
 * Attempt dates, streaks and revision day labels all have to agree on what
 * "today" is, and `toISOString().slice(0, 10)` does not: it is UTC. A learner in
 * a UTC+2 timezone sitting a paper at 21:00 filed it under yesterday, which both
 * broke the streak and put the revision plan's dates a day out. This is the one
 * helper all three use.
 */
export function localDay(date: Date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export function newId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now().toString(36)}-${random}`
}

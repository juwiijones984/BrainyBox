import { useState } from 'react'
import { Button, Card, EmptyState, Pill, SectionLabel } from '@/components/ui'
import { LoadError } from './AdminOverviewPage'
import { useAdminData } from './useAdminData'
import { linkParentToChild, unlinkParentFromChild } from '@/lib/firebase/store'

/**
 * Parent → child access grants, and the orphaned ones.
 *
 * A link is the only thing that gives a parent sight of a child's progress, so
 * this page is deliberately the most careful of the four. Two properties of
 * `firestore.rules` shape it:
 *
 *  - `update` on `parentLinks` is unconditionally false. A link cannot be
 *    re-pointed at a different child; it is deleted and recreated. That is the
 *    point — editing a link in place is the kind of change that silently
 *    transfers access to a child nobody approved, so the rules make it
 *    impossible rather than merely discouraged.
 *  - Creating one requires both accounts to already exist. A uid cannot be
 *    chosen at registration, so a link naming an unknown uid is permanently
 *    dead: it grants access to nobody and can never become valid. Those are the
 *    entries flagged here, and this is where the two pre-existing orphans from
 *    the live project are visible and removable.
 */
export default function AdminLinksPage() {
  const { links, people, nameOf, issues, loading, error, reload } = useAdminData()
  const [parentUid, setParentUid] = useState('')
  const [childUid, setChildUid] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const parents = people.filter(p => p.role === 'parent')
  const children = people.filter(p => p.role === 'learner')
  const linked = new Set(links.map(l => `${l.parentUid}|${l.childUid}`))
  const orphans = new Set(issues.filter(i => i.kind.startsWith('link-')).map(i => `${i.kind}|${i.uid}`))

  if (error) return <LoadError message={error} />
  if (loading) return <p className="text-ink-70 text-sm font-display py-10 text-center">Loading…</p>

  const create = async () => {
    if (busy || !parentUid || !childUid) return
    if (linked.has(`${parentUid}|${childUid}`)) return setMsg('That link already exists.')

    setBusy(true)
    setMsg(null)
    try {
      await linkParentToChild(parentUid, childUid)
      setChildUid('')
      reload()
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (p: string, c: string) => {
    if (busy) return
    setBusy(true)
    setMsg(null)
    try {
      await unlinkParentFromChild(p, c)
      reload()
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const orphanRows = links.filter(l =>
    !people.some(p => p.id === l.parentUid) || !people.some(p => p.id === l.childUid),
  )

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display font-extrabold text-ink text-xl tracking-tight">Parent links</h1>
        <p className="text-ink-70 text-xs mt-1">
          {links.length} grants · a link is what lets a parent see a child's progress
        </p>
      </div>

      <Card className="p-4 space-y-3">
        <SectionLabel>Grant access</SectionLabel>

        {parents.length === 0 || children.length === 0 ? (
          <p className="text-ember text-xs leading-relaxed bg-orange/5 border border-orange/10 rounded-xl px-3 py-2.5">
            A link needs a parent account and a learner account.
            {parents.length === 0 && ' No account has the parent role yet.'}
            {children.length === 0 && ' No learner has registered yet.'}
            {' Promote one with '}
            <code className="text-ink">npm run provision -- setrole &lt;uid&gt; parent</code>.
          </p>
        ) : (
          <>
            <div>
              <label className="block text-ink-70 text-xs font-display mb-1.5" htmlFor="lnk-parent">Parent</label>
              <select
                id="lnk-parent"
                className={FIELD}
                value={parentUid}
                onChange={e => setParentUid(e.target.value)}
              >
                <option value="">Choose a parent…</option>
                {parents.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-ink-70 text-xs font-display mb-1.5" htmlFor="lnk-child">Child</label>
              <select
                id="lnk-child"
                className={FIELD}
                value={childUid}
                onChange={e => setChildUid(e.target.value)}
              >
                <option value="">Choose a learner…</option>
                {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <Button full onClick={() => void create()} disabled={busy || !parentUid || !childUid}>
              {busy ? 'Working…' : 'Grant access'}
            </Button>
          </>
        )}

        {msg && <p className="text-rose-300 text-xs leading-relaxed">{msg}</p>}
      </Card>

      {orphanRows.length > 0 && (
        <Card className="p-4 border-rose-500/20 space-y-3">
          <SectionLabel>Orphaned · {orphanRows.length}</SectionLabel>
          <p className="text-ink-70 text-xs leading-relaxed">
            These name an account that does not exist, so they grant access to nobody and can never
            become valid — a uid cannot be chosen at registration. Removing one deletes a single
            document; no learner's work is touched.
          </p>
          <ul className="space-y-1.5">
            {orphanRows.map(l => (
              <li key={l.id} className="flex items-center gap-2 text-xs">
                <span className="text-rose-400" aria-hidden="true">!</span>
                <span className="font-mono-data text-ink-70 truncate flex-1" title={l.id}>{l.id}</span>
                <button
                  type="button"
                  onClick={() => void remove(l.parentUid, l.childUid)}
                  disabled={busy}
                  className="text-rose-300/80 active:text-rose-200 text-xs font-display font-semibold min-h-[36px] px-2 disabled:opacity-40"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {links.length === 0 ? (
        <EmptyState icon="◈" title="No links yet" body="Grant a parent access to a learner above." />
      ) : (
        <ul className="space-y-2">
          {links.map(l => {
            const brokenParent = !people.some(p => p.id === l.parentUid)
            const brokenChild = !people.some(p => p.id === l.childUid)
            return (
              <li key={l.id}>
                <Card className="p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">
                        {nameOf(l.parentUid)} <span className="text-ink-60">→</span> {nameOf(l.childUid)}
                      </p>
                      <p className="font-mono-data text-ink-60 text-[11px] mt-1 truncate" title={l.id}>{l.id}</p>
                      {(brokenParent || brokenChild) && (
                        <div className="mt-2">
                          <Pill color="#fb7185">
                            {brokenParent && brokenChild ? 'both accounts missing'
                              : brokenParent ? 'parent missing' : 'child missing'}
                          </Pill>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => void remove(l.parentUid, l.childUid)}
                      disabled={busy}
                      className="text-xs font-display font-semibold text-rose-300/80 active:text-rose-200 shrink-0 min-h-[40px] px-2 disabled:opacity-40"
                    >
                      Revoke
                    </button>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-ink-60 text-xs leading-relaxed">
        {orphans.size > 0 ? `${orphans.size} of the flagged uids are referenced by an orphan. ` : ''}
        Links cannot be edited — <code className="text-ink-70">firestore.rules</code> makes update
        on this collection unconditionally false, so revoking and re-granting is the only path. That
        is deliberate: re-pointing a link in place would hand access to a child nobody approved.
      </p>
    </div>
  )
}

const FIELD =
  'w-full rounded-xl bg-surface border border-line-hover text-ink px-3.5 py-3 text-sm min-h-[48px] outline-none focus:border-blue/30'

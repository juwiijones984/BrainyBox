import { useEffect, useState } from 'react'
import type { Resource } from '@/data'
import { useAuth } from '@/store/AuthStore'
import { resourceUrl } from '@/lib/firebase/uploads'
import { Button, EmptyState, Pill } from '@/components/ui'

const KIND_COLOR: Record<Resource['kind'], string> = {
  'notes': '#027FC4',
  'past-paper': '#f43f5e',
  'worksheet': '#047857',
  'image': '#FA9907',
}

export const resourceKindColor = (kind: Resource['kind']) => KIND_COLOR[kind]

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Guess a resource kind from a MIME type when the teacher didn't pick one. */
export function guessKind(file: File): Resource['kind'] {
  if (file.type === 'application/pdf') return 'past-paper'
  if (file.type.startsWith('image/')) return 'image'
  return 'notes'
}

export function formatTitle(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, character => character.toUpperCase())
}

// ── Preview ────────────────────────────────────────────────────────────────
/**
 * Renders a stored file inline. PDFs embed in an <object> (so the browser's
 * own viewer handles it), images render directly, and anything else falls back
 * to a download prompt.
 *
 * The bytes are in Cloud Storage, so this resolves a download URL rather than
 * reading a local blob. That URL is a signed, expiring token issued to this
 * account for this file, which is what makes the same resource viewable by a
 * learner, a linked parent and a class teacher without any of them holding
 * another's credentials.
 */
export function FilePreview({ resource }: { resource: Resource }) {
  const { user } = useAuth()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setError('Sign in to open this file.')
      return
    }
    // The account that owns the bytes decides the audience in `storage.rules`,
    // so a download URL has to be requested against the owner's path — not the
    // viewer's. A descriptor with no owner is a descriptor whose file cannot be
    // located, and saying so beats rendering an empty frame.
    const ownerUid = resource.ownerUid
    if (!ownerUid) {
      setError('This upload is not recorded against an account, so its file cannot be found.')
      return
    }

    let active = true
    setUrl(null)
    setError(null)

    resourceUrl(ownerUid, resource.blobKey)
      .then(resolved => {
        if (!active) return
        setUrl(resolved)
      })
      .catch((cause: unknown) => {
        if (!active) return
        // A missing object is a real, reportable state: the descriptor was
        // written but the upload did not finish.
        setError(
          `The file data is missing. ${resource.fileName} may never have finished uploading.`,
        )
      })

    return () => { active = false }
  }, [resource.blobKey, resource.fileName, user])

  if (error) {
    return (
      <div className="rounded-xl p-4 border border-rose-500/20 bg-rose-500/5">
        <p className="text-rose-400 text-xs font-display uppercase tracking-widest mb-1">Cannot open</p>
        <p className="text-ink-80 text-sm">{error}</p>
      </div>
    )
  }

  if (!url) {
    return (
      <div className="rounded-xl p-6 border border-line-hover bg-tint flex items-center justify-center gap-3">
        <span className="w-4 h-4 rounded-full border-2 border-line-strong border-t-blue animate-spin" aria-hidden="true" />
        <span className="text-ink-70 text-sm font-display">Loading {resource.fileName}…</span>
      </div>
    )
  }

  if (resource.mimeType === 'application/pdf') {
    return (
      <object
        data={url}
        type="application/pdf"
        className="w-full rounded-xl border border-line-hover bg-surface"
        style={{ height: 'min(70dvh, 640px)' }}
        aria-label={resource.title}
      >
        {/* Shown by the browser when it cannot render the PDF inline. */}
        <div className="p-4">
          <p className="text-ink-80 text-sm mb-3">Your browser cannot display this PDF inline.</p>
          <a
            href={url}
            download={resource.fileName}
            className="inline-flex items-center min-h-[44px] px-4 rounded-xl bg-blue text-white font-display font-bold text-sm"
          >
            Download {resource.fileName}
          </a>
        </div>
      </object>
    )
  }

  if (resource.mimeType.startsWith('image/')) {
    return (
      <img
        src={url}
        alt={resource.title}
        className="w-full rounded-xl border border-line-hover"
      />
    )
  }

  return (
    <div className="rounded-xl p-5 border border-line-hover bg-tint text-center">
      <p className="text-ink-70 text-sm mb-3">
        {resource.fileName} can’t be previewed in the browser.
      </p>
      <a
        href={url}
        download={resource.fileName}
        className="inline-flex items-center min-h-[44px] px-4 rounded-xl bg-blue active:bg-navy text-white font-display font-bold text-sm"
      >
        Download file
      </a>
    </div>
  )
}

// ── Row ────────────────────────────────────────────────────────────────────
export function ResourceRow({
  resource,
  onOpen,
  onDelete,
}: {
  resource: Resource
  onOpen: () => void
  onDelete: () => void
}) {
  const color = resourceKindColor(resource.kind)
  return (
    <div className="rounded-2xl bg-surface border border-line-hover p-4 flex items-center gap-3">
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left pressable min-h-[44px] flex items-center gap-3">
        <Pill color={color}>{resource.kind.replace('-', ' ')}</Pill>
        <span className="min-w-0 flex-1">
          <span className="block text-ink text-sm font-display font-semibold truncate">{resource.title}</span>
          <span className="block text-ink-60 text-xs font-mono-data truncate">
            {resource.fileName} · {formatBytes(resource.size)}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${resource.title}`}
        className="w-10 h-10 rounded-xl text-rose-400/60 active:text-rose-400 active:bg-rose-500/10 transition-colors flex items-center justify-center flex-shrink-0"
      >
        ✕
      </button>
    </div>
  )
}

// ── Viewer sheet ───────────────────────────────────────────────────────────
export function ResourceSheet({
  resource,
  onClose,
  onDelete,
}: {
  resource: Resource | null
  onClose: () => void
  onDelete?: (id: string) => void
}) {
  if (!resource) return null
  const color = resourceKindColor(resource.kind)

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative w-full sm:max-w-2xl max-h-[88dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-surface border border-line shadow-xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Pill color={color}>{resource.kind.replace('-', ' ')}</Pill>
              <span className="text-ink-60 text-xs font-mono-data">{formatBytes(resource.size)}</span>
            </div>
            <h3 className="font-display font-bold text-ink text-lg break-anywhere leading-tight">{resource.title}</h3>
            <p className="text-ink-60 text-xs font-mono-data truncate">{resource.fileName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="w-10 h-10 rounded-xl text-ink-60 active:text-ink-80 active:bg-tint-press flex items-center justify-center flex-shrink-0 -mt-1 -mr-1"
          >
            ✕
          </button>
        </div>

        {resource.note && (
          <p className="text-ink-70 text-sm mb-3 leading-relaxed break-anywhere">{resource.note}</p>
        )}

        <FilePreview resource={resource} />

        <div className="mt-4 flex gap-2">
          {onDelete && (
            <Button
              variant="danger"
              onClick={() => {
                onDelete(resource.id)
                onClose()
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} className="flex-1">Close</Button>
        </div>
      </div>
    </div>
  )
}

export function NoResources({ subject }: { subject: string }) {
  return (
    <EmptyState
      icon="▤"
      title="Nothing uploaded yet"
      body={`Study notes and past papers for ${subject} will appear here once a teacher uploads them.`}
    />
  )
}

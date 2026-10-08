import {
  deleteObject, getDownloadURL, listAll, ref as storageRef, uploadBytesResumable,
} from 'firebase/storage'
import { requireStorage } from './config'

// ── Cloud Storage ──────────────────────────────────────────────────────────
//
// This replaces the IndexedDB blob store. The old design kept a learner's
// uploaded PDFs and images in the browser, keyed by a string held in
// localStorage, which meant the files were per-device and per-browser: the same
// learner signed in on a phone and a laptop had two different sets of uploads,
// a parent saw none of them, and clearing site data destroyed them.
//
// Files now live under `users/{uid}/resources/{resourceId}` in Cloud Storage,
// so they follow the account. The Firestore document at
// `users/{uid}/resources/{resourceId}` holds only the descriptor, and
// `storage.rules` is what actually authorises the bytes.

/** Storage path for one learner's resource, mirroring the Firestore document. */
export const resourcePath = (uid: string, resourceId: string): string =>
  `users/${uid}/resources/${resourceId}`

/** Strip anything that could change the meaning of a path segment. */
const safeSegment = (value: string): string =>
  value.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120)

const refFor = (uid: string, resourceId: string) =>
  storageRef(requireStorage(), `${resourcePath(uid, safeSegment(resourceId))}`)

/** Uploads above this size are worth confirming with the user first. */
export const LARGE_FILE_BYTES = 10 * 1024 * 1024

/**
 * Upload a resource's bytes.
 *
 * `contentType` is taken from the File so Cloud Storage records a real MIME
 * type and downloads open rather than arriving as an unknown blob. The
 * resumable variant is used so a dropped connection on a large past paper
 * retries instead of starting over.
 */
export function uploadResource(
  uid: string,
  resourceId: string,
  file: File,
  onProgress?: (fraction: number) => void,
) {
  const task = uploadBytesResumable(refFor(uid, resourceId), file, {
    contentType: file.type || 'application/octet-stream',
  })

  if (onProgress) {
    // A progress callback that throws must not fail the upload, so it is
    // isolated; a real upload error still rejects the returned promise below.
    task.on('state_changed', snap => {
      try {
        onProgress(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0)
      } catch {
        /* ignore */
      }
    })
  }

  return task
}

/** Resolve once the bytes are stored, for callers that do not want progress. */
export const uploadResourceBytes = async (
  uid: string,
  resourceId: string,
  file: File,
): Promise<void> => {
  // The task is resumed through its snapshot: `uploadBytesResumable` returns a
  // task whose `promise` settles on the next event, which is not awaited here.
  const task = uploadResource(uid, resourceId, file)
  await new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      snapshot => { if (snapshot.state === 'success') resolve() },
      reject,
      reject,
    )
  })
}

export async function resourceUrl(uid: string, resourceId: string): Promise<string> {
  return getDownloadURL(refFor(uid, resourceId))
}

export async function deleteResourceFile(uid: string, resourceId: string): Promise<void> {
  await deleteObject(refFor(uid, resourceId))
}

/**
 * List what a learner has actually stored.
 *
 * Used by the app to reconcile against Firestore: if a descriptor exists with
 * no object, the upload failed partway and the record should be cleaned up
 * rather than shown as a working link.
 */
export async function listResourcePaths(uid: string): Promise<string[]> {
  const listing = await listAll(storageRef(requireStorage(), `users/${uid}/resources`))
  return listing.items.map(item => item.fullPath)
}

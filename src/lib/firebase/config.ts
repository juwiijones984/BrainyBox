import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

// ── Firebase initialisation ────────────────────────────────────────────────
//
// This app is Firestore-only. There is no local fallback and there is no
// seeded data: a learner's progress exists because they sat a real diagnostic,
// and nothing in the app invents a number to fill a gap.
//
// That makes this module the single point where "is there a backend at all?"
// is decided. It deliberately does NOT throw when configuration is missing.
// A throw here happens during module evaluation, before React mounts, and
// produces a white screen with no explanation. Instead every export is `null`
// and `AuthStore` renders a screen naming the exact variables to set, so the
// failure is actionable instead of mysterious.
//
// Firebase client keys are shipped to the browser by design and are not
// secrets — what actually protects the data is `firestore.rules`, which is the
// only place authorisation is enforced. See `firestore.rules` at the repo root.

const env = import.meta.env

const REQUIRED = {
  VITE_FIREBASE_API_KEY: env.VITE_FIREBASE_API_KEY,
  VITE_FIREBASE_AUTH_DOMAIN: env.VITE_FIREBASE_AUTH_DOMAIN,
  VITE_FIREBASE_PROJECT_ID: env.VITE_FIREBASE_PROJECT_ID,
  VITE_FIREBASE_APP_ID: env.VITE_FIREBASE_APP_ID,
} as const

/** Env vars that are required and currently absent, for the error screen. */
export const MISSING_FIREBASE_ENV = (
  Object.keys(REQUIRED) as (keyof typeof REQUIRED)[]
).filter(key => !REQUIRED[key])

/** Storage and messaging sender id are optional; storage has a sensible default. */
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? `${REQUIRED.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

export const FIREBASE_CONFIGURED = MISSING_FIREBASE_ENV.length === 0

let app: FirebaseApp | null = null
let authInstance: Auth | null = null
let firestore: Firestore | null = null
let storageInstance: FirebaseStorage | null = null

if (FIREBASE_CONFIGURED) {
  app = initializeApp(firebaseConfig)
  authInstance = getAuth(app)
  firestore = getFirestore(app)
  storageInstance = getStorage(app)
}

export const firebaseApp = app
export const auth = authInstance
export const db = firestore
export const storage = storageInstance

/**
 * Narrowing helper for the case where a component is only reachable once the
 * auth store has reported a signed-in user, which implies configuration.
 * Throwing here means a genuine programming error — a Firestore call on an
 * unconfigured app — rather than a user-facing state, so it fails loudly.
 */
export function requireDb(): Firestore {
  if (!db) {
    throw new Error(
      'Firestore was called before Firebase was configured. Missing: ' +
        MISSING_FIREBASE_ENV.join(', '),
    )
  }
  return db
}

export function requireAuth(): Auth {
  if (!auth) {
    throw new Error(
      'Auth was called before Firebase was configured. Missing: ' +
        MISSING_FIREBASE_ENV.join(', '),
    )
  }
  return auth
}

export function requireStorage(): FirebaseStorage {
  if (!storage) {
    throw new Error(
      'Storage was called before Firebase was configured. Missing: ' +
        MISSING_FIREBASE_ENV.join(', '),
    )
  }
  return storage
}

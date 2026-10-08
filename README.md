# BrainyBox

BrainyBox is a CAPS Mathematics learning platform for Grades 10–12. It provides personalised practice and progress tracking for learners, with linked views for parents, teachers, and administrators.

## Features

- Learner portal with diagnostics, lessons, practice, tests, revision planning, a marks map, and a resource library.
- Parent portal for viewing linked learners and their progress.
- Teacher portal for learner resources, uploads, and quiz building.
- Admin portal for managing people, classes, and parent links.
- Firebase Authentication, Cloud Firestore, and Cloud Storage, protected by repository-managed security rules.

## Tech Stack

- React 19 and TypeScript
- Vite 8
- Tailwind CSS 4
- Firebase JS SDK 12
- pnpm

## Requirements

- Node.js 22 or later
- pnpm 10.34.3 (the version is recorded in `.mise.toml`)
- A Firebase project with Authentication, Cloud Firestore, and Cloud Storage configured

## Getting Started

Install dependencies and create a local environment file:

```sh
pnpm install
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

Set the Firebase web app values in `.env`:

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
```

The first four values are required. Copy `VITE_FIREBASE_STORAGE_BUCKET` from the Firebase console; new default buckets use the `PROJECT_ID.firebasestorage.app` format, while older projects may use `PROJECT_ID.appspot.com`. The messaging sender ID is optional.

In the Firebase console, enable Email/Password sign-in, create the Firestore database, and initialize the default Storage bucket. Deploy the repository's rules and indexes with the Firebase CLI:

```sh
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Start the development server:

```sh
pnpm dev
```

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Vite development server (port 8443 by default) |
| `pnpm build` | Create a production build in `dist/` |
| `pnpm preview` | Preview the production build locally |
| `pnpm test` | Run the data and question-parser checks |
| `pnpm typecheck` | Type-check the app and provisioning scripts |
| `pnpm format` | Format files with oxfmt |
| `pnpm rules:matrix` | Run the Firestore authorization matrix checks |

## Project Structure

- `src/app/` — application entry, routes, and role guards
- `src/pages/` — learner, parent, teacher, administrator, and authentication pages
- `src/components/` — shared layouts and UI components
- `src/data/` — CAPS Mathematics curriculum, lesson, and question data
- `src/lib/firebase/` — Firebase authentication, Firestore, and Storage access
- `firestore.rules`, `storage.rules` — server-enforced data access policies
- `scripts/` — data checks, rule checks, and operator provisioning tools

## Operator Provisioning

Class enrolments, parent-child links, role changes, and administrator claims are managed with the Admin SDK, not from the browser. Provisioning requires a Firebase service-account credential supplied through `GOOGLE_APPLICATION_CREDENTIALS` and the target `FIREBASE_PROJECT_ID`.

```sh
pnpm provision -- --help
```

Treat the service-account key as a secret. Never commit it or `.env`; both are excluded by `.gitignore`. The Firebase web configuration in `.env` is included in the client bundle by design, so security depends on Firebase Authentication and the deployed rules, not on hiding those values.
# Easy-As (Next.js + Firebase)

This project uses Next.js with Firebase client SDK, Firebase Admin SDK, and Genkit (Gemini).

## Local environment setup

1. Copy `env.local.example` to `.env.local` in the repository root.
2. Fill values for the listed variable names.
3. Keep `.env.local` untracked.

> Important: do not place env files under `src/`. Next.js reads env files from the project root.

## Required variables

### Client/build-safe (`NEXT_PUBLIC_*`)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (optional)
- `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY` (optional)

### Server-only secrets
- `GEMINI_API_KEY`
- Firebase Admin credentials using one of:
  - `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`, or
  - `GOOGLE_APPLICATION_CREDENTIALS_JSON`

`GEMINI_API_KEY` must remain server-side. Do **not** use `NEXT_PUBLIC_GEMINI_API_KEY`.

## Firebase deployment notes

- `firebase.json` in this repository is static Hosting-oriented (`public: out`).
- The app contains server API routes (`src/app/api/...`), so runtime server secrets and server execution must be configured in Firebase App Hosting (or equivalent server runtime), not plain static Hosting-only output.
- Firebase Console/App Hosting/Secret Manager configuration must be done outside GitHub.

## Firebase App Hosting / Secret Manager checklist (manual)

1. In Firebase Console, open your App Hosting backend.
2. Configure server secrets (`GEMINI_API_KEY` and Firebase Admin credentials) in Secret Manager / backend environment.
3. Configure required `NEXT_PUBLIC_FIREBASE_*` runtime/build variables for the same Firebase project.
4. Trigger a fresh rollout after env updates.
5. Verify:
   - build succeeds (`npm install`, `npm run build`)
   - AI flow works with `GEMINI_API_KEY`
   - authenticated API routes can initialize Firebase Admin
   - no secrets are committed to repository files

## Security reminder

If credentials were ever committed previously, rotate them in Firebase/Google Cloud outside this repository.

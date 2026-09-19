# 🛠️ Technical Documentation · Shark Empti v1.15.1

This document describes the architecture and contracts of the current source. It does not claim that unresolved findings in [AUDIT_REPORT.md](AUDIT_REPORT.md) have been corrected. Detailed setup belongs in [CONFIGURATION.md](CONFIGURATION.md); the target AI architecture belongs in [AI_TRANSPORT_REMEDIATION_PLAN.md](AI_TRANSPORT_REMEDIATION_PLAN.md).

## 🧭 Quick Navigation

| Reader goal | Read first |
|---|---|
| Determine the source of truth for a behavior or setting | Section 1 |
| Understand runtime ownership, client boundaries, and data flow | Sections 2–4 |
| Review AI behavior, user-facing safeguards, or dependencies | Sections 5–7 |
| Assess test coverage, deployment limits, and evidence | Sections 8–9 and [AUDIT_REPORT.md](AUDIT_REPORT.md) |

The source files named in Section 1 remain authoritative when a documentation statement and executable behavior diverge.

## 1. 🧭 Scope and Authoritative Sources

| Concern | Authority |
|---|---|
| Runtime/dependency ranges | `package.json`, `.nvmrc` |
| Dependency resolutions | `package-lock.json` |
| Advisory review | `scripts/dependency-audit.mjs`; no checked-in exception-policy manifest |
| Desired indexes and TTL | `firestore.indexes.json`; deployed readiness requires verification |
| Next configuration | `next.config.ts` |
| Client Firebase variables | `src/firebase/config.ts` |
| Firebase Admin variables | `src/lib/firebase-admin.ts` |
| Current AI models, payload and retry | `src/ai/config/model.ts`, `src/ai/openrouter.ts` |
| AI input/output contracts | `src/ai/question-schema.ts`, `src/ai/flows/*` |
| HTTP API contracts | `src/app/api/**/route.ts`, `src/lib/server-api.ts` |
| Firestore client authorization | `firestore.rules`, `firebase.json` |
| Persisted-data readers | `src/lib/history-schema.ts`, `src/lib/profile-schema.ts` and consumers |
| CI/test execution | `package.json#scripts`, `.github/workflows/ci.yml`, test configs |
| Route-level script budgets | `config/bundle-budgets.json` |
| Descriptive data map | `docs/backend.json`; not a validator |

When documentation differs from an executable authority above, that authority determines current behavior and documentation must be updated in the same change. `backend.json` creates no collection, index, TTL, migration or access policy.

## 2. 🏗️ Runtime Topology and Ownership

The application uses Next.js App Router. `src/app/layout.tsx` owns root HTML, fonts, global CSS, preference provider, Firebase client provider, toast infrastructure and the AI warm-up component. `src/app/page.tsx` coordinates the primary learning flow; separate routes provide login, registration, profile, Forum and Arena.

`AppPreferencesProvider` owns language/theme state, validates local storage, updates `html.lang`/dark class and synchronizes storage events across tabs. `FirebaseProvider` owns one `onAuthStateChanged`; the private subtree is keyed by UID or anonymous so account changes reset private state. Preferences remain outside that subtree.

When `NEXT_PUBLIC_USE_EMULATORS` is `true`, client initialization connects Auth and Firestore to the local demo emulators. The current source does not set a Firestore long-polling option, so WebKit/emulator transport remains a runtime-validation concern. Empty toast viewport space allows pointer events through; visible notifications remain interactive.

Home owns the non-session navigation section. `useLearningSession` owns reducer transitions, stable save IDs and durable completion; `useHistory` owns the paged history source. Quiz owns answers, timer, generation/feedback UI and retries. Navigation reset/unmount invalidates late completions.

Dashboard and Playground are dynamically imported. TensorFlow.js runtime/model load only when Focus Shield is enabled. Root `error.tsx`/`global-error.tsx` and local `ErrorBoundary` handle render failure only; event, request, subscription, camera and clipboard failures must be caught at their source.

## 3. 🗄️ Data Flow and Persisted Data

Primary learning flow:

```text
Setup
  -> academic validation
  -> question generation
  -> Quiz answers/timer/feedback
  -> Result
  -> users/{uid}/history/{id}
  -> Dashboard statistics
```

Playground generates and saves flashcard/practice sessions in user subcollections. Arena creates a public exam through a client Firestore write, then submits attempts through an authenticated Admin API. Forum post creation/edit/like/delete primarily use client Firestore under Rules; comment creation/deletion use an authenticated Admin API, while comment edit/like use client Rules.

### 3.1. 📁 Firestore Paths

| Path | Principal data | Current access |
|---|---|---|
| `users/{uid}` | `displayName`, `email`, `photoURL`, `bio`, `sharkCoins`, timestamps | Signed-in reads; owner writes except `sharkCoins`; Admin may increment coins |
| `users/{uid}/history/{id}` | `userId`, `schemaVersion`, `config`, `quizResults`, `totalTime`, optional `analysis`, ISO `date`, `lang` | Owner read/write |
| `users/{uid}/notes/main` | `content`, `updatedAt` | Owner read/write |
| `users/{uid}/activity/main` | `activeDays`, `updatedAt` | Owner read/write |
| `users/{uid}/flashcards/{id}` | source, cards, ISO `createdAt` | Owner read/write |
| `users/{uid}/practice/{id}` | concept, questions, answers, score, ISO `createdAt` | Owner read/write |
| `posts/{postId}` | post, author, counters, likes, timestamps | Public read; constrained authenticated client mutations |
| `posts/{postId}/comments/{commentId}` | comment, author, likes, timestamps | Public read; Admin create/delete; constrained client edit/like |
| `arenaExams/{examId}` | title, config, questions, author, `totalAttempts` | Public read; constrained author create/update/delete |
| `arenaExams/{examId}/attempts/{attemptId}` | user, score, duration, timestamp | Public read; Admin create only |
| `_requestReceipts/{hash}` | fingerprint, result, createdAt, expiresAt | Admin-only; no client grant |

The `users/{uid}/history` reader uses Zod with defaults for selected legacy omissions; records with corrupt core shape are excluded from the view rather than modified/deleted. The profile reader also normalizes selected missing fields. Forum/Arena boundaries still contain direct casts and are not schema-validated merely because TypeScript compiles.

`activeDays` is a `YYYY-MM-DD -> boolean` map. It records the day the activity calendar runs, not proof of quiz completion. Roadmap checks, language, theme and one-time interface guidance state live in localStorage rather than Firestore. Current keys are `shark_roadmap_checks:{uid}`, the retained legacy key `shark_roadmap_checks`, `shark_lang`, `shark_theme`, `shark_chat_seen`, `shark_help_setup_seen`, `shark_help_dashboard_seen`, `shark_help_playground_seen` and `shark_help_forum_seen`.

### 3.2. 📅 Dates and Timestamps

- Profile, notes, posts, comments, Arena exams/attempts and receipts mainly use native Firestore/server timestamps.
- Quiz history, flashcards and practice sessions currently write ISO strings.
- `StoredDate`/format adapters accept the persisted representations needed by the UI.
- Never change date representation or backfill production data by editing `backend.json` alone.

### 3.3. ⚠️ Known Persistence Limitations

- Quiz and practice await stable-ID saves before completion. Flashcard archival is awaited but failure leaves generated cards usable with an error notice.
- An object containing nested `undefined` can be rejected by Firestore.
- Post deletion does not cascade comments; orphan comments remain publicly readable under current Rules.
- New receipts have seven-day `expiresAt` and remain replayable until asynchronous deletion. TTL and its field index exemption are declared in `firestore.indexes.json`. The 15 September 2026 metadata check found TTL disabled and the posts index missing; an historical configuration attempt failed with IAM 403. `scripts/inspect-firestore.mjs` now provides only a read-only deployed-metadata inspection. `scripts/receipt-retention.ts` independently inventories legacy receipts and backfills missing expiry only with `--apply`.
- `activeDays` writes the complete map from local state, so concurrent tabs/devices can overwrite one another's dates.

These limitations are tracked in the audit; a descriptive data-map edit does not change finding status.

## 4. 🔐 Authentication, Rules, and Server APIs

### 4.1. 🔑 Firebase Authentication

The client uses `GoogleAuthProvider` with popup sign-in. Successful sign-in merges the profile in a transaction. Route Handlers receive `Authorization: Bearer <Firebase ID token>` and `authenticatedUser()` verifies it through Firebase Admin Auth. Missing/invalid/expired tokens produce `AUTH-REQUIRED` or `AUTH-INVALID`.

### 4.2. 🛡️ Firebase Admin Initialization

Outside the Emulator, `src/lib/firebase-admin.ts` initializes from `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL` and `FIREBASE_ADMIN_PRIVATE_KEY`. In the Emulator, both Auth and Firestore host variables must exist and the project must start with `demo-`. Admin SDK bypasses Firestore Rules; API code owns authorization and validation.

### 4.3. 🏆 Arena Submit API

`POST /api/arena/{examId}/submit`

```ts
{
  answers: string[];       // maximum 500; each string maximum 2,000 characters
  duration?: number;       // finite; currently supplied by the client
  requestId?: string;      // UUID; current client sends it for idempotent retry
}
```

The server reads the exam in a transaction, rejects exams without a trusted numeric-answer contract, calculates score, creates an attempt, increments `totalAttempts`, increments coins and writes the receipt in the same transaction. The same UID/scope/requestId and fingerprint returns the saved result; the same ID with a different payload returns `409 APP-REQUEST-CONFLICT`.

Duration is currently only rounded and clamped to zero; it is not corroborated by a server-observed timer but participates in leaderboard tie-breaking. This remains an open integrity limitation.

### 4.4. 💬 Forum Comment API

`POST /api/forum/{postId}/comments`

```ts
{ content: string; requestId?: string }
```

Content is trimmed and constrained to 1–2,000 characters. The API verifies the token, obtains identity from Admin Auth, creates a comment and increments `commentsCount` in an idempotent transaction.

`DELETE /api/forum/{postId}/comments?commentId={commentId}` verifies token, existence and `authorId`, then deletes the comment and decrements the counter transactionally. Delete has no request receipt; post deletion does not cascade its subcollection.

### 4.5. 🚨 Safe Errors

`apiFailure()` returns `{ error, code, values }` JSON. Configuration failure is 503, input parse failure is 400, domain `ApiError` retains its declared status, and unknown failure becomes 500 `APP-REQUEST-FAILED`. Responses must not contain tokens, private keys, raw stacks or provider bodies.

## 5. 🤖 AI Transport and Validation

Seven public Server Actions exist: academic validation, question generation, flashcard generation, practice generation, short-answer analysis, personalized quiz feedback and AI coaching chatbot.

All call `generateStructured()` in `src/ai/openrouter.ts`. Inputs are Zod-parsed at flow boundaries. Outputs are JSON-parsed, Zod-validated and, where required, checked for cross-field constraints such as count, question type, option cardinality/uniqueness and correct-answer membership.

Current model priority:

```text
thinkingmachines/inkling:free
google/gemma-4-31b-it:free
nvidia/nemotron-3.5-lightning:free
```

Gemma receives native JSON Schema; Inkling/Nemotron receive a JSON-only instruction. The adapter checks non-2xx responses and embedded error envelopes. Safe metadata is allowlisted to `operation`, `attemptedModels`, `lastFailure`, `httpStatus`, `providerCode` and `retryAfterSeconds`.

Foreground timeout is 20 seconds per model; warm-up timeout is 8 seconds. Process-scoped `preferredModel` is updated by warm-up or successful requests. Timeout/transport rollover can create five attempts in one Server Action. AI actions currently do not authenticate callers or enforce server-side quotas. These are current-source properties; the target generation protocol, ledger, quota, cancellation and recovery are not implemented. Review the audit and remediation plan before changing transport.

Chat review context occurs once in the system message, prior conversation turns once in provider messages, and the current user input once at the end. The caller supplies prior turns without appending the current turn to history.

## 6. 🖥️ Client Behavior, Internationalization, and Focus Shield

`translations.ts` retains domain copy; `src/lib/i18n` retains common/error/UI messages. Tests enforce VI/EN key and interpolation parity. Brand names, error codes, model identifiers, scientific notation, LaTeX and user content are not automatically translated. Locale changes do not regenerate or translate history.

Quick Notes retains a dirty draft across snapshots and reports success only after the write completes. Forum creation and coordinated edits/deletion use pending locks; editors retain drafts until persistence is confirmed. Setup academic validation has no complete generation/version guard, so a late response can start a quiz after context changes.

Focus Shield:

- starts only after user action;
- requires a secure context (`https` or `localhost`) and camera permission;
- dynamically imports TensorFlow runtime/model;
- uses generation/start guards to reject late resources;
- stops tracks, cancels animation frames and disposes the model during cleanup;
- uses `tf.tidy` and an 800 ms inference throttle.

The 15 September 2026 headed-Chromium check used the local HP Wide Vision HD Camera, produced 640 × 480 video in two start/stop cycles and verified all tracks ended. This does not establish other devices, lighting, permission revocation or exact minimum browser versions.

## 7. 📦 Current Dependency Inventory

`package.json` contains 30 runtime and 19 development dependencies. The lockfileVersion 3 `package-lock.json` currently matches every manifest entry. “Locked” is the direct `node_modules/<package>` resolution in the lockfile; read the lockfile for the transitive graph.

### 7.1. ⚙️ Runtime Dependencies

| Package | Manifest | Locked |
|---|---:|---:|
| `@radix-ui/react-alert-dialog` | `^1.1.6` | `1.1.23` |
| `@radix-ui/react-avatar` | `^1.1.3` | `1.2.6` |
| `@radix-ui/react-checkbox` | `^1.1.4` | `1.3.11` |
| `@radix-ui/react-dialog` | `^1.1.6` | `1.1.23` |
| `@radix-ui/react-dropdown-menu` | `^2.1.6` | `2.1.24` |
| `@radix-ui/react-label` | `^2.1.2` | `2.1.15` |
| `@radix-ui/react-progress` | `^1.1.2` | `1.1.16` |
| `@radix-ui/react-radio-group` | `^1.2.3` | `1.4.7` |
| `@radix-ui/react-scroll-area` | `^1.2.3` | `1.2.18` |
| `@radix-ui/react-select` | `^2.1.6` | `2.3.7` |
| `@radix-ui/react-slot` | `^1.2.3` | `1.3.3` |
| `@radix-ui/react-switch` | `^1.1.3` | `1.3.7` |
| `@radix-ui/react-tabs` | `^1.1.3` | `1.1.21` |
| `@radix-ui/react-toast` | `^1.2.6` | `1.2.23` |
| `@radix-ui/react-tooltip` | `^1.1.8` | `1.2.16` |
| `@tensorflow/tfjs` | `^4.22.0` | `4.22.0` |
| `class-variance-authority` | `^0.7.1` | `0.7.1` |
| `clsx` | `^2.1.1` | `2.1.1` |
| `firebase` | `12.18.0` | `12.18.0` |
| `firebase-admin` | `14.3.0` | `14.3.0` |
| `katex` | `0.18.5` | `0.18.5` |
| `lucide-react` | `1.40.0` | `1.40.0` |
| `next` | `16.3.4` | `16.3.4` |
| `react` | `19.2.8` | `19.2.8` |
| `react-dom` | `19.2.8` | `19.2.8` |
| `recharts` | `3.10.1` | `3.10.1` |
| `server-only` | `0.0.1` | `0.0.1` |
| `tailwind-merge` | `^3.0.1` | `3.6.0` |
| `tailwindcss-animate` | `^1.0.7` | `1.0.7` |
| `zod` | `4.5.4` | `4.5.4` |

### 7.2. 🧪 Development Dependencies

| Package | Manifest | Locked |
|---|---:|---:|
| `@firebase/rules-unit-testing` | `5.0.2` | `5.0.2` |
| `@playwright/test` | `^1.62.1` | `1.62.1` |
| `@tailwindcss/postcss` | `^4.3.3` | `4.3.3` |
| `@testing-library/react` | `^16.3.0` | `16.3.3` |
| `@testing-library/user-event` | `^14.6.1` | `14.6.7` |
| `@types/katex` | `^0.16.7` | `0.16.8` |
| `@types/node` | `^24` | `24.13.3` |
| `@types/react` | `^19.2.1` | `19.2.18` |
| `@types/react-dom` | `^19.2.1` | `19.2.6` |
| `@vitest/coverage-v8` | `4.1.11` | `4.1.11` |
| `eslint` | `9.39.5` | `9.39.5` |
| `eslint-config-next` | `16.3.4` | `16.3.4` |
| `firebase-tools` | `^15.1.0` | `15.29.0` |
| `jsdom` | `30.0.1` | `30.0.1` |
| `postcss` | `^8` | `8.5.27` |
| `tailwindcss` | `^4.3.3` | `4.3.3` |
| `tsx` | `^4` | `4.23.13` |
| `typescript` | `~6.0.0` | `6.0.3` |
| `vitest` | `4.1.11` | `4.1.11` |

Do not add a dependency for behavior already supported by the platform/current Node API. For upgrades, review engines, peer ranges, changelog, advisories and runtime consumers; then run a clean install and the affected suites.

## 8. 🧪 Testing, CI, and Deployment Limitations

| Layer | Config/script | Scope |
|---|---|---|
| Static | `npm run lint`, `npm run typecheck` | ESLint and TypeScript |
| Unit/component | `npm test` | jsdom/node fixtures; no production network |
| Coverage | `npm run test:coverage` | V8 for instrumented suite; not the complete system |
| Rules | `npm run test:rules` | Firestore Rules through Emulator |
| Integration | `npm run test:integration` | Auth/Firestore Emulator and server APIs |
| E2E | `npm run test:e2e` | Next dev or production server, demo Firebase, AI fixture; Chromium desktop/mobile, WebKit and Firefox |
| Build | `npm run build` | Optimized Next artifact; no font-network dependency |
| Production smoke | `npm run test:production` | Six server routes, referenced script chunks, bundle budgets and unauthenticated API behavior |
| Bundle/performance | `npm run report:bundle`, `npm run report:performance` | Build inventory and synthetic dataset baseline; not browser interaction timing |
| Dependency assessment | `npm run audit:dependencies` | Current lockfile query against npm's advisory endpoint; writes a report and has no checked-in exception policy |
| Infrastructure metadata | `node scripts/inspect-firestore.mjs` | Read-only deployed posts-index and receipt-TTL inspection |
| Receipt expiry inventory | `node --conditions=react-server --env-file=.env --import tsx scripts/receipt-retention.ts` | Read-only by default; `--apply` only backfills missing expiry values |
| Browser/camera/query comparison | No checked-in command | Historical evidence is not reproducible from this checkout |
| Live AI | `npm run ai:smoke` | Live OpenRouter; quota/cost possible |

CI runs `npm ci → lint → typecheck → coverage → integration → build → install Chromium/WebKit/Firefox → development E2E → production E2E → bundle report → production HTTP smoke → synthetic performance baseline` on Ubuntu with Node 24/JDK 21. It does not currently run the dependency-audit command, a browser-performance measurement, or an emulator query-comparison command. The workflow configuration does not itself prove that a remote run has succeeded.

The existence or success of a test suite does not establish remote CI, deployed Firestore indexes/Rules, production Vercel runtime, Safari/Firefox minimum versions, physical-camera behavior, live-provider reliability or current vulnerability applicability. Builds use local system font stacks and do not require Google Fonts.

## 9. 📑 Implementation and Validation Evidence

History versions 1 and 2 remain readable permanently; absent versions identify legacy records. Unknown future versions are rejected. Numeric quiz settings are validated separately from draft/persisted strings. `usePagedCollection` limits initial live subscriptions to 50 records and cursor-fetches older pages on demand. Statistics/search/report labels explicitly describe loaded-record scope. Current implementation status and operational validation gaps are tracked in [the audit report](AUDIT_REPORT.md).

The 15 September 2026 local validation recorded lint/typecheck success, 106 unit/component tests across 30 files, seven integration tests, a successful production build and 7/7 corrected development WebKit cases. Production E2E passed 26/28 before the WebKit/toast corrections; the entire corrected production matrix remains pending. The previously inspected hosted run failed development WebKit and did not reach production E2E. A 19 September local reconciliation reran lint, typecheck, the 106-test unit/component suite, and the production build successfully; Firestore Emulator startup then failed before integration assertions with a Java loopback-selector error. These are dated, environment-bound results rather than a claim that every validation is currently reproducible.

The 15 September dependency assessment recorded four moderate findings after the `qs` override was updated to 6.16.0. It is historical evidence only: the current audit script collects advisory data but neither enforces reviewed exceptions nor reads an exception-policy manifest. P04, V01, V02, V03, V04 and V05 remain open within the assigned scope. See [AUDIT_REPORT.md](AUDIT_REPORT.md) for individual criteria.

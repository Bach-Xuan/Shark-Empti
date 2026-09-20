# ⚙️ Configuration, Dependencies, and Troubleshooting · Shark Empti v1.15.1

This guide covers installation, configuration, local validation and release preparation for the current source. Replace example values with credentials for the intended environment, then verify each configured service.

## 🧭 Quick Navigation

| If you need to… | Start with |
|---|---|
| Install and run the project locally | Sections 1–2, then Section 5 |
| Configure Firebase, Admin credentials, or OpenRouter | Sections 3–4 |
| Run emulator, integration, or E2E checks | Section 6 |
| Prepare Vercel or a release | Sections 7–9, together with the validation gaps in [AUDIT_REPORT.md](AUDIT_REPORT.md) |
| Diagnose a local setup failure | [Local troubleshooting](#local-troubleshooting) |
| Coordinate staging and canary acceptance | [Release procedure](#release-procedure) |

Read the sections in order for a first setup. For an existing environment, use the table above to navigate directly to the applicable configuration boundary.

## 1. 🧰 Runtime and Dependency Installation

### 1.1. 📋 Required Prerequisites

| Component | Version/scope | Required for |
|---|---|---|
| Node.js | 24.x | Development, builds, scripts and tests |
| npm | Bundled with Node 24 | Lockfile installation and scripts |
| JDK | 21 | Firebase Emulator integration/rules/E2E |
| Playwright Chromium, WebKit and Firefox | Versions selected by the lockfile | Configured E2E browser matrix |
| Git | A supported version | Clone, review and version control |

`.nvmrc` and `package.json#engines.node` both select major 24. Install Node from [nodejs.org](https://nodejs.org/en/download) or a trusted version manager, then verify:

```powershell
node --version
npm --version
```

Do not continue when Node is not major 24. `@types/node` supplies types; it does not install the runtime.

### 1.2. 📦 Install the Exact Dependency Graph

From the repository root:

```powershell
npm ci
```

`npm ci` is authoritative because the repository contains a lockfileVersion 3 `package-lock.json`. It requires manifest/lockfile consistency, does not rewrite the lockfile and performs a clean installation. It may delete/replace the complete `node_modules`; do not run it concurrently with another dev server, build or test.

Do not use pnpm or Yarn against the same `node_modules`, and do not use `--force` or `--legacy-peer-deps` to conceal peer conflicts. For an intentional dependency change, use npm, review both `package.json` and `package-lock.json`, then validate a fresh `npm ci`.

### 1.3. 🧪 Install Integration/E2E Prerequisites

Install JDK 21, restart the terminal if PATH changed, then run:

```powershell
java -version
npx --no-install playwright install chromium webkit firefox
```

`npx --no-install` requires the locally installed package and avoids fetching an unrelated CLI version. Linux CI uses `npx playwright install --with-deps chromium webkit firefox` for browser system libraries.

## 2. 🔐 Environment File and Variable Matrix

Create `.env` only when it does not already exist:

```powershell
if (-not (Test-Path -LiteralPath .env)) {
  Copy-Item -LiteralPath .env.example -Destination .env
}
```

Next.js reads `.env` for development/build. The two AI scripts use `node --env-file-if-exists=.env`; Node gives existing process variables precedence. Restart the development server and create a new build/deployment after changing `NEXT_PUBLIC_*`, because those values enter the browser bundle.

| Variable | Scope | Required for | Source |
|---|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Browser-visible | Firebase client | Firebase Web App `firebaseConfig.apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Browser-visible | Firebase Auth | `firebaseConfig.authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Browser-visible | Auth/Firestore | `firebaseConfig.projectId` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Browser-visible | Firebase app initialization | `firebaseConfig.storageBucket` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Browser-visible | Firebase app initialization | `firebaseConfig.messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Browser-visible | Firebase app initialization | `firebaseConfig.appId` |
| `OPENROUTER_API_KEY` | Server secret | Seven AI flows and live smoke | Standard OpenRouter API key |
| `AI_GENERATION_PROTOCOL_ENABLED` | Server config | Unset enables local/test and disables production; set `true` only for approved staging or production canary creation | `true` or `false` |
| `FIREBASE_ADMIN_PROJECT_ID` | Server config | Arena, Forum and AI APIs outside Emulator | Service-account JSON `project_id` |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Server secret | Arena, Forum and AI APIs outside Emulator | Service-account JSON `client_email` |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Server secret | Arena, Forum and AI APIs outside Emulator | Service-account JSON `private_key` |
| `NEXT_PUBLIC_USE_EMULATORS` | Test only | Browser connection to local emulators | `true`, supplied by E2E config |
| `FIRESTORE_EMULATOR_HOST` | Test only | Admin/SDK connection to Firestore Emulator | Set by Firebase CLI as `host:port` |
| `FIREBASE_AUTH_EMULATOR_HOST` | Test only | Admin/SDK connection to Auth Emulator | Set by Firebase CLI as `host:port` |
| `GCLOUD_PROJECT` | Test only | Demo Admin app and fixture guard | `demo-shark-empti` |
| `OPENROUTER_TEST_URL` | Test only | Deterministic local AI fixture | `http://127.0.0.1:9098` |

`NODE_ENV` is managed by Next/scripts and does not belong in `.env`. `API_KEYS`, `GEMINI_API_KEY` and `GOOGLE_GENAI_API_KEY` are not read by the current `src` or `scripts`.

## 3. 🔥 Complete Firebase Setup

### 3.1. 🧩 Create a Project and Register a Web App

1. Open the [Firebase Console](https://console.firebase.google.com/) and create/select a project.
2. From Project Overview, select the Web icon (`</>`) or **Add app → Web**.
3. Enter a nickname and select **Register app**. Firebase Hosting is not required by this repository.
4. Open **Project settings → General → Your apps → SDK setup and configuration**.
5. Select the config-object view and map the six fields exactly:

```text
firebaseConfig.apiKey            -> NEXT_PUBLIC_FIREBASE_API_KEY
firebaseConfig.authDomain        -> NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
firebaseConfig.projectId         -> NEXT_PUBLIC_FIREBASE_PROJECT_ID
firebaseConfig.storageBucket     -> NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
firebaseConfig.messagingSenderId -> NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
firebaseConfig.appId             -> NEXT_PUBLIC_FIREBASE_APP_ID
```

Firebase Web configuration identifies/configures the client; it is not an Admin credential. It is intentionally present in the browser bundle, so Authentication, Firestore Rules and server authorization must protect data. See [Firebase Web setup](https://firebase.google.com/docs/web/setup).

### 3.2. 🗄️ Create Cloud Firestore and Deploy Rules

1. In Firebase Console, open **Build → Firestore Database → Create database**.
2. Select the default database in Firestore Native mode and a location appropriate for the deployment. Location is a difficult infrastructure decision to reverse; confirm it before production.
3. Do not retain broad test-mode rules in production. `firestore.rules` is the repository authority and `firebase.json` points to it.
4. Authenticate the CLI, select the exact project and validate Rules in the Emulator before deployment:

```powershell
npx --no-install firebase login
npx --no-install firebase use YOUR_FIREBASE_PROJECT_ID
npm run test:rules
npx --no-install firebase deploy --only firestore:rules
```

Rules deployment mutates remote state and can overwrite Console rules; review the diff, project ID and test result first. Firebase Admin SDK bypasses Firestore Rules, so Route Handlers must still enforce ID tokens, ownership, payloads and transactions. See [Firestore Rules setup and deployment](https://firebase.google.com/docs/firestore/security/get-started).

### 3.3. 👤 Enable Google Authentication

1. Open **Build → Authentication** and complete **Get started** when necessary.
2. Under **Sign-in method**, enable **Google**.
3. Select a support email and save.
4. Add required development/preview/production hostnames to authorized domains in Authentication settings. Supply a hostname, not a URL path.
5. Confirm the local hostname and every Vercel Preview/custom domain that will host authentication.

The application currently uses `GoogleAuthProvider` with popup sign-in. See [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin).

### 3.4. 🔐 Create Firebase Admin Service-Account Credentials

Admin credentials are required only for server APIs outside the Emulator:

1. Open **Project settings → Service accounts** in the exact Firebase project.
2. Select the appropriate service account and **Generate new private key**.
3. Store the JSON outside the repository and do not transmit it through an unsecured chat or ticket.
4. Map these JSON fields into `.env` or the deployment secret manager:

```text
project_id   -> FIREBASE_ADMIN_PROJECT_ID
client_email -> FIREBASE_ADMIN_CLIENT_EMAIL
private_key  -> FIREBASE_ADMIN_PRIVATE_KEY
```

Syntactically representative placeholders:

```dotenv
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk@your-project-id.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Keep the complete PEM header/footer. Current code accepts actual newlines or literal `\n` escapes and normalizes escaped newlines before `cert()`. `FIREBASE_ADMIN_PROJECT_ID` must equal `NEXT_PUBLIC_FIREBASE_PROJECT_ID`; never mix a service account from a different project.

Firebase also documents `GOOGLE_APPLICATION_CREDENTIALS`, but the current code **does not read it**; this repository requires exactly the three `FIREBASE_ADMIN_*` variables in non-emulator runtime. See [Firebase Admin setup](https://firebase.google.com/docs/admin/setup).

Never invent, record or infer a missing private key. If a key is exposed, revoke/delete it in Google Cloud IAM, generate a replacement and redeploy; removing text from a file is insufficient.

## 4. 🤖 OpenRouter Setup

1. Sign in to OpenRouter and open [API Keys](https://openrouter.ai/settings/keys).
2. Create a **standard API key** for completion requests. Do not use a Management API key; management keys administer other keys and cannot call completion endpoints.
3. Name keys per environment, such as `shark-empti-development` and `shark-empti-production`.
4. Where supported, assign an appropriate spending limit/expiration and isolate development, preview and production keys for rotation/audit.
5. Copy the plaintext key when issued and store it in secret storage:

```dotenv
OPENROUTER_API_KEY=your_openrouter_api_key
```

Never place this key in `NEXT_PUBLIC_*`, source code, screenshots, logs or committed fixtures. OpenRouter uses Bearer authentication for Chat Completions; see the [OpenRouter Quickstart](https://openrouter.ai/docs/quickstart) and [API-key management](https://openrouter.ai/docs/guides/overview/auth/management-api-keys).

### 4.1. ✅ Validate the Key and AI Contract

```powershell
npm run ai:health
npm run ai:smoke
```

- `ai:health` authenticates the supplied key through `GET /api/v1/key`, checks its reported spending cap, then checks all configured models in the public catalogue. A single 10-second deadline covers requests and response bodies. Diagnostics exclude credentials and upstream response bodies. Authentication and catalogue success **do not prove live inference, account credits or model-specific quota availability**. See the [current-key endpoint](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-key).
- `ai:smoke` generates one real quiz and chatbot response through the live single-attempt OpenRouter adapter. It validates provider inference and operation schemas, but does not exercise Firebase authentication, the generation ledger, quota or browser recovery. It may consume quota and does not run in CI.
- Never print the key for debugging. Inspect only variable names/presence and safe status/error codes.

### 4.2. 🔄 Current AI Transport

The current source sends `POST https://openrouter.ai/api/v1/chat/completions`. Its nominal server-side priority is:

1. `thinkingmachines/inkling:free`;
2. `google/gemma-4-31b-it:free`;
3. `nvidia/nemotron-3.5-lightning:free`.

The server fixes the model order and permits each ordinal once, up to three attempts per generation. Each attempt-route invocation makes at most one OpenRouter request with a 20-second provider deadline. The browser submits neither a model name nor an attempt number.

A short-lived Firestore ledger coordinates idempotency, leases, cancellation and recovery. Per-user and global quotas are reserved transactionally. See the [AI request lifecycle](TECHNICAL_DOCUMENTATION.md#ai-request-lifecycle) for the interaction between browser, API and ledger.

Production-mode generation creation requires `AI_GENERATION_PROTOCOL_ENABLED=true`. Use this flag within the staged verification process described in the [release procedure](#release-procedure); broader enablement depends on duration, recovery, quota, TTL and telemetry acceptance.

## 5. 💻 Local Execution

After dependencies and `.env` are ready:

```powershell
npm run dev
```

Open `http://localhost:9002`. At minimum, verify:

1. The page renders without a Firebase initialization error.
2. The Google popup signs in and returns to the correct origin.
3. Firestore reads/writes are allowed only as intended by Rules.
4. An AI flow returns a structured result for a signed-in user when both OpenRouter and Admin credentials are configured.
5. Arena creation/submission and Forum post deletion or comment creation/deletion work through the authenticated Admin APIs.

Missing Admin credentials do not mean the Firebase Web config is invalid; they make Admin Route Handlers return `APP-CONFIG-MISSING`. A missing OpenRouter key produces `AI-CONFIG-MISSING` without preventing Firebase-only features from rendering.

<a id="local-troubleshooting"></a>

### 5.1. Local Troubleshooting

| Symptom | Check first | Next step |
|---|---|---|
| Firebase initialization fails | Six Web configuration fields and selected project | Correct values using Section 3.1; restart the app and rebuild after public-variable changes |
| Google sign-in fails | Google provider and authorized hostname | Check Section 3.3 and confirm the popup returns to the intended origin |
| API returns `APP-CONFIG-MISSING` | Three Admin variables and matching project IDs | Check Section 3.4 without printing credential values |
| AI returns `AI-CONFIG-MISSING` | Server-side OpenRouter key | Follow Section 4.1; health success alone does not validate the full AI protocol |
| AI is unavailable in a production build | Feature flag, authenticated session and server credentials | Confirm the intended staging/canary scope before enabling generation creation |
| Integration tests fail before assertions | JDK, Emulator ports and temporary directory | Use the diagnostics and Windows workaround in Section 6 |
| Arena leaderboard query fails | Readiness of the target project's composite index | Follow Section 5.2 and the metadata inspection procedure in Section 9.2 |

### 5.2. Arena Timing and Ranking Deployment

Deploy the `attempts` composite index declared in `firestore.indexes.json` before releasing the new leaderboard query: `timingVersion ASC`, `score DESC`, `duration ASC`, and document ID `ASC`. Confirm that the index is ready on the target project; Emulator query success does not prove production index readiness. The UI reports query failures and offers retry.

Arena starts create private `_arenaSessions` documents with a 24-hour logical lifetime and `expiresAt` TTL declaration. Activate the TTL policy in the target project to bound abandoned-session storage; expiry is enforced by API code even when TTL cleanup is delayed. Browser reads/writes are denied. Release the start API and matching client together: submissions require the UUID returned by the start request. Older attempts remain stored but are excluded from the new ranking because their elapsed time cannot be verified retroactively. No production index/TTL activation is implied by these local changes.

## 6. 🧪 Emulator and Test Execution

Configured ports:

| Service | Port |
|---|---|
| Next app | 9002 |
| Firebase Auth Emulator | 9099 |
| Firestore Emulator | 8080 |
| Deterministic AI fixture | 9098 |

Run the scope needed:

```powershell
npm test
npm run test:rules
npm run test:integration
npm run test:e2e
```

`test:rules` and `test:integration` use `firebase emulators:exec --project demo-shark-empti`; the CLI supplies emulator host variables. E2E supplies browser demo Firebase configuration and a fake OpenRouter key in `playwright.config.ts`. Source guards reject `OPENROUTER_TEST_URL` in production, off localhost or outside a demo Emulator context.

If Windows/JDK reports UnixDomainSockets or loopback errors caused by a TEMP path, use a dedicated ASCII-only directory for that test shell:

```powershell
New-Item -ItemType Directory -Force C:\Users\Public\shark-empti-java-tmp
$env:JAVA_TOOL_OPTIONS='-Djava.io.tmpdir=C:\Users\Public\shark-empti-java-tmp -Djdk.net.unixdomain.tmpdir=C:\Users\Public\shark-empti-java-tmp'
npm run test:integration
```

Do not delete TEMP or a user directory. Do not run two Emulator suites on the same ports. `vitest.integration.config.mts` intentionally fails when either Auth or Firestore Emulator is absent.

## 7. ☁️ Vercel and the Production Environment

1. Import the repository into Vercel and confirm the Next.js Framework Preset.
2. Select Node.js 24.x under **Project Settings → Build and Deployment**.
3. Under **Project Settings → Environment Variables**, add the six `NEXT_PUBLIC_FIREBASE_*` values and four server credentials (`OPENROUTER_API_KEY` plus three `FIREBASE_ADMIN_*`) to the correct Development, Preview and Production scopes. Add `AI_GENERATION_PROTOCOL_ENABLED=true` only to an approved staging environment or production canary.
4. Mark server credentials sensitive where supported; do not reuse an unrestricted development key in production.
5. Create a new deployment after every env change; changes are not retroactive.
6. Add Vercel/custom hostnames to Firebase Authentication authorized domains.
7. Deploy `firestore.rules` separately after verifying the project ID and Emulator tests; a Vercel deployment does not deploy Firebase Rules.
8. Run controlled smoke tests on Preview before Production and inspect Function duration/logs for AI requests.

There is no `vercel.json` in this repository; dashboard/project defaults are the out-of-repository deployment authority. See [Vercel environment variables](https://vercel.com/docs/environment-variables) and [Vercel project settings](https://vercel.com/docs/project-configuration/project-settings).

## 8. 🛡️ Credential Security and Rotation

- `.env`, `.env.*`, service-account JSON, `.pem`, `.key`, `.vercel` and test artifacts are protected by `.gitignore`; `.env.example` remains tracked.
- `NEXT_PUBLIC_*` values are not secrets.
- Firebase Admin and OpenRouter keys require an owner, environment, rotation date and revocation procedure.
- Never store credentials in the audit, Markdown, issues, screenshots, console output or Playwright traces.
- Inspect headers, request payloads and storage state before sharing failure artifacts.
- If a secret was committed, revoke/rotate it first, then handle Git history through a separately approved procedure. Adding an ignore rule does not remove history.

## 9. ✅ Release Checklist

```powershell
npm ci
npm run audit:dependencies
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run report:performance
npm run build
npx --no-install playwright install chromium webkit firefox
npm run test:e2e
$env:E2E_PRODUCTION='true'
npm run test:e2e
Remove-Item Env:E2E_PRODUCTION
npm run test:production
```

The first E2E run uses the development server; the second uses the optimized build. CI also records the bundle inventory and synthetic performance baseline. Browser installation requires the relevant host libraries. Consult [the audit report](AUDIT_REPORT.md) for dated results and outstanding browser acceptance evidence.

The commands above establish local evidence. Before release, complete the environment-specific checks below and review each open finding's acceptance criteria in [AUDIT_REPORT.md](AUDIT_REPORT.md).

| Release area | Required evidence |
|---|---|
| Dependencies and hosting | Current dependency assessment; confirmed production Runtime/Function settings and hosted CI result |
| Firestore | Deployed Rules, ready posts/Arena indexes and active receipt, AI-generation, AI-quota and Arena-session TTL policies |
| AI protocol | Live provider validation, staging recovery/concurrency checks, calibrated quotas and controlled canary acceptance |
| Browser and device support | Corrected production E2E matrix, documented minimum browser targets and physical-camera checks |
| User-visible scope | Confirm labels describe loaded-record search/statistics/reports; initial pages contain at most 50 records |

The AI feature flag remains disabled outside approved staging/canary scopes. Production builds use local system fonts and require no Google Fonts download.

The public-data changes require coordinated deployment of server routes, client assets and Firestore Rules: Arena creation now uses `POST /api/arena`, and post deletion uses `DELETE /api/forum/{postId}`. Old browser create/delete paths are denied by the new Rules. `_forumDeletions` records deliberately have no TTL; they retain owner recovery and post-ID reuse protection. No production deployment or legacy data sweep is implied by local verification.

Optional print-layout verification runs independently of the Firebase emulators:

```powershell
$env:REPORT_PRINT_BROWSER='chrome' # alternatively msedge, chromium, firefox or webkit
node node_modules/vitest/vitest.mjs run tests/report-print.browser.test.tsx
Remove-Item Env:REPORT_PRINT_BROWSER
```

The selected browser must be installed. The test renders the actual print component with long English/Vietnamese fixtures in both themes; Chromium writes multipage PDFs to ignored `tmp/pdfs/`. Without the environment opt-in, the ordinary unit suite skips these checks. Coverage is limited to the print fixture; authenticated profile flows, native print preview and physical printers require separate verification. Dated results belong in [the audit report](AUDIT_REPORT.md).

### 9.1. 🔍 Dependency Assessment

`npm run audit:dependencies` sends resolved package names and versions to npm and writes `reports/dependency-audit.json` with the lockfile SHA-256 and measurement time. `config/dependency-audit-policy.json` blocks high/critical advisories; registry errors also fail validation. Low/moderate findings remain visible and are not approved exceptions. The checked-in CI workflow runs the command after installation. Rerun it before making a current advisory claim; V04 in [the audit report](AUDIT_REPORT.md) records dated evidence.

<a id="retention-operations"></a>

### 9.2. 🧾 Receipt and AI-Ledger Retention and Index Operations

New receipts carry `expiresAt` seven days after creation and remain replayable until asynchronous deletion. AI generation and quota records also carry short-lived expiry fields; Arena timing sessions have a 24-hour logical lifetime. The [technical documentation](TECHNICAL_DOCUMENTATION.md) distinguishes retention from application-enforced expiry.

`firestore.indexes.json` declares the desired posts/Arena indexes and TTL settings for `_requestReceipts`, `_aiGenerations`, `_aiQuota` and `_arenaSessions`. Inspect deployed state from the repository root:

```powershell
node scripts/inspect-firestore.mjs
```

The script loads the Admin identity from `.env`, reads indexes and all four TTL policies, and writes `reports/firestore-metadata.json`. It does not change remote configuration. This checkout has no package command or source file that applies indexes or TTL policies; use a separately authorized infrastructure workflow, then repeat the inspection to verify readiness.

For legacy data, `node --conditions=react-server --env-file=.env --import tsx scripts/receipt-retention.ts` inventories missing expiry values; adding `--apply` backfills them without directly deleting receipts. Its `alreadyExpired` counter concerns missing-expiry records whose calculated expiry is past, not every expired document. Deployment attempts and IAM outcomes are tracked in [the audit report](AUDIT_REPORT.md), rather than repeated in this operational guide.

### 9.3. 📊 Local Measurements and Evidence Boundaries

- `npm run report:performance` measures synthetic processing and serialized-data cardinality for 100, 1,000, and 10,000 history records. It is not a browser, Firestore-billing, heap, or interaction benchmark.
- `npm run report:browser` requires a production build configured for demo Firebase and installed Playwright Chromium. It starts local Emulators and measures five cold/warm pairs for `/login`, `/forum` and `/arena`, including heap, DOM, resource bytes and Forum input-to-frame timing. Output is `reports/browser-performance-current.json`; the fixture covers guest routes with empty demo data.
- `npm run report:queries` creates an isolated `_performanceComparison` fixture in the local demo Emulator, compares unrestricted and `limit(50)` queries at 100/1,000/10,000 records, writes `reports/query-comparison.json`, and removes its fixture. Returned documents and serialized JSON sizes are not production billing or wire-byte measurements.
- For historical comparison, supply an independently prepared source checkout through `PERFORMANCE_BASELINE_ROOT`. Build both trees with the same Node, installed dependency graph, demo build variables and build command; then run `npm run report:comparison`. The runner controls Chromium, viewport, guest state and cache sequence, checks runtime metadata, and writes raw samples plus `reports/performance-comparison.json`. Record the source revision and normalized dependency differences. Five samples per condition support exploratory comparisons, including regressions.
- `npm run test:coverage` writes whole-source unit/component coverage to `coverage/unit/`. Adding `--coverage` to the Vitest command inside an Emulator integration run writes the AI routes, ledger, body parser and server API coverage to `coverage/integration/`. These overlapping denominators must not be added together.
- Physical-camera verification still requires device access and separate tooling; browser performance does not reproduce the historical camera result.

Current verification scripts print or write their evidence when explicitly run. Bundle, dependency-audit, Firestore-metadata, and synthetic-performance commands generate machine-readable artifacts. GitHub operations require the user's explicit request, including pushes, pull requests and workflow actions.

<a id="release-procedure"></a>

### 9.4. Staging and Canary Procedure

This procedure organizes the existing acceptance requirements. It does not record a completed deployment or supply unmeasured cost, latency or traffic thresholds.

1. **Identify the release candidate.** Record the source revision, lockfile hash, target environment and configuration changes. Run the local checklist and retain the relevant reports with their dates and environment details.
2. **Prepare staging infrastructure.** Confirm the target Firebase project, authorized domains, server credentials, Function duration and region. Coordinate client assets, server routes and Rules; verify indexes and all four TTL policies through Section 9.2. Preserve Forum tombstones.
3. **Validate staging behavior.** Enable AI creation only within the approved staging scope. Exercise response loss, duplicate/concurrent claims, cancellation, quota rejection and all seven AI operations. Correlate requests using non-sensitive generation identifiers and verify the one-provider-call-per-invocation boundary. Run the corrected production browser matrix and record device checks separately.
4. **Define canary acceptance before exposure.** Assign a release owner and specify the allowed scope, observation period, cost/latency/error thresholds and stop conditions. Calibrate the current 30/300 weighted quota budgets using staging evidence. M01 and F01 remain open until their deployed acceptance requirements are met.
5. **Run and assess the canary.** Enable creation in the approved production scope, retain content-free telemetry and compare observations with the agreed criteria. If criteria fail, disable new production generation creation through the feature flag and deploy the updated configuration. The flag controls creation; it must not be treated as cancellation of in-flight generations or reversal of persisted mutations.
6. **Record the decision.** Attach dated evidence to the relevant audit findings before broader release. Record unresolved failures and recovery work. Coordinate any client/server/Rules rollback as a separate release change, since older clients may use paths that current Rules deny.

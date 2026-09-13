# ⚙️ Configuration, Dependencies, and Troubleshooting · Shark Empti v1.15.1

This document describes the configuration actually consumed by the current source. Placeholders do not configure a service, and the existence of `.env` does not prove that a credential is valid.

## 1. 🧰 Runtime and Dependency Installation

### 1.1. 📋 Required Prerequisites

| Component | Version/scope | Required for |
|---|---|---|
| Node.js | 24.x | Development, builds, scripts and tests |
| npm | Bundled with Node 24 | Lockfile installation and scripts |
| JDK | 21 | Firebase Emulator integration/rules/E2E |
| Playwright Chromium | Version selected by the lockfile | Desktop/mobile E2E |
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
npx --no-install playwright install chromium
```

`npx --no-install` requires the locally installed package and avoids fetching an unrelated CLI version. Linux CI uses `npx playwright install --with-deps chromium` for browser system libraries.

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
| `FIREBASE_ADMIN_PROJECT_ID` | Server config | Arena/Forum Admin APIs outside Emulator | Service-account JSON `project_id` |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Server secret | Arena/Forum Admin APIs outside Emulator | Service-account JSON `client_email` |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Server secret | Arena/Forum Admin APIs outside Emulator | Service-account JSON `private_key` |
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

- `ai:health` confirms that a key is present, calls the model catalogue and checks that all three fallback models are listed. The catalogue may return 200 for an invalid key, so this command **does not prove authentication, quota or inference**.
- `ai:smoke` generates one real quiz and chatbot response through the live transport. It may consume quota and does not run in CI.
- Never print the key for debugging. Inspect only variable names/presence and safe status/error codes.

### 4.2. 🔄 Current AI Transport

The current source sends `POST https://openrouter.ai/api/v1/chat/completions`. Its nominal server-side priority is:

1. `thinkingmachines/inkling:free`;
2. `google/gemma-4-31b-it:free`;
3. `nvidia/nemotron-3.5-lightning:free`.

The effective first model is not fixed: process-scoped `preferredModel` is updated after a successful foreground request or warm-up, and `orderedModels(preferredModel)` begins a later request from that model before appending the remaining nominal-priority models. Each foreground attempt has a 20-second timeout; warm-up uses 8 seconds. A timeout/transport rollover can make one generation perform up to five attempts in the same Server Action. This is the audited current state, not the target architecture. Do not address remediation by changing only the timeout or treating every HTTP 400/403 as retryable; see [AUDIT_REPORT.md](AUDIT_REPORT.md) and [AI_TRANSPORT_REMEDIATION_PLAN.md](AI_TRANSPORT_REMEDIATION_PLAN.md).

## 5. 💻 Local Execution

After dependencies and `.env` are ready:

```powershell
npm run dev
```

Open `http://localhost:9002`. At minimum, verify:

1. The page renders without a Firebase initialization error.
2. The Google popup signs in and returns to the correct origin.
3. Firestore reads/writes are allowed only as intended by Rules.
4. An AI flow returns a structured result when an OpenRouter key is present.
5. Arena submission and Forum comment APIs work when Admin credentials are present.

Missing Admin credentials do not mean the Firebase Web config is invalid; they make Admin Route Handlers return `APP-CONFIG-MISSING`. A missing OpenRouter key produces `AI-CONFIG-MISSING` without preventing Firebase-only features from rendering.

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
3. Under **Project Settings → Environment Variables**, add the six `NEXT_PUBLIC_FIREBASE_*` values and four server values (`OPENROUTER_API_KEY` plus three `FIREBASE_ADMIN_*`) to the correct Development, Preview and Production scopes.
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
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npx --no-install playwright install chromium
npm run test:e2e
```

Release also requires a current dependency audit, production Runtime/Function settings, Firestore indexes, deployed Rules, Safari/Firefox targets, a physical camera and live OpenRouter validation. The build currently depends on Google Fonts network access through `next/font/google`; a network-restricted build can fail even when source, types and unit tests are valid.

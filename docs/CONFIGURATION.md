# ⚙️ Configuration, Dependencies and Troubleshooting · Shark Empti v1.15.1

This guide configures the application and its release environment. See [README](../README.md), [architecture](TECHNICAL_DOCUMENTATION.md), [validation](VALIDATION.md), [account operations](ACCOUNT_OPERATIONS.md), the [data map](backend.json) and [audit register](AUDIT_REPORT.md). Runtime behavior is determined by source, Rules and configuration, not this guide alone.

## 🧰 Runtime and dependencies

Install Node **24.x** with npm, JDK 21 for Firebase Emulators, and browser dependencies for Playwright. Run `npm ci` from the repository root; it requires `package.json` and `package-lock.json` to agree and can replace `node_modules`. Do not mix Yarn/pnpm into the same installation. Install engines with:

```powershell
npx --no-install playwright install chromium firefox webkit
```

Use [validation](VALIDATION.md) to select tests and interpret results. Package versions and peer requirements belong to the manifest/lockfile. Dependency assessment queries npm and applies `config/dependency-audit-policy.json`; maintenance checks declarations/lock agreement but does not assess advisories.

## 🔐 Environment file and variable matrix

Create `.env` only when absent; Next reads it for development/build. Existing process variables take precedence for Node scripts. Rebuild after changing `NEXT_PUBLIC_*`: those values are embedded in the browser bundle. Never commit or print secrets. `.env.example` is the complete template.

```powershell
if (-not (Test-Path -LiteralPath .env)) {
  Copy-Item -LiteralPath .env.example -Destination .env
}
```

| Variables | Scope and use |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Web configuration; browser-visible. Auth/Firestore are used; Storage/Messaging are not initialized. |
| `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` | Server Admin credentials for authenticated APIs outside Emulators; project must match the Web project. |
| `OPENROUTER_API_KEY` | Server-only standard completion key for AI. |
| `AI_GENERATION_PROTOCOL_ENABLED` | Unset enables local/test and disables production creation; explicitly enable only for a scoped rollout. |
| `SITE_URL` | Verified public canonical origin; not a secret. |
| `NEXT_PUBLIC_USE_EMULATORS`, `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `GCLOUD_PROJECT`, `OPENROUTER_TEST_URL` | Isolated local test settings supplied by test tooling; never target production. |
| `RETENTION_ENABLED` | Enable signed Firestore-only cleanup with QStash and job origin/environment, without B2 or account jobs. Set up its hourly maintenance schedule separately. |
| `ACCOUNT_JOBS_ENABLED`, `ACCOUNT_BACKUPS_ENABLED`, `JOB_ENVIRONMENT`, `JOBS_BASE_URL`, `QSTASH_*`, `B2_*`, `JOB_ENCRYPTION_KEY`, `RESTORE_ADMIN_*` | Server-only background jobs and isolated restore. Defaults remain disabled; setup and exact permissions are in [account operations](ACCOUNT_OPERATIONS.md). |

`NODE_ENV` is managed by Next/scripts, not `.env`. `API_KEYS`, `GEMINI_API_KEY` and `GOOGLE_GENAI_API_KEY` are not used by current source/scripts. Public Web configuration identifies the client; Rules/API authorization protect data. Do not put Admin/OpenRouter/QStash/B2/encryption credentials in `NEXT_PUBLIC_*`, source, logs, reports or screenshots.

## 🔥 Firebase setup

1. In [Firebase Console](https://console.firebase.google.com/), create/select the intended project and register a Web app under **Project settings → General → Your apps**. Copy `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` to the matching `NEXT_PUBLIC_FIREBASE_*` names in `.env.example`.
2. Create the default Cloud Firestore database in Native mode and select its location deliberately. Do not leave broad test-mode Rules enabled.
3. In **Authentication → Sign-in method**, enable Google and choose the support email. Add the exact local, preview and production hostnames to authorized domains. The client uses popup sign-in.
4. Under **Project settings → Service accounts**, generate an appropriate private key and protect the JSON outside the repository. Map `project_id`, `client_email`, `private_key` to `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`. Keep the PEM header/footer and escaped newlines. The current application uses these three values rather than `GOOGLE_APPLICATION_CREDENTIALS`.
5. Run `npm run test:rules` against the Emulator before applying `firestore.rules` and `firestore.indexes.json` to the explicitly identified target. Rules deployment overwrites remote rules; coordinate client/server/Rules/indexes and check index readiness. Admin SDK bypasses Rules, so server routes still enforce ownership and validation. See [Firebase Rules deployment](https://firebase.google.com/docs/firestore/security/get-started).

The server accepts literal `\n` escapes or actual newlines inside the quoted PEM value. Keep the surrounding header/footer and match both project IDs; an illustrative template is already in `.env.example`. Web values are configuration, not proof of authorization. [Firebase Web setup](https://firebase.google.com/docs/web/setup) and [Admin setup](https://firebase.google.com/docs/admin/setup) describe the console flows.

For an explicitly identified target, the CLI workflow is:

```powershell
npm run test:rules
npx --no-install firebase login
npx --no-install firebase deploy --project YOUR_FIREBASE_PROJECT_ID --only 'firestore:rules,firestore:indexes'
```

Review the target and changes before executing the deployment; confirm index readiness afterwards. The CLI login identity and Admin runtime service account have separate permissions. Preserve Forum tombstones and private Arena keys/eligibility when planning deployment or recovery.

Do not infer a missing private key or assume local credentials point to a staging project. If a key is exposed, revoke/rotate it and update the deployment; `.gitignore` alone does not remove committed history.

## 🤖 OpenRouter setup

Create a **standard** completion key in [OpenRouter API Keys](https://openrouter.ai/settings/keys), preferably scoped and limited per environment. Put it only in `OPENROUTER_API_KEY` server secrets; do not use a management key for completion calls. Current model priority is Inkling → Gemma → Nemotron, selected by the server. An invocation makes at most one provider call, with up to three ordinals per generation; the ledger coordinates quotas, leases and recovery. See [AI lifecycle](TECHNICAL_DOCUMENTATION.md#ai-request-lifecycle).

`npm run ai:health` authenticates the key and checks model catalogue metadata under a ten-second deadline; it does not prove inference, credits or model quota. `npm run ai:smoke` performs real quiz/chat generation through the adapter and may consume quota; it does not test the authenticated ledger/recovery workflow. Keep production creation disabled until the intended rollout is accepted.

## 💻 Local execution

```powershell
npm run dev
```

Open [localhost:9002](http://localhost:9002). Client and Admin Firebase project IDs must match. Camera access requires a secure context and explicit permission. A missing provider key disables AI, not the static public pages.

<a id="local-troubleshooting"></a>
### Local troubleshooting

| Symptom | Check |
|---|---|
| Firebase initialization/sign-in fails | Six Web variables, matching project, Google provider, authorized hostname and restart/rebuild after public env changes. |
| Server returns configuration/auth errors | Admin project/email/key formatting, matching project and current Firebase ID token; do not print credentials. |
| AI unavailable | OpenRouter key, model availability, account quota and production feature flag; health and live smoke cover different scopes. |
| Rules/integration cannot connect | JDK 21, both demo Emulators and free loopback ports; see the Windows socket fallback in [validation](VALIDATION.md#prerequisites-and-isolation). |
| Browser runner rejects a build | Rebuild with `npm run build:demo`; runtime env overrides cannot replace embedded public config. |
| Camera fails | HTTPS/localhost, browser/OS permission and device availability; stop/retry the feature. |

## 🧪 Tests and environment isolation

The app normally uses port 9002; Firestore, Auth and AI fixture use 8080, 9099 and 9098. `npm run test:rules`, `npm run test:integration` and `npm run test:e2e` use demo Firebase/Emulators; do not run concurrent suites on the same ports. E2E uses a fake AI provider and blocks external requests. Production browser checks require the verified `npm run build:demo` artifact and `E2E_PRODUCTION=true`; source/assets/lock/config changes invalidate its fingerprint. The [validation guide](VALIDATION.md) provides the complete commands, browser/print checks and interpretation.

## ☁️ Vercel and deployment

1. Import the repository into Vercel with the Next.js preset and Node 24. Set the six public Web variables, three Admin variables and OpenRouter key in the appropriate Development, Preview and Production scopes; mark secrets sensitive where supported. Separate test/production credentials.
2. Set `SITE_URL` to the verified production origin. Redeploy after environment changes and add deployment hostnames to Firebase Authentication authorized domains. Vercel-generated `vercel.app` URLs do not require purchasing a custom domain.
3. Verify the exact Firebase project before deploying Rules/indexes separately. Coordinate API/client/Rules changes: Arena V2 protects answer keys and eligibility; Forum mutation APIs enforce budgets. Inventory and back up legacy Arena exams before any separately scoped practice-only migration.
4. Confirm Function duration/region, IAM, ready indexes, signed retention delivery and rollback plan. Use the [release procedure](#release-procedure), [audit](AUDIT_REPORT.md) and [account operations](ACCOUNT_OPERATIONS.md) for remaining acceptance and provider setup.

There is no `vercel.json`; dashboard settings govern hosting. Never assume Preview uses a separate Firebase database merely because the website URL differs. Local Emulator success does not verify remote Rules or IAM.

## 🛡️ Credential security

`.env`, service-account JSON, private keys, deployment config and generated artifacts are ignored; `.env.example` remains tracked. Avoid secrets and learner data in issues, traces and screenshots. Assign credentials an owner, environment and rotation procedure. Revoke exposed keys before replacing them; an ignore rule cannot remove a secret from Git history. The encryption key needs a protected recovery copy and a reviewed re-encryption/receipt transition for rotation.

<a id="release-procedure"></a>
## ✅ Release procedure

Identify the candidate revision, dependency lock, target, configuration and owner. Run the relevant local checks in [validation](VALIDATION.md). Confirm expected live origin, Rules/indexes, signed retention, hosting runtime and access; compare deployed assets with the candidate. Before AI canary, establish account scope, duration and measurable error/latency/quota stop criteria; test response loss, cancellation, lease expiry and all seven operations with non-sensitive correlation IDs. Stop on incorrect authorization, data loss/duplication or breached attempt limits. Disabling creation does not cancel already dispatched requests or reverse persisted writes.

Account jobs/backups remain disabled until their provider and recovery gates in [account operations](ACCOUNT_OPERATIONS.md) are satisfied. The audit records 74 findings, including 11 outstanding findings and five owner-accepted local closures with deployment verification deferred. Actual production/camera/hosted CI/provider validation remains distinct from local tests.

<a id="retention-operations"></a>
## 🧾 Retention and index operations

`firestore.indexes.json` declares feed/ranking/report/job and ordinary expiry indexes; the Spark design does not request native TTL. Receipts are logically replayable while retained, with expiry at seven days; AI/Arena sessions have 24-hour bounds. Signed bounded cleanup removes eligible expired data asynchronously. Forum deletion tombstones have no TTL. See [retention](ACCOUNT_OPERATIONS.md#retention-on-spark).

`node scripts/inspect-firestore.mjs` reads the project from `.env`, inspects configured composite/field indexes and unexpected native TTL and writes `reports/firestore-metadata.json`; it makes no remote configuration changes. `node --conditions=react-server --env-file=.env --import tsx scripts/receipt-retention.ts` inventories legacy receipt expiry; `--apply` backfills missing expiry and mutates records. Confirm the target and scope before running either against real infrastructure.

<a id="maintenance-and-generated-artifacts"></a>
## 🧹 Maintenance and generated artifacts

Run `npm run check:maintenance` after changing imports, package metadata, docs or output paths. It verifies direct declarations/lock, documented npm scripts/local file links, compiler/lint scope and Git ignore boundaries; it does not test remote services or link anchors.

| Scope | Treatment |
|---|---|
| `.next/` | `npm run clean` removes the generated build; rebuild before production checks. |
| `.next/cache/`, `.next/dev/`, `.tools/tmp/` | `npm run clean:cache` removes eligible cache/scratch trees. |
| `coverage/`, `test-results/`, Playwright reports, `tmp/pdfs/`, debug logs, `reports/` | `npm run clean:artifacts` removes eligible disposable results after recording required conclusions. |
| Installed `.tools` runtimes, `node_modules`, `.env`, source/docs/lock | Retain; they are outside artifact cleanup. |

Artifact/cache cleanup defaults to seven days and retains an entire tree containing a recent item. Stop relevant processes and inspect `npm run clean:artifacts -- --dry-run` and `npm run clean:cache -- --dry-run`; `--older-than-days=0` selects all ages. Cleanup uses fixed scopes, refuses tracked content/linked roots and does not traverse nested links. Preserve official tests and licenses; remove task-temporary tests, fixtures and results after recording conclusions. See [validation](VALIDATION.md#results-and-cleanup).

## 💾 Backup and incidents

Use the encrypted daily backup and isolated restore procedure in [account operations](ACCOUNT_OPERATIONS.md#backup-and-isolated-restore). RPO 24 hours/RTO four hours are targets pending a timed, realistic quota/restore drill. During incidents retain a read-only diagnosis, keep risky writes disabled, verify recovery against the current deletion journal and reconcile Auth, Rules, indexes, jobs and retained data before reopening access. Restore is not automatically a production cutover.

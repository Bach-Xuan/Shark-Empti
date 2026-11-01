# ⚙️ Configuration, Dependencies and Troubleshooting · Shark Empti v2.0.0 **β**

This guide configures the application and its release environment. See [README](../README.md), [architecture](TECHNICAL_DOCUMENTATION.md), [validation](VALIDATION.md), [account operations](ACCOUNT_OPERATIONS.md), the [data map](backend.json) and [audit register](AUDIT_REPORT.md). Runtime behavior is determined by source, Rules and configuration, not this guide alone.

## 🧰 Runtime and dependencies

Install Node **24.x** with npm, JDK 21 for Firebase Emulators, and browser dependencies for Playwright. Run `npm ci` from the repository root; it requires `package.json` and `package-lock.json` to agree and can replace `node_modules`. Do not mix Yarn/pnpm into the same installation. Install engines with:

```powershell
npx --no-install playwright install chromium firefox webkit
```

Use [validation](VALIDATION.md) to select tests and interpret results. Package versions and peer requirements belong to the manifest/lockfile. Dependency assessment queries npm and applies `config/dependency-audit-policy.json`; maintenance checks declarations/lock agreement but does not assess advisories.

The Firebase CLI development dependency has a `^15.34.2` floor for its supported patched CSV/streaming JSON stack. Keep the npm lockfile and use its installed CLI for Emulators; do not restore the removed get-uri/basic-ftp override. The separate Firestore/gRPC override remains intentional. Compatible-parent upgrades and unresolved advisory paths are recorded in the [audit register](AUDIT_REPORT.md#v04-dependency-risk-assessment-is-not-current).

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

Run `npm run check:configuration` before starting or releasing a configured environment. This explicit preflight checks all six Web values, the three Admin values, RSA PEM structure and matching Web/Admin project IDs without initializing Firebase or sending network requests; it never prints credentials. Application Firebase initialization also rejects missing Web fields before calling the SDK. Admin initialization remains lazy so public pages and builds do not require server credentials; missing or malformed Admin configuration receives the safe configuration-error classification. Structural success does not prove the service account is authorized or the target services are ready.

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

Drain in-flight background workers and deploy the consent API, updated client and export/deletion/restore code together, then the matching Rules. Users with only a legacy owner-written acknowledgement must explicitly confirm again; do not copy legacy records into `_serviceConsents` or pre-seed an acceptance. Existing tabs may require refresh. Keep the policy version/minimum age in `src/lib/site-info.ts` synchronized with the Rules constants; a regression checks this contract. Verify `/account/data` while consent is absent or outdated, and verify that learning writes and business APIs refuse access until server acknowledgement. No new composite index is needed for the UID-addressed consent collection.

Do not infer a missing private key or assume local credentials point to a staging project. If a key is exposed, revoke/rotate it and update the deployment; `.gitignore` alone does not remove committed history.

<a id="timestamp-migration"></a>
## Learning write validation rollout

Deploy the learning PUT/PATCH API and updated Quiz/Flashcard/Practice clients together before applying the matching restrictive Rules. Older tabs that still write complex records through the SDK require refresh; do not temporarily reopen arbitrary private writes. Verify authenticated creation, response-loss replay, feedback recovery, notes/profile edits, activity leaf merging and owner legacy read/delete access. The new API uses document lookups and requires no additional composite index. This is a coordinated client/server/Rules rollout, not a remote data migration.

Bounds in `src/lib/data-limits.ts`, producer schemas, persistence schemas, UI inputs and Rules must remain synchronized. The `learning-traffic` and `learning-write` token buckets use provisional ceilings in `src/lib/request-budget.ts`; calibrate them against the intended environment before release. New budget scopes are automatically included in attributable export/deletion without renumbering durable job phases. API fingerprints are preserved with learning records through backup/restore; do not remove them to bypass changed-payload conflicts.

## Timestamp migration

New learning APIs persist Firestore Timestamp values; direct SDK creation/update of history, Flashcards and Practice is denied. History accepts bounded epoch milliseconds at the API boundary, preserving the completion instant across retries, while Flashcard/Practice timestamps are server-derived. History remains correctly paged while Timestamp values coexist with fixed-width UTC ISO strings produced by the original writer. Other ISO representations, including offsets and date-only strings, must be migrated before they appear in the history feed; until then they count as invalid records. Inventory and migrate these records before rollout to avoid temporarily hiding them.

Inventory the exact target before converting existing `users/{uid}/history.date`, `flashcards.createdAt` and `practice.createdAt`:

```powershell
npm run migrate:timestamps -- --project=YOUR_FIREBASE_PROJECT_ID
```

This command reads existing records but makes no writes by default. Its output contains aggregate counts rather than learner content. Review its invalid/convertible counts and retain a verified backup. For an explicitly authorized target, apply conversion with:

```powershell
npm run migrate:timestamps -- --project=YOUR_FIREBASE_PROJECT_ID --apply --confirm-timestamp-migration
```

The configured Admin project must match the explicit project. The conversion scans pages of 100 and commits at most 20 candidates per transaction, sharing maintenance and distinct-owner lock reads while rereading every record. It preserves original instants and unrelated fields, skips invalid/concurrently removed or already canonical dates, includes records below missing user profiles and refuses deletion locks or an active backup barrier. A protected owner aborts the entire current chunk; previous chunks may already be committed. It can be repeated after interruption. Rerun the inventory to verify zero convertible records; invalid dates require separate review. Do not run conversion concurrently with a legacy restore or older ISO-writing clients. No new index definition is needed for the type-specific single-field history queries; confirm the target has not disabled the normal `date` index. Application epoch milliseconds, numeric `*Ms` protocol/lease fields, durations, local calendar-day keys and external JSON metadata have distinct purposes and are not converted by this command. Emulator operation counts do not establish remote duration or cost.

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

Community, moderator and account APIs have separate pre-query traffic admission and transactional business quotas. Policies in `src/lib/request-budget.ts` define token capacities and refill durations. New UID scopes are covered by attributable export/deletion automatically; receipt-only status uses a global bucket and persists no credential identifier. These document-addressed controls need no additional composite index. Calibrate normal polling, retry bursts, moderation preview reads, storage downloads and authentication/admission overhead in staging; no hosting WAF or daily spending bound is assumed. Deploy matching APIs before relying on the limits.

Account polling recovery is defined in `src/lib/account-polling.ts`: four transient retries, distinct per-request deadlines and throttled online/visible-focus recovery. No additional flag enables automatic mutations. Forum cleanup uses the configured default Firestore database and existing Admin query/delete permissions; parent-scoped name-only descendant queries need no new application index. Every cleanup batch and tombstone finalization honor write guards transactionally. Verify runtime duration, Admin REST authorization and interruption/resumption in the intended staging project before deployed acceptance.

## CI action governance

[The validation workflow](../.github/workflows/ci.yml) pins every external action to a full commit SHA with its reviewed release in a comment, following [GitHub's immutable-reference guidance](https://docs.github.com/en/actions/reference/security/secure-use#using-third-party-actions). Its token has `contents: read` and checkout does not persist credentials for later build/test steps. The reviewed action manifests are:

| Action | Release | Pinned manifest |
|---|---|---|
| `actions/checkout` | `v7.0.1` | [Node 24 manifest](https://github.com/actions/checkout/blob/3d3c42e5aac5ba805825da76410c181273ba90b1/action.yml) |
| `actions/setup-node` | `v7.1.0` | [Node 24 manifest](https://github.com/actions/setup-node/blob/949feb2413d6458794dcd2491c4babbbce0c15c1/action.yml) |
| `actions/setup-java` | `v6.1.0` | [Node 24 manifest](https://github.com/actions/setup-java/blob/b843ebf9b913146b38da2eaa7aeddf76074ae1ad/action.yml) |
| `actions/upload-artifact` | `v7.0.2` | [Node 24 manifest](https://github.com/actions/upload-artifact/blob/cf430e030ddbb5b0abf93d22962f4752f3646cd9/action.yml) |

The action runtime is independent of `setup-node`'s application Node 24 selection. These manifests require a Node-24-capable runner; [upstream compatibility guidance](https://github.com/actions/checkout/blob/3d3c42e5aac5ba805825da76410c181273ba90b1/README.md#checkout-v5) sets the minimum runner to `2.327.1`. This job uses `ubuntu-latest`, npm caching, Temurin 21 and zipped multi-file artifacts. Checkout's newer restriction concerns `pull_request_target`/`workflow_run`; this workflow uses `push`/`pull_request` and does not opt into unsafe checkout. No registry publishing or authenticated Git/Docker step depends on the removed credential defaults.

For an action update, resolve the exact release tag in its official repository, compare the resulting full SHA, read that release's manifest and compatibility notes, then update the workflow SHA/comment and this table together. Revalidate YAML, used inputs, token needs, application commands and runner requirements. The minimum runner is a compatibility requirement, not a measurement of the current hosted image. Local inspection does not execute an action, its post step or hosted cache/artifact service; hosted validation remains a release gate.

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

Account jobs/backups remain disabled until their provider and recovery gates in [account operations](ACCOUNT_OPERATIONS.md) are satisfied. The [audit register](AUDIT_REPORT.md) records the current finding counts, the item-by-item reference-report reconciliation and each acceptance boundary. Actual production/camera/hosted CI/provider validation remains distinct from local tests.

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

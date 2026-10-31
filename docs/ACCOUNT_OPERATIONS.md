# 🔐 Account Jobs and Spark Operations

Export/deletion and backup require `ACCOUNT_JOBS_ENABLED=true` and valid server settings; local tests do not establish operational readiness. See [configuration](CONFIGURATION.md) and [validation](VALIDATION.md).

## Provision separate environments

1. Create a separate Firebase Spark staging project with its own Auth, Firestore, Web config and service account; use Google sign-in, restrict domains and review access. Never point Emulator fixtures at real data.
2. Create an [Upstash account](https://console.upstash.com/), verify email, enable available MFA and select QStash Free. Store its token and current/next signing keys as server secrets.
3. Create a [Backblaze account](https://www.backblaze.com/cloud-storage), verify email, enable MFA and create separate **private** staging/production B2 buckets. Confirm anonymous download is denied.
4. For each bucket, create a non-master [application key](https://www.backblaze.com/docs/cloud-storage-application-keys), restricted to that bucket with `listFiles`, `readFiles`, `writeFiles`, `deleteFiles`. Do not restrict its prefix: capacity inventory must include every object/version. Store ID, key and bucket ID server-side; account-wide keys are rejected.
5. Generate a random 32-byte base64 `JOB_ENCRYPTION_KEY` and keep a protected recovery copy outside the bucket. Loss makes artifacts unreadable; rotation requires re-encryption and receipt-key transition.
6. Set `JOB_ENVIRONMENT`, exact HTTPS `JOBS_BASE_URL` and QStash/B2 secrets from `.env.example`. Keep production `ACCOUNT_BACKUPS_ENABLED=false` until restore/barrier checks pass. Keep production credentials isolated.
7. Deploy matching APIs, Rules/indexes to the intended project; verify IAM and READY indexes. Vercel does not deploy Firestore Rules. Enable staging backups only for an authorized synthetic drill.
8. Run `npm run jobs:storage:check -- --confirm-synthetic-remote` in the intended authorized environment: it uploads, verifies and removes synthetic encrypted object versions. Check bucket privacy separately and inspect leftovers if interrupted.
9. Create one hourly QStash POST per environment to `https://<matching-origin>/api/internal/jobs`, body `{"jobId":"maintenance","environment":"staging"}` (or production), with three retries. Verify signatures and reject altered bodies, wrong destination/environment and expired signatures.
10. Enable staging jobs, complete [acceptance checks](#acceptance-gates) and prepare a production canary; an enabled flag does not prove readiness.

## Free-tier budget

[QStash Free](https://upstash.com/pricing/qstash) publishes 1,000 deliveries/day including retries. Four credits per publication cover the initial delivery plus three retries: daily allocations are 500 production, 100 staging and 192 for two hourly schedules, leaving 208 for overhead. Limits are soft, both environments share quota, and delayed retries may cross days; verify recovery bursts and reduce allocations if needed. It is not a hard cap. Queue messages contain only job ID/environment; Firestore checkpoints survive queue failure, and quota rejection becomes `waiting_quota` without upgrading the plan.

[B2](https://www.backblaze.com/cloud-storage/pricing) includes 10 GB; internal limits are 7 GB production/1 GB staging including versions. Bounded inventory stops uploads at the limit. Compressed JSON uses AES-256-GCM, a random nonce and filename as authenticated data. Compare downloaded `shark-account-N.json` with manifest `parts[].sha256`; `encryptedSha256` covers ciphertext. Parts target 2 MB; an individual encoded record/response is capped at 10 MB. Measure actual data, transactions, egress and retries; use spending alerts/lifecycle safeguards, while the application enforces download expiry.

Profile polls running jobs every 12 seconds and quota waiting every 15 minutes; terminal, disabled and error states stop polling.

## API and state contract

| Endpoint | Authorization and behavior |
|---|---|
| `POST /api/account/jobs` | Firebase ID token, revocation check and sign-in within five minutes; UUID request ID and `export`/`deletion`. Deletion also requires `confirmDeletion: true`. Same owner/request ID replays; a changed kind conflicts. |
| `GET /api/account/jobs` | Owner-only job list/configuration state. |
| `GET /api/account/jobs/{id}` | Owner status and authorized, unexpired numeric export part; deletion receipt header permits only minimal deletion status. Downloads are proxied. |
| `POST /api/internal/jobs` | QStash signature over the raw body and exact destination, current/next signing keys and matching environment. |

States: `queued`, `running`, `waiting_quota`, `ready`, `completed`, `failed`. Per-job/global leases fence checkpoints; duplicate deliveries cannot claim an active lease or repeat a terminal job. Cursors and stable content-addressed parts recover lost upload responses. Each invocation processes at most two batches with a 20-second target. Closing the tab only stops polling. Old `_accountRequests` remain manual-review records; the legacy learning export is not a complete account export.

## Export and deletion inventory

Paged `showMissing` traversal discovers descendants under missing parents. `src/lib/jobs/catalog.ts` inventories attributable Auth identity/claims, profile/private learning, Forum/Arena, answer keys/backups, rankings, AI/sessions, reports/archives, requests, attributable receipts and budgets. Exclude credentials, secrets and others’ private data. Export is paged live reading, not an atomic snapshot. Opaque legacy receipts without `ownerUid` cannot be attributed; reconcile them and rely on bounded expiry before complete self-service acceptance.

Export processing may wait seven days. Ready exports have **24-hour download authorization**; processing objects expire after eight days. Processing failure remains visible for 24 hours. Manifest part names and plaintext hashes match downloads; encrypted object hashes cover ciphertext.

Deletion requires fresh auth and confirmation; it locks writes, handles active AI, removes private/attributable data and reactions, and anonymizes retained authors/rankings/archives. Exact public paths prevent collection-group collisions with other users’ private data. Bounded cleanup removes all prior export versions, including lost uploads. Auth is last and retry-safe. Retained public writing may contain personal information: users must review it before confirmation.

Completion retains minimal hashed receipt status and an account write tombstone for seven days; the deletion journal lasts 30 days to exceed the backup window. Pending deletion locks/cursors do not expire automatically. The receipt stays in essential browser storage or a downloadable local file; only its minimal credential is sent in a header, never a URL. Key rotation and private-browsing eviction require operational verification.

## Retention on Spark

Set `RETENTION_ENABLED=true` for Firestore-only cleanup with `JOB_ENVIRONMENT`, `JOBS_BASE_URL` and QStash credentials/signing keys. It does not require B2 or enable account jobs/backups. Account jobs also enable retention. Configure the same signed hourly maintenance schedule; AI enablement alone does not schedule cleanup. Expired AI generations are denied even before physical deletion. Cleanup rechecks each expiry transactionally so renewed quota/budget records survive.

Native TTL, managed Firestore backup/restore and PITR require billing and are excluded. `firestore.indexes.json` defines ordinary expiry query indexes. The signed hourly sweep deletes up to 100 ordinary expired server records per pass plus bounded job transitions, terminal records and object/journal cleanup; terminal queries rotate and exclude unfinished deletions. It removes expired B2 versions and cancels old unfinished large uploads. Application authorization expiry and eventual physical removal are separate.

AI/session lifetime is 24 hours; request receipts seven days; export processing up to seven days and ready access 24 hours; backups seven days. Learning data remains until deletion. Monitor schedule delivery, backlog, stale leases, quota waiting and repeated safe errors. See [Firestore pricing](https://firebase.google.com/docs/firestore/pricing).

## Backup and isolated restore

When `ACCOUNT_BACKUPS_ENABLED=true`, an hourly sweep creates a daily encrypted backup. A five-minute write barrier blocks business writes while Firestore and Google Auth/claims are captured; its final checkpoint/release is atomic, and expiry invalidates the backup. Freeze operator Auth/claims/Rules/data changes. Auth and Firestore lack a cross-service atomic Spark snapshot; assess consistency at scale.

Backups include tagged Firestore values, Google Auth identities/claims and private controls, never passwords. Runtime leases, active maintenance state and the backup job itself are excluded. Restored outbox/jobs/budgets are not auto-resumed; reconcile them. Other Auth providers need a reviewed import strategy.

Use dedicated `RESTORE_ADMIN_*` credentials and an empty isolated target distinct from the source:

```powershell
npm run jobs:restore -- --job=<completed-backup-id> --target=<isolated-restore-project> --apply --confirm-isolated-empty-target
```

Keep restrictive Rules and traffic disabled. The script verifies encrypted parts/manifest, merges backup and current deletion journals, excludes deleted private records/identities, anonymizes retained contributions, and restores allowed data/claims. It refuses populated targets. Keep failed targets isolated and discard/recreate them through a reviewed process. Initial objectives **RPO 24 hours / RTO four hours** remain unaccepted until a timed restore at realistic scale and quota; an Emulator drill cannot certify cloud recovery.

## Acceptance gates

Check authentication, queue recovery, export, deletion, expiry and isolated restore with a newer deletion. Measure quotas using synthetic data. See [validation](VALIDATION.md#live-and-operational-verification) and [audit](AUDIT_REPORT.md).
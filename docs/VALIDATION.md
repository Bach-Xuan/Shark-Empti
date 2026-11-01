# 🧪 Validation and Test Guide · Shark Empti v2.0.0 **β**

This guide explains how to run the repository's built-in checks and interpret their results. [Configuration](CONFIGURATION.md) covers setup, [technical documentation](TECHNICAL_DOCUMENTATION.md) describes behavior, [account operations](ACCOUNT_OPERATIONS.md) covers operational drills, and the [audit register](AUDIT_REPORT.md) records outstanding concerns. A local pass applies to the tested source, configuration and environment; it does not establish deployed, live-provider or physical-device behavior.

## Prerequisites and isolation

Use Node 24 and the npm lockfile, JDK 21, and installed Playwright Chromium, Firefox and WebKit. `npm ci` reinstalls dependencies and may replace `node_modules`; keep credentials out of test fixtures and output. Install engines with `npx --no-install playwright install chromium firefox webkit`.

When reusing the browser runtimes already installed under this checkout's `.tools/playwright`, set `$env:PLAYWRIGHT_BROWSERS_PATH=(Resolve-Path '.tools/playwright').Path` in the test shell. The installed revisions must match the current Playwright package. Without that setting, the runner uses its standard browser-cache location and can report missing executables even when the checkout-local runtimes are present.

Integration/browser tests use Firebase Auth and Firestore Emulators under `demo-shark-empti`, with the deterministic AI fixture. App, Firestore, Auth and AI fixture normally use ports 9002, 8080, 9099 and 9098. Avoid concurrent suites on those ports. Integration requires both Emulators; browser tests block external network calls and do not establish live provider quality or cost.

CI's SHA-pinned actions run on Node 24 independently of the application runtime. See [action governance](CONFIGURATION.md#ci-action-governance) for reviewed manifests, minimum runner, supported inputs and update review. Local YAML/manifest inspection and application tests do not prove hosted runner startup, action post steps, cache or artifact service behavior.

On Windows, if JDK Unix-domain socket startup fails, select an **absent** ASCII path, without creating or deleting it, in the test process:

```powershell
if (Test-Path -LiteralPath C:\shark-emulator-no-afunix) { throw 'Choose a different absent ASCII-only socket path.' }
$previousJavaOptions=$env:JAVA_TOOL_OPTIONS
$env:JAVA_TOOL_OPTIONS='-Djdk.net.unixdomain.tmpdir=C:\shark-emulator-no-afunix'
npm run test:integration
if ($null -eq $previousJavaOptions) { Remove-Item Env:JAVA_TOOL_OPTIONS } else { $env:JAVA_TOOL_OPTIONS=$previousJavaOptions }
```

This forces the JDK socket fallback for that shell only. Restore any pre-existing `JAVA_TOOL_OPTIONS` after testing. See [local troubleshooting](CONFIGURATION.md#local-troubleshooting).

## Static, unit and integration checks

```powershell
npm run lint
npm run typecheck
npm run check:maintenance
npm run check:configuration
npm test
npm run test:coverage
npm run test:rules
npm run test:integration
```

Lint checks project code; typecheck validates the TypeScript program. Maintenance checks declared imports, package/lock agreement, documented npm scripts and local links, compiler/lint scope and ignored generated paths. Unit/component results cover exercised branches in their own denominator; integration separately exercises Rules, authenticated APIs and emulator-backed workflows. Do not add coverage counters from separate suites or treat a skipped case as passed. V8 coverage is produced under `coverage/`.

The configuration preflight expects a deliberately configured Web/Admin environment. It checks structure offline and is independent of demo-only tests/builds, which do not need real Admin secrets. Passing it does not verify IAM, credential validity at the provider or deployed service readiness.

Integration includes expiry-denial, renewed-quota cleanup and Firestore-only retention cases. Timestamp regressions cover canonical API writes, direct SDK write denial, mixed ISO/Timestamp history pagination, retry-stable completion dates, and repeatable migration across missing parents and multiple pages. Migration tests verify dry-run isolation, preservation of original instants/content and refusal during deletion or backup barriers. Rules and integration commands start demo Emulators. Check the first failing assertion and emulator log before retrying; fixture and Emulator results are not proof that deployed Rules, indexes, IAM or production data match. See [timestamp migration](CONFIGURATION.md#timestamp-migration) before converting a remote dataset.

Learning-write regressions cover all three nested payloads, unknown fields, count/score/answer mismatches, body/record limits, concurrent replay and changed-payload conflicts, stable server timestamps, private ownership, final-token contention and consent/lock changes after admission. Feedback tests preserve history dates, answers, fingerprints and unknown legacy configuration keys. Rules test documented profile/notes/activity shapes, field boundaries, real leap dates, append-only day updates, growth limits, unknown-path denial and owner legacy reads/deletion. Component checks retain drafts after errors, bound transport retries and preserve long legacy notes/analysis for reading. Optimized browser recovery checks include two lost responses after a real commit, a locale change and reload without regeneration, plus biography writes that retain coins/creation/legacy fields. HTTP smoke verifies unauthenticated PUT/PATCH denial. These checks do not accept deployed Rules or old-tab rollout.

Migration regressions verify bounded transaction count across full pages, atomic refusal of a chunk containing a locked owner, fresh-record revalidation after scanning and interruption by a newly active backup barrier. Dry runs perform no transaction writes. A partially committed run resumes safely; local operation-count reduction is not a staging throughput or billing measurement.

Consent regressions cover denial with forged legacy preferences, obsolete/malformed acknowledgements, strict explicit acceptance, stable server timestamps on retries, status admission, deletion/backup barriers and account-data access without learning consent. Rules deny direct consent access and unacknowledged learning writes while preserving profile provisioning and owner reads. Export/deletion/restore tests cover the new private record without shifting durable job phases. Component checks cover checkbox gating, response-loss recovery, stale policy and request cancellation; the browser account-control flow additionally verifies navigation before acknowledgement. These checks do not prove a person's age or deployed rollout.

Account-status recovery regressions cover fresh request signals after timeout, four-retry exhaustion, hidden-tab pause/resume, coalesced online/focus events, quota-wait intervals, permanent denial, late/uncooperative work and unmount. Receipt checks cover Auth-to-minimal fallback, identity binding, unavailable credentials, safe headers, replacement and racing file reads. Browser fixtures inject a transient failure before real demo status responses and verify read-only recovery, terminal stop and English/Vietnamese accessibility. They do not run a real queue/provider outage or establish production recovery targets.

Forum cleanup regressions reproduce lock, maintenance and consent changes after parent visibility cutover. Guarded cleanup is tested across more than 500 descendants, missing intermediate parents, long legacy IDs, interruption between batches, finalization under a new barrier and retry. Unit checks reject foreign/malformed/duplicate inventory paths and unsupported database configuration. All returned paths are validated before transactional deletion; Emulator results do not prove deployed IAM or scale.

D41 checks cover public serializer whitelists, stored timestamps, ranking eligibility and Web Crypto reaction keys. The client now reads versioned public projections and owner-only reaction/pointer records; Rules deny canonical Forum and Arena attempt reads. Hook tests cover 30-key query chunks, server confirmation after cached snapshots, live updates, account/target changes, malformed records, timeout, unsubscribe and explicit retry. Migration tests cover read-only inventory, repeatability, unknown-data preservation, pagination, hidden archives, duplicate ranking ownership/IDs, independent public IDs, account locks, deletion journals and lease expiry/takeover. The latest checks passed 491 unit/component cases with two opt-in skips and 181 Rules/integration cases. Chromium and WebKit each passed the post/comment reaction test against the final demo build. Deployed migration/Rules/index and operational acceptance remain required.

The projection inventory must precede cutover. Regression fixtures include unrecognized documents, missing source records, hidden/tombstoned posts and public ranking IDs equal to owner UIDs. A blocked inventory preserves those records and stops before converting business data. Because Rules trust server-controlled version markers, the inventory and restricted privileged-writer access are operational prerequisites, not proof about a live dataset.

## Optimized build and browser matrix

The reference-report reconciliation in [the audit](AUDIT_REPORT.md#reference-report-reconciliation) distinguishes confirmed defects, conditional risks, documented design limits and operational validation gaps. Receipt regressions cover nested key reordering, significant array order and retained legacy receipt comparison. Community integration includes more than 50 hidden and open reports, equal creation timestamps, continuation after boundary deletion, and invalid or cross-status cursors. Traffic regressions cover nine Forum/report/Arena entry points, moderator role/queue work, account job creation/list/status, malformed receipt fast rejection, final-token contention across callers, and error/replay charging without duplicate business reservations. Account read controls are tested without consent under deletion and maintenance barriers; receipt status remains available after Auth deletion and records no credential identifier. These checks do not accept deployed abuse limits, edge controls, public-identity minimization or provider capacity.

```powershell
npm run test:e2e
npm run build:demo
$env:E2E_PRODUCTION='true'
npm run test:e2e
Remove-Item Env:E2E_PRODUCTION
npm run test:production
```

The ordinary E2E command uses the development server; production mode requires `build:demo`. Its build ID records demo configuration and a source/assets/lock/configuration fingerprint. A missing, stale, non-demo or unverified artifact is rejected. Public Firebase variables are embedded at build time, so a runtime override cannot turn a production build into an isolated demo build. Rebuild after input changes.

Playwright covers Chromium desktop/mobile, Firefox and WebKit. Inspect pass/fail/skip counts and traces for the exact run; a retry or isolated pass is not a stable repeated-matrix result. Current engines do not prove the exact documented minimum browser versions, physical devices, screen readers or camera permission behavior. Confirm locale/theme, responsive layouts, keyboard/focus, accessible names, reduced motion, loading/error/retry and print where relevant. Axe supplements manual accessibility review; a passing sample is not a full WCAG certification.

Optional print verification renders the actual report with long VI/EN fixtures:

```powershell
$env:REPORT_PRINT_BROWSER='chromium' # chrome, msedge, firefox or webkit are also supported
node node_modules/vitest/vitest.mjs run tests/report-print.browser.test.tsx
Remove-Item Env:REPORT_PRINT_BROWSER
```

Without opt-in, the normal unit suite skips these browser-print cases. Chromium can write PDFs to `tmp/pdfs/`; browser/PDF output does not verify native print dialogs or physical printers.

Production HTTP smoke checks public HTML, metadata, API authentication and six existing gzip script budgets. It uses an optimized demo artifact and does not test the deployed origin or real user traffic.

## Performance and dependency checks

| Command | Purpose and interpretation |
|---|---|
| `npm run report:bundle` | Inventory optimized entry/deferred chunks; requires a production build. |
| `npm run report:performance` | Synthetic in-process processing at multiple dataset sizes. |
| `npm run report:browser` | Browser guest-route cold/warm load, heap, DOM and input timing with demo Emulators. |
| `npm run report:queries` | Compare bounded/unbounded query behavior against local demo data. |
| `npm run report:comparison` | Compare two builds; set `PERFORMANCE_BASELINE_ROOT` to a compatible source/build and installed dependency graph. |
| `npm run audit:dependencies` | Query npm advisories and write `reports/dependency-audit.json`; names and versions are transmitted. High/critical advisories or registry errors fail policy; lower severities remain visible. |

For comparisons, keep Node, dependency graph, fixture data, viewport, cache state and sampling method consistent. Report sample count, font transfer and regressions. Small-sample p95 can be the largest sample; navigation load is not LCP, and CDP node counts alone do not prove a memory leak. Refresh dependency data before making current advisory claims.

Dependency compatibility checks retain the scoped Firestore/gRPC API regression and exercise CSV parsing plus Firebase CLI's own ESM streaming JSON adapter. The obsolete FTP check/override was retired when the compatible CLI parent removed that dependency path. The audit register preserves baseline, interim and current registry inventories and residual parent constraints. Package instance counts, advisory counts and runtime reachability are separate; inspect lockfile changes and used parent APIs before imposing transitive-major overrides.

## Live and operational verification

`npm run ai:health` authenticates the OpenRouter key and inspects model availability; it does not prove inference or quota. `npm run ai:smoke` invokes real quiz/chat generation and may consume quota; it does not validate the full authenticated ledger/recovery workflow. Both require the intended credentials and network.

Account export/deletion, signed queue delivery, expiry, backup and isolated restore have separate provider, permission and cost boundaries. Use the built-in `npm run jobs:storage:check` and `npm run jobs:restore` only with their explicit confirmation flags and an identified authorized target as described in [account operations](ACCOUNT_OPERATIONS.md). Verify signatures, duplicate/expired leases, interrupted delivery, ownership, download expiry and deletion journal before enabling the service. A synthetic Emulator restore is not proof of an encrypted cloud restore or RPO/RTO target.

## Results and cleanup

Record command, source/build fingerprint, environment, test counts, skips, failure/retry details and relevant limitations in the appropriate official release record. Exclude credentials, private data and raw provider responses. Follow [maintenance and generated artifacts](CONFIGURATION.md#maintenance-and-generated-artifacts): preview cleanup with `-- --dry-run`, retain useful evidence before removal, and remove temporary builds, results, coverage, reports, traces, screenshots and logs after review. Keep official tests, licenses, installed runtimes and credentials. Never follow linked directories when cleaning.

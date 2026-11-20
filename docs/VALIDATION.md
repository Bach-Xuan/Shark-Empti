# 🧪 Validation and Test Guide · Shark Empti **v2.2.0**

This guide explains how to run the repository's built-in checks and interpret their results. [Configuration](CONFIGURATION.md) covers setup, [technical documentation](TECHNICAL_DOCUMENTATION.md) describes behavior, [account operations](ACCOUNT_OPERATIONS.md) covers operational drills, and the [audit register](AUDIT_REPORT.md) records outstanding concerns. A local pass applies to the tested source, configuration and environment; it does not establish deployed, live-provider or physical-device behavior. The [interface design guide](DESIGN.md) covers learner-facing states and interactions.

## Flow regression coverage

The following checks exercise the [application flows](FLOW.md) recorded in the audit.

| Finding | Regression checked | Local evidence |
|---|---|---|
| D45, D46 | Export redaction, moderator erasure during deletion and restore, and resuming a failed deletion with the original receipt, lock and checkpoint | [Account job integration tests](../tests/integration/account-jobs.test.ts) |
| D47 | Refusing early writes before a confirmed owner read, recovering a failed listener and rejecting an old owner’s save callback | [Notes subscription tests](../tests/notes.test.tsx) |
| D48, D54 | Enforcing backup and deletion barriers during migration, and preventing a duplicate report from restoring another report’s archive | [Community integration tests](../tests/integration/community.test.ts) |
| D49–D51, D53, D55 | Starting the personal timer after generation, bounding answer and feedback sizes, validating confidence, freezing topic selection and fitting multibyte chat context | [Quiz lifecycle](../tests/quiz-lifecycle.test.tsx), [Playground](../tests/playground.test.tsx), [AI flows](../tests/ai-flows.test.ts) |
| D52 | Losing an Arena submit response after the server commits, reloading, replaying the original answers and receiving a single recorded attempt | [Arena component tests](../tests/arena-detail.test.tsx), [browser flow](../tests/e2e/app.spec.ts) |

For D46, the [owner controls](../tests/account-job-polling.test.tsx) and [receipt view](../tests/account-receipt.test.tsx) check the recovery instructions available to each reader. For D51, [draft recovery tests](../tests/learning-drafts.test.tsx) cover the feedback size boundary in active Quiz progress and pending save payloads.

The local D45–D55 verification passed 524 unit/component tests, 189 Rules/integration tests and six desktop Chromium cases covering account controls, polling and draft recovery. All six browser cases passed together on a fresh Emulator instance. The optimized demo build also passed the HTTP smoke checks and all six route bundle budgets.

Firebase Emulator tests exercise local transactions. Hosted provider delivery, deployed Rules and indexes, and the staging recovery time require environment-specific verification.

## Prerequisites and isolation

Run the integration and browser suites in separate Emulator invocations, as the npm scripts do. Integration tests deliberately exhaust shared request budgets. Reusing that database for a browser run can make consent return HTTP 429 before the flow under test starts.

Use Node 24 and the npm lockfile, JDK 21, and installed Playwright Chromium, Firefox and WebKit. `npm ci` reinstalls dependencies and may replace `node_modules`; keep credentials out of test fixtures and output. Install engines with `npx --no-install playwright install chromium firefox webkit`.

When reusing the browser runtimes already installed under this checkout's `.tools/playwright`, set `$env:PLAYWRIGHT_BROWSERS_PATH=(Resolve-Path '.tools/playwright').Path` in the test shell. The installed revisions must match the current Playwright package. Without that setting, the runner uses its standard browser-cache location and can report missing executables even when the checkout-local runtimes are present.

Integration/browser tests use Firebase Auth and Firestore Emulators under `demo-shark-empti`, with the deterministic AI fixture. App, Firestore, Auth and AI fixture normally use ports 9002, 8080, 9099 and 9098. Avoid concurrent suites on those ports. Integration requires both Emulators; browser tests permit read-only Google popup bootstrap scripts on apis.google.com. A network interruption during bootstrap can cause the popup wait to expire before the Emulator receives a sign-in request. Application data and AI fixtures stay local.

Push and pull-request validation runs `npm test` and the optimized `npm run test:e2e:chromium` project. Manually dispatch the full workflow for release candidates. Version tags beginning with `v` also run both complete browser matrices, coverage, Rules/integration, a native Emulator export/import drill and cross-engine print checks.

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

Lint checks project code and typecheck validates the TypeScript program. Maintenance checks declared imports, package/lock agreement, documented npm scripts, local files and Markdown section links, agreement between audit totals and the two finding tables, compiler/lint scope and ignored generated paths. Unit and component coverage uses the source set in the Vitest configuration. The integration suite exercises Rules and emulator-backed workflows. Its V8 percentages cover the AI and server API files selected in the integration configuration. V8 writes the separate reports under `coverage/`.

The configuration preflight expects a deliberately configured Web/Admin environment. It checks structure offline and is independent of demo-only tests/builds, which do not need real Admin secrets. Passing it does not verify IAM, credential validity at the provider or deployed service readiness.

Integration includes expiry-denial, renewed-quota cleanup and Firestore-only retention cases. Timestamp regressions cover canonical API writes, direct SDK write denial, three-page single-query history pagination after mixed ISO/Timestamp migration, including tied dates, retry-stable completion dates, and repeatable migration across missing parents and multiple pages. Migration tests verify dry-run isolation, preservation of original instants/content and refusal during deletion or backup barriers. Rules and integration commands start demo Emulators. Check the first failing assertion and emulator log before retrying; fixture and Emulator results are not proof that deployed Rules, indexes, IAM or production data match. See [timestamp migration](CONFIGURATION.md#timestamp-migration) before converting a remote dataset.

Learning-write regressions cover all three nested payloads, unknown fields, count/score/answer mismatches, body/record limits, concurrent replay and changed-payload conflicts, stable server timestamps, private ownership, final-token contention and consent/lock changes after admission. Feedback tests preserve history dates, answers, fingerprints and unknown legacy configuration keys. Rules test documented profile/notes/activity shapes, field boundaries, real leap dates, append-only day updates, growth limits, unknown-path denial and owner legacy reads/deletion. Component checks retain drafts after errors, bound transport retries and preserve long legacy notes/analysis for reading. Optimized browser recovery checks include two lost responses after a real commit, a locale change and reload without regeneration, plus biography writes that retain coins/creation/legacy fields. HTTP smoke verifies unauthenticated PUT/PATCH denial. These checks do not accept deployed Rules or old-tab rollout.

Migration regressions verify bounded transaction count across full pages, atomic refusal of a chunk containing a locked owner, fresh-record revalidation after scanning and interruption by a newly active backup barrier. Dry runs perform no transaction writes. A partially committed run resumes safely; local operation-count reduction is not a staging throughput or billing measurement.

Consent regressions cover denial with forged legacy preferences, obsolete/malformed acknowledgements, strict explicit acceptance, stable server timestamps on retries, status admission, deletion/backup barriers and account-data access without learning consent. Rules deny direct consent access and unacknowledged learning writes while preserving profile provisioning and owner reads. Export/deletion/restore tests cover the new private record without shifting durable job phases. Component checks cover checkbox gating, response-loss recovery, stale policy and request cancellation; the browser account-control flow additionally verifies navigation before acknowledgement. These checks do not prove a person's age or deployed rollout.

Account-status recovery regressions cover fresh request signals after timeout, four-retry exhaustion, hidden-tab pause/resume, coalesced online/focus events, quota-wait intervals, permanent denial, late/uncooperative work and unmount. Receipt checks cover Auth-to-minimal fallback, identity binding, unavailable credentials, safe headers, replacement and racing file reads. Browser fixtures inject a transient failure before real demo status responses and verify read-only recovery, terminal stop and English/Vietnamese accessibility. They do not run a real queue/provider outage or establish production recovery targets.

Forum cleanup regressions reproduce lock, maintenance and consent changes after parent visibility cutover. Guarded cleanup is tested across more than 500 descendants, missing intermediate parents, long legacy IDs, interruption between batches, finalization under a new barrier and retry. Unit checks reject foreign/malformed/duplicate inventory paths and unsupported database configuration. All returned paths are validated before transactional deletion; Emulator results do not prove deployed IAM or scale.

D41 checks cover public serializer whitelists, stored timestamps, ranking eligibility and Web Crypto reaction keys. The client now reads versioned public projections and owner-only reaction/pointer records; Rules deny canonical Forum and Arena attempt reads. Hook tests cover 30-key query chunks, server confirmation after cached snapshots, live updates, account/target changes, malformed records, timeout, unsubscribe and explicit retry. Migration tests cover read-only inventory, repeatability, unknown-data preservation, pagination, hidden archives, duplicate ranking ownership/IDs, independent public IDs, account locks, deletion journals and lease expiry/takeover. The earlier projection checkpoint passed 491 unit/component cases with two opt-in skips and 181 Rules/integration cases. Chromium and WebKit each passed the post/comment reaction test against the final demo build. Deployed migration/Rules/index and operational acceptance remain required.

The projection inventory must precede cutover. Regression fixtures include unrecognized documents, missing source records, hidden/tombstoned posts and public ranking IDs equal to owner UIDs. A blocked inventory preserves those records and stops before converting business data. Because Rules trust server-controlled version markers, the inventory and restricted privileged-writer access are operational prerequisites, not proof about a live dataset.

## Optimized build and browser matrix

Receipt regressions cover nested key reordering, significant array order and retained legacy receipt comparison. Community integration includes more than 50 hidden and open reports, equal creation timestamps, continuation after boundary deletion, and invalid or cross-status cursors. Traffic regressions cover nine Forum/report/Arena entry points, moderator role/queue work, account job creation/list/status, malformed receipt fast rejection, final-token contention across callers, and error/replay charging without duplicate business reservations. Account read controls are tested without consent under deletion and maintenance barriers; receipt status remains available after Auth deletion and records no credential identifier. These checks do not accept deployed abuse limits, edge controls, public-identity minimization or provider capacity.

```powershell
npm run test:e2e
npm run build:demo
$env:E2E_PRODUCTION='true'
npm run test:e2e
Remove-Item Env:E2E_PRODUCTION
npm run test:production
```

Authenticated fixtures that inspect private records look up the exact generated account in the Auth Emulator. Receipt recovery seeds local storage before the first page mount so the test observes the injected failure and subsequent recovery on the same page. Forum admission checks the visible notification, retained draft and number of committed posts after retry.

The ordinary E2E command uses the development server; production mode requires `build:demo`. Its build ID records demo configuration and a source/assets/lock/configuration fingerprint. A missing, stale, non-demo or unverified artifact is rejected. Public Firebase variables are embedded at build time, so a runtime override cannot turn a production build into an isolated demo build. Rebuild after input changes.

The default Playwright matrix includes desktop Chromium, Firefox and WebKit and a touch viewport for each engine. The product targets Chrome 100+ and Firefox 102+ on desktop and Android, and Safari 15.4+ on macOS and iOS. A Firefox touch viewport uses the desktop Gecko engine.

On the optimized single-query build, 106 of the 144 E2E cases passed on the first run. The remaining 38 timed out while waiting for the Google sign-in popup during a network interruption. All 38 passed when rerun on the same build. The six minimum-engine flows, 510 unit/component tests and 188 Rules/integration cases also passed locally.

For the historical matrix, install trusted matching binaries and Playwright drivers outside the application dependency graph. Supply a UTF-8 JSON object with keys `chromium`, `firefox` and `webkit`. Each contains an absolute `driver` path to the extracted playwright-core package and an absolute `executable` path. The runner checks the engine version before exercising language, theme, layout, sign-in, a persisted quiz and its on-demand Profile report through print readiness. The touch cases also check the Android Chrome, Android Firefox or iPhone Safari user agent and require a trusted touch event on the sign-in control.

| Windows engine | Historical installation | Matching driver |
|---|---|---|
| Chromium 100.0.4896.0 | [Chromium snapshot 972766](https://storage.googleapis.com/chromium-browser-snapshots/Win_x64/972766/chrome-win.zip), executable `chrome-win/chrome.exe` | [playwright-core 1.20.2](https://www.npmjs.com/package/playwright-core/v/1.20.2) |
| Firefox 102.0 with Playwright automation | Firefox revision 1335, executable `firefox/firefox.exe` | [playwright-core 1.24.2](https://www.npmjs.com/package/playwright-core/v/1.24.2) |
| WebKit 15.4 Windows port | WebKit revision 1668, executable `Playwright.exe` | [playwright-core 1.23.4](https://www.npmjs.com/package/playwright-core/v/1.23.4) |

Install the historical driver with its dependencies in an isolated directory. Use that driver’s matching browser install command for Firefox and WebKit. For Chromium, point to the snapshot above. The default Chromium downloaded by driver 1.20.2 reports milestone 101.

```powershell
npm run build:demo
$env:BROWSER_FLOOR_CONFIG = (Resolve-Path (Join-Path $env:LOCALAPPDATA 'SharkEmpti/browser-installations.json')).Path
try { npm run test:e2e } finally { Remove-Item Env:BROWSER_FLOOR_CONFIG }
```

The historical flow opens Profile using the application's navigation button and selects the quiz it just saved. A separate hard-navigation probe on Windows WebKit 15.4 recorded a cancelled emulator watch and an inspector access-control diagnostic as the outgoing document unloaded. The destination opened successfully both with and without request interception. The instrumented page received no window error or unhandled rejection event. The browser test retains its page-error assertions on the in-app flow.

Keep the machine-specific installation file in a private local directory. Windows WebKit, Chromium and Gecko results cover those engine builds. Native iOS Safari, Android browsers, permissions and camera hardware require separate device evidence. Inspect pass/fail/skip counts and traces for the exact run; a retry or isolated pass is not a stable repeated-matrix result. Current engines do not prove the exact documented minimum browser versions, physical devices, screen readers or camera permission behavior. Confirm locale/theme, responsive layouts, keyboard/focus, accessible names, reduced motion, loading/error/retry and print where relevant. Axe supplements manual accessibility review; a passing sample is not a full WCAG certification.

For a physical-camera check, open Arena on the local demo, select **Focus Shield** and enable **Tracking Mode**. Confirm that the video plays and a focus measurement appears. Keep a reference to the active video track in browser developer tools, then use **Stop camera and close** and confirm its `readyState` is `ended`. Record the browser, device, frame dimensions and track states. Run with local model assets, recording disabled and external requests blocked. On Windows, Chrome acquired the HP Wide Vision camera at 640 × 480 and released the track after local inference. Native Apple and Android devices, permission revocation and sustained use still require device testing.

Optional print verification renders the report with long Vietnamese and English fixtures.

```powershell
$env:REPORT_PRINT_BROWSER='chromium' # chrome, msedge, firefox or webkit are also supported
node node_modules/vitest/vitest.mjs run tests/report-print.browser.test.tsx
Remove-Item Env:REPORT_PRINT_BROWSER
```

With `BROWSER_FLOOR_CONFIG` set, the print tests use the configured historical engine. They render the report and locally served KaTeX fonts. The release workflow installs all three current engines, enables Chromium print during coverage and runs the bilingual fixtures in Firefox and WebKit. The push and pull-request workflow installs Chromium. Local unit runs select a browser with `REPORT_PRINT_BROWSER`. Chromium can write PDFs to `tmp/pdfs/`. Physical printers and native print dialogs need separate verification.

Production HTTP smoke checks public HTML, metadata, response headers, API authentication and the six route budgets for compressed scripts. It checks the scripts referenced by the login and registration HTML for the Firestore transport. Optimized browser tests also inspect the same-origin scripts requested during guest interaction. Both use a fingerprinted local demo build.

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

### Authentication, history, Forum and camera measurements

Optimized demo builds on Windows used Chromium 151, local Auth and Firestore Emulators, the same lockfile and five fresh browser contexts per build. The baseline at `ddd489e` used 120 sessions split evenly between original ISO strings and native timestamps. The updated fixture represents those 120 sessions after conversion. The builds were measured in separate runs. Differences in small-sample wall-clock times also reflect local scheduling.

Each run signs in through the local Google popup, confirms consent, opens Setup and restores the saved Auth session in another fresh context. It watches an idle Profile for one second, opens the report and records the first selectable row. Separate navigation opens a populated Dashboard and a selectable Playground topic. The network trace counts unique delivered history documents and distinct watch targets.

| Median browser timing | Original | Updated single-query build |
|---|---:|---:|
| First usable sign-in | 754 ms | 633 ms |
| Sign-in control to editable Setup, including the popup | 3,184 ms | 2,691 ms |
| Consent confirmation to editable Setup | 1,267 ms | 1,298 ms |
| Returning learner to editable Setup | 1,383 ms | 1,297 ms |
| Open report to first selectable row | 388 ms | 398 ms |
| Setup to populated Dashboard | 665 ms | 727 ms |
| Dashboard to selectable Playground topic | 497 ms | 467 ms |

Every original Profile visit opened two watches and received 100 history documents before report selection. Every updated Profile visit received zero history documents before selection and exactly 50 documents on one watch after opening the report. The first-page delivery count fell by 50% on this fixture. Production billing depends on data, cache state and traffic.

Initial login and registration scripts fell from 481,389 to 282,758 gzip bytes (41.3%). The original guest scripts included the Firestore transport in every run. The updated scripts excluded it in every run. The root route fell from 427,792 to 395,752 bytes, and Profile fell from 517,089 to 516,757 bytes. Forum and Arena increased by 1,191 and 990 bytes. The six [route budgets](../config/bundle-budgets.json) allow 10% headroom rounded up to 1 KiB.

A separate five-pair experiment measured the effect of overlapping profile provisioning with consent checks and reusing one date formatter per report dialog. Median new sign-in fell from 3,190 to 2,898 ms, returning sign-in from 1,383 to 1,254 ms and report opening from 429 to 413 ms. Those paired samples preceded the timestamp migration.

The [report regression](../tests/profile-report.test.tsx) removes a selected session, changes live history after report generation and switches learners. It checks the captured preview and a fresh selection on reopen. The [browser regression](../tests/e2e/feedback-recovery.spec.ts) checks both themes, text contrast, visibility of the Generate button at 320 CSS pixels and keyboard focus after closing.

The [Forum regression](../tests/forum-reactions.test.tsx) uses 61 distinct post/comment targets and a duplicate. Ten rotations of the same IDs previously opened 33 listeners, closed 30 and calculated 682 hashes. The changed reader opens three, closes none during sorting and calculates 61 hashes. The original listeners continue to receive live updates. Cases for switching UID, changing targets, replacing the database, cache-only snapshots and retry exercise invalidation.

The Focus Shield comparison uses a synthetic Chromium camera, the bundled TensorFlow model and software WebGL. After warm-up, a five-minute visible session counts processing callbacks and video frames read for inference. CDP reports CPU seconds summed across the same browser processes. Stop latency runs from activating the close control to observing the track in the ended state. These measurements cover local scheduling and resource release. Device battery life, hardware-accelerated CPU use and physical camera timing require device measurements.

| Five-minute camera session | Original scheduler | New scheduler, first run | New scheduler, repeat |
|---|---:|---:|---:|
| Processing callbacks | 8,975 | 372 | 372 |
| Frames sampled for inference | 371 | 372 | 372 |
| Aggregate browser CPU time | 1,196.1 s | 1,259.6 s | 1,200.1 s |
| Close to ended track | 3.0 ms | 2.7 ms | 2.8 ms |

The new scheduler eliminated 95.9% of polling callbacks. Both repeat runs retained the sampling cadence. Aggregate CPU use on this software-rendered setup ranged from 0.3% to 5.3% above baseline. The [session tests](../tests/focus-tracker-session.test.ts) also cover suspension and resumption, cancellation of pending work, permission loss, playback failures and tensor disposal.

The installed dependency graph passed `npm ls --all` on Node 24.22.3. TypeScript 6.0.3 falls within the installed TypeScript ESLint parser range of `>=4.8.4 <6.1.0`. The optimized HTTP smoke identifies the TensorFlow and Recharts chunks by content and excludes them from the initial scripts for all six measured routes. Dependency compatibility checks exercise the Firestore/gRPC API, CSV parsing and Firebase CLI's ESM streaming JSON adapter. The Firebase CLI parent upgrade also retired the obsolete FTP check and override. The full lockfile inventory returned zero active advisories across 1,412 package instances after the picomatch advisory was withdrawn. The four locked picomatch installations use 2.3.2 or 4.0.7. The release check still blocks active high or critical findings. Refresh the inventory for each release. [Advisory withdrawal](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) · [Dependency policy](../config/dependency-audit-policy.json)

## Live and operational verification

The configured Firestore project's learning-date inventory contained 58 convertible records. The backfill converted all 58, and an independent scan found 58 native timestamps, zero legacy values and zero invalid dates. Each stored instant matched its original value in the encrypted, field-only recovery snapshot. Other projects require their own inventory.

`npm run ai:health` authenticates the OpenRouter key and inspects model availability; it does not prove inference or quota. `npm run ai:smoke` invokes real quiz/chat generation and may consume quota; it does not validate the full authenticated ledger/recovery workflow. Both require the intended credentials and network.

Account export/deletion, signed queue delivery, expiry, backup and isolated restore have separate provider, permission and cost boundaries. Use the built-in `npm run jobs:storage:check` and `npm run jobs:restore` only with their explicit confirmation flags and an identified authorized target as described in [account operations](ACCOUNT_OPERATIONS.md). Verify signatures, duplicate/expired leases, interrupted delivery, ownership, download expiry and deletion journal before enabling the service. The account integration fixture interrupts Auth import after the first Firestore writes, rejects reuse of the partial target and restores on a fresh target. It admits a late source deletion, finalizes twice and checks target Auth, orphan private documents, public projections and reopening of source admission. A separate scheduler fixture verifies that five expired backups reserve no internal credits while a due deletion receives four. Hosted recovery timing and provider billing require staging evidence.

For educational evaluation, sample Vietnamese and English items by subject, difficulty and answer type. Have two reviewers independently mark factual correctness, answerability and agreement between feedback and the submitted work, then reconcile disagreements. Record the sample sizes, model IDs, failure categories and uncertainty before changing score labels. For Focus Shield, use consented, separately labelled sessions across lighting and device conditions. Split evaluation by participant, report missing predictions and compare false-positive and false-negative rates per condition. Product owners must agree on acceptable error rates before interpreting results as calibrated.

## Results and cleanup

Record command, source/build fingerprint, environment, test counts, skips, failure/retry details and relevant limitations in the appropriate official release record. Exclude credentials, private data and raw provider responses. Follow [maintenance and generated artifacts](CONFIGURATION.md#maintenance-and-generated-artifacts): preview cleanup with `-- --dry-run`, retain useful evidence before removal, and remove temporary builds, results, coverage, reports, traces, screenshots and logs after review. Keep official tests, licenses, installed runtimes and credentials. Never follow linked directories when cleaning.

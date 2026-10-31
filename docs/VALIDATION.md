# 🧪 Validation and Test Guide

This guide explains how to run the repository's built-in checks and interpret their results. [Configuration](CONFIGURATION.md) covers setup, [technical documentation](TECHNICAL_DOCUMENTATION.md) describes behavior, [account operations](ACCOUNT_OPERATIONS.md) covers operational drills, and the [audit register](AUDIT_REPORT.md) records outstanding concerns. A local pass applies to the tested source, configuration and environment; it does not establish deployed, live-provider or physical-device behavior.

## Prerequisites and isolation

Use Node 24 and the npm lockfile, JDK 21, and installed Playwright Chromium, Firefox and WebKit. `npm ci` reinstalls dependencies and may replace `node_modules`; keep credentials out of test fixtures and output. Install engines with `npx --no-install playwright install chromium firefox webkit`.

Integration/browser tests use Firebase Auth and Firestore Emulators under `demo-shark-empti`, with the deterministic AI fixture. App, Firestore, Auth and AI fixture normally use ports 9002, 8080, 9099 and 9098. Avoid concurrent suites on those ports. Integration requires both Emulators; browser tests block external network calls and do not establish live provider quality or cost.

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
npm test
npm run test:coverage
npm run test:rules
npm run test:integration
```

Lint checks project code; typecheck validates the TypeScript program. Maintenance checks declared imports, package/lock agreement, documented npm scripts and local links, compiler/lint scope and ignored generated paths. Unit/component results cover exercised branches in their own denominator; integration separately exercises Rules, authenticated APIs and emulator-backed workflows. Do not add coverage counters from separate suites or treat a skipped case as passed. V8 coverage is produced under `coverage/`.

Integration includes expiry-denial, renewed-quota cleanup and Firestore-only retention cases. Rules and integration commands start demo Emulators. Check the first failing assertion and emulator log before retrying; fixture and Emulator results are not proof that deployed Rules, indexes, IAM or production data match.

## Optimized build and browser matrix

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

## Live and operational verification

`npm run ai:health` authenticates the OpenRouter key and inspects model availability; it does not prove inference or quota. `npm run ai:smoke` invokes real quiz/chat generation and may consume quota; it does not validate the full authenticated ledger/recovery workflow. Both require the intended credentials and network.

Account export/deletion, signed queue delivery, expiry, backup and isolated restore have separate provider, permission and cost boundaries. Use the built-in `npm run jobs:storage:check` and `npm run jobs:restore` only with their explicit confirmation flags and an identified authorized target as described in [account operations](ACCOUNT_OPERATIONS.md). Verify signatures, duplicate/expired leases, interrupted delivery, ownership, download expiry and deletion journal before enabling the service. A synthetic Emulator restore is not proof of an encrypted cloud restore or RPO/RTO target.

## Results and cleanup

Record command, source/build fingerprint, environment, test counts, skips, failure/retry details and relevant limitations in the appropriate official release record. Exclude credentials, private data and raw provider responses. Follow [maintenance and generated artifacts](CONFIGURATION.md#maintenance-and-generated-artifacts): preview cleanup with `-- --dry-run`, retain useful evidence before removal, and remove temporary builds, results, coverage, reports, traces, screenshots and logs after review. Keep official tests, licenses, installed runtimes and credentials. Never follow linked directories when cleaning.

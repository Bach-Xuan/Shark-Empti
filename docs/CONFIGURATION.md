# Cấu hình và chẩn đoán · v1.15.1

English below. Hướng dẫn trong file này không phải xác nhận cấu hình local/production đã đầy đủ.

## 1. Runtime và cài đặt

Dùng Node 24.x cho local, CI và cấu hình project Vercel. .nvmrc và engines trong package.json thống nhất major; @types/node theo major runtime. Chạy npm ci để cài đúng lockfile; không dùng --force hoặc --legacy-peer-deps để bỏ qua xung đột peer.

Chỉ copy .env.example thành .env nếu .env chưa tồn tại; không ghi đè credential đã cấu hình. Next tự nạp biến môi trường; scripts AI dùng Node --env-file-if-exists=.env, không cần dotenv. Biến đã có trong process được ưu tiên bởi Node. Script AI chỉ nạp .env theo lệnh hiện tại, không tự thực hiện toàn bộ thứ tự nạp file env của Next. Sau khi đổi biến NEXT_PUBLIC_, khởi động/build lại vì chúng được đóng vào client bundle.

## 2. Ma trận biến môi trường

| Biến | Phạm vi | Ý nghĩa |
|---|---|---|
| OPENROUTER_API_KEY | Server secret | Bearer key cho AI |
| OPENROUTER_MODEL | Server | Model ID nguyên bản, mặc định liquid/lfm-2.5-2.6b:free; không thêm openai/ |
| NEXT_PUBLIC_FIREBASE_API_KEY | Browser | Firebase Web API key; Rules bảo vệ dữ liệu |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | Browser | Domain Firebase Auth |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | Browser | Project dữ liệu |
| NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET | Browser | Bucket Web App |
| NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | Browser | Sender ID |
| NEXT_PUBLIC_FIREBASE_APP_ID | Browser | Firebase app ID |
| FIREBASE_ADMIN_PROJECT_ID | Server secret/config | Project Admin |
| FIREBASE_ADMIN_CLIENT_EMAIL | Server secret | Service account |
| FIREBASE_ADMIN_PRIVATE_KEY | Server secret | Private key với newline escaped \\n |
| NEXT_PUBLIC_USE_EMULATORS | Test only | true kết nối Auth9099/Firestore8080; project phải demo- |
| FIRESTORE_EMULATOR_HOST | Test only | CLI tự đặt; không có http:// |
| FIREBASE_AUTH_EMULATOR_HOST | Test only | CLI tự đặt |
| GCLOUD_PROJECT | Test only | demo-shark-empti |
| OPENROUTER_TEST_URL | Test only | Fixture localhost9098; bị từ chối ở production hoặc ngoài demo Emulator |

Không in token/private key trong log, screenshot, báo cáo hay CI artifact. Không commit .env. Không bật biến emulator/fixture trong production.

## 3. Firebase và Vercel

Bật Google sign-in, thêm domain local/deployment vào authorized domains. Firebase Web config không cấp quyền Admin. API kiểm tra Bearer Firebase ID token bằng Admin SDK. Service account phải cùng project với client. Admin bypass Rules, vì vậy API phải tự kiểm tra UID, ownership, payload và transaction.

Trong Vercel chọn Node 24.x, cấu hình Web variables và server secrets cho đúng environment. Không đặt OPENROUTER_API_KEY hoặc Admin key dưới NEXT_PUBLIC_. Chạy build sau thay đổi. Đợt này không tự thay setting remote, deploy Rules hay deploy app.

## 4. Windows và Emulator

Cài JDK 21, bảo đảm java -version nhận đúng runtime. Cổng: app9002, Auth9099, Firestore8080, AI fixture9098. Không chạy đồng thời hai bộ Emulator trên cùng cổng.

```powershell
java -version
npm ci
npx playwright install chromium
npm run test:integration
npm run test:e2e
```

Nếu Windows báo UnixDomainSockets / Unable to establish loopback connection với đường dẫn TEMP chứa dấu, tạo một thư mục tạm ASCII riêng rồi cấu hình trong phiên shell:

```powershell
New-Item -ItemType Directory -Force C:\Users\Public\shark-empti-java-tmp
$env:JAVA_TOOL_OPTIONS='-Djava.io.tmpdir=C:\Users\Public\shark-empti-java-tmp -Djdk.net.unixdomain.tmpdir=C:\Users\Public\shark-empti-java-tmp'
npm run test:integration
```

Đây là workaround local, không cần trong CI Linux. Không xóa TEMP hoặc thư mục user để xử lý lỗi. vitest.integration.config.mts bắt buộc cả Auth và Firestore Emulator; không silently skip nếu thiếu. Các script luôn truyền --project demo-shark-empti; không truyền thêm --project sau npm run test:e2e vì tham số có thể đi vào Firebase CLI.

## 5. AI và chẩn đoán

Adapter ở src/ai/openrouter.ts dùng POST /api/v1/chat/completions. Mỗi attempt có timeout60s, tối đa hai retry cho lỗi mạng, 429 hoặc 5xx. Retry-After được giới hạn10s; backoff mặc định500ms rồi1000ms. Toàn bộ request có thể dài hơn60s vì nhiều attempt. Không retry lỗi authentication, cấu hình, JSON/schema output.

HTTP200 vẫn có thể chứa error. Adapter đọc body, kiểm tra envelope, parse content JSON rồi Zod validation. UI chỉ nhận mã lỗi và thông báo an toàn, không raw upstream body. Model availability/quota thay đổi theo thời gian; một lần smoke thành công không bảo đảm lần sau.

ai:health kiểm tra key có được khai báo, đọc danh mục /api/v1/models và metadata response_format của model. Nó KHÔNG xác thực key hợp lệ, quota hay khả năng inference; script cũng chưa có timeout riêng. ai:smoke sinh quiz và chat thực qua cùng flow, có thể tiêu thụ quota. Không chạy live smoke trong CI. Nếu 429, kiểm tra quota/cooldown; 401/403 kiểm tra key; timeout/transport kiểm tra mạng; AI-INVALID-RESPONSE kiểm tra khả năng structured output của model. Không thêm failover để che lỗi.

## 6. CI và release checklist

Workflow: npm ci → lint → typecheck → unit → Emulator/API/Rules → production build → install Chromium → E2E. Chỉ dùng project demo và fixture AI. Artifact failure giữ trace/screenshot; không đưa token hoặc dữ liệu thật vào fixtures.

Trước release: chạy đầy đủ suite, kiểm tra dependency paths, ảnh desktop/mobile VI/EN/light/dark, đo bundle cùng điều kiện, kiểm tra camera thật riêng. Không đánh dấu camera thật/Safari/Firefox đã qua chỉ vì Chromium giả lập qua. Kiểm tra cài mới npm ci và bảo đảm lockfile không lệch manifest.

## 7. Bảo toàn env, Git và artifact

Đợt đồng bộ tài liệu giữ nguyên các giá trị local có sẵn. Khi chủ project cấp rõ ràng service account khớp Firebase Web project, có thể thêm FIREBASE_ADMIN_* riêng tư vào .env để API Arena/Forum ngoài Emulator hoạt động; file tài liệu không ghi, in hoặc xác nhận credential cụ thể. API_KEYS/GEMINI_API_KEY/GOOGLE_GENAI_API_KEY là tên biến legacy không được src/scripts hiện tại đọc; không tự xóa giá trị local vì công cụ ngoài repo có thể còn dùng. Comment/placeholder không làm API sẵn sàng. Không đưa credential vào báo cáo hoặc tự thêm biến test hoạt động vào env production.

.gitignore bỏ qua .env và .env.*, ngoại trừ .env.example, cùng cache .firebase, output test, log debug, thư mục emulator-data và file credential theo tên quy ước. Không bỏ qua toàn bộ JSON hoặc Markdown. Kiểm tra bằng git check-ignore -v .env .env.production .env.test.local; .env.example và docs phải không bị ignore. Ignore không bỏ theo dõi file đã commit: nếu từng lộ secret, cần xử lý credential/history riêng với quyền rõ ràng; không tự rewrite Git history.

Artifact trong coverage/test-results/playwright-report có thể bị công cụ thay thế. Lưu kết luận và cách tái hiện trong tài liệu; chỉ giữ fixture tổng hợp không có secret trong tests. Trace có thể chứa token ngay cả khi screenshot không có; rà/redact trước khi chia sẻ. Không chạy dev, production build và E2E dùng cùng .next đồng thời. Không tăng timeout để che race; ghi điểm fail, ảnh đã tải hay còn loading, trace và kết quả rerun riêng.

## 8. Ma trận chẩn đoán cần dùng

| Dấu hiệu | Nguyên nhân đã biết / giả thuyết cần kiểm tra | Validate trước khi sửa |
|---|---|---|
| Health xanh nhưng AI báo auth/config | Metadata endpoint không xác thực key; thiếu Admin là vấn đề API khác | Dùng key sai có chủ đích trên endpoint không sinh nội dung; kiểm tra tên biến/mức hiện diện, không in giá trị; live smoke chỉ khi được phép |
| Arena retake báo conflict | ID và payload phải biểu diễn cùng một thao tác; retry mất response là tình huống khác | Ghi nhận ID/payload giả trên demo, kiểm tra new attempt khác ID và retry cùng ID |
| Create Post không mở ổn định ngay sau navigation | Auth restoration có thể thay đổi private subtree trong khi trang khởi tạo | Trì hoãn auth callback, kiểm tra loading và dialog; giữ reset UID, không sửa bằng sleep cố định |
| Forum WebKit còn loading | Hành vi SDK/Emulator/browser cần được cô lập | Tách SDK/Emulator/browser, xem subscription/network và test không interception; không nới CORS/Rules theo phỏng đoán |
| Firefox không khởi động | Có thể thiếu browser runtime prerequisite, không nhất thiết là lỗi app | Sửa prerequisite runtime của browser rồi chạy lại đúng suite; không đếm ca chưa khởi động thành fail chức năng |
| Chỉ in được phần đầu báo cáo | Dialog có thể giới hạn chiều cao/nội dung in | Print-media + PDF nhiều trang VI/EN; kiểm tra trang cuối, không chỉ ảnh viewport |

Workflow hiện build rồi chạy E2E trên npm run dev, không phải next start. Production-runtime E2E, browser tối thiểu, camera thật và so sánh baseline vẫn là các kiểm tra cần bổ sung trước release theo phạm vi thay đổi.

---

English below

# Configuration and troubleshooting · v1.15.1

English below. This guide does not certify that local/production configuration is complete.

## 1. Runtime and installation

Use Node 24.x locally, in CI and in Vercel project settings. .nvmrc and package.json engines agree on the major; @types/node follows the runtime major. Use npm ci to install the lockfile exactly; do not bypass peer conflicts with --force or --legacy-peer-deps.

Copy .env.example to .env only if .env does not exist; never overwrite configured credentials. Next loads environment variables; AI scripts use Node --env-file-if-exists=.env without dotenv. Existing process variables take precedence in Node. The current AI command loads .env only, not Next's complete env-file precedence sequence. Restart/rebuild after changing NEXT_PUBLIC_ variables because they are embedded in the client bundle.

## 2. Environment matrix

| Variable | Scope | Meaning |
|---|---|---|
| OPENROUTER_API_KEY | Server secret | AI Bearer key |
| OPENROUTER_MODEL | Server | Raw model ID, default liquid/lfm-2.5-2.6b:free; do not add openai/ |
| NEXT_PUBLIC_FIREBASE_API_KEY | Browser | Firebase Web API key; Rules protect data |
| NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN | Browser | Firebase Auth domain |
| NEXT_PUBLIC_FIREBASE_PROJECT_ID | Browser | Data project |
| NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET | Browser | Web App bucket |
| NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID | Browser | Sender ID |
| NEXT_PUBLIC_FIREBASE_APP_ID | Browser | Firebase app ID |
| FIREBASE_ADMIN_PROJECT_ID | Server secret/config | Admin project |
| FIREBASE_ADMIN_CLIENT_EMAIL | Server secret | Service account |
| FIREBASE_ADMIN_PRIVATE_KEY | Server secret | Private key with escaped \\n newlines |
| NEXT_PUBLIC_USE_EMULATORS | Test only | true connects Auth9099/Firestore8080; project must start demo- |
| FIRESTORE_EMULATOR_HOST | Test only | Set by CLI; no http:// |
| FIREBASE_AUTH_EMULATOR_HOST | Test only | Set by CLI |
| GCLOUD_PROJECT | Test only | demo-shark-empti |
| OPENROUTER_TEST_URL | Test only | localhost9098 fixture; rejected in production or outside demo Emulator |

Never print tokens/private keys in logs, screenshots, reports or CI artifacts. Never commit .env. Do not enable emulator/fixture variables in production.

## 3. Firebase and Vercel

Enable Google sign-in and add local/deployment domains to authorized domains. Firebase Web configuration does not grant Admin access. APIs verify Bearer Firebase ID tokens with Admin SDK. Service accounts must match the client project. Admin bypasses Rules, so APIs must enforce UID, ownership, payload and transaction checks themselves.

Select Node 24.x in Vercel and configure Web variables and server secrets for the correct environment. Never use NEXT_PUBLIC_ for OPENROUTER_API_KEY or Admin keys. Rebuild after changes. This pass does not modify remote settings, deploy Rules or deploy the app.

## 4. Windows and Emulator

Install JDK21 and ensure java -version selects it. Ports: app9002, Auth9099, Firestore8080, AI fixture9098. Do not run two Emulator suites on the same ports simultaneously.

```powershell
java -version
npm ci
npx playwright install chromium
npm run test:integration
npm run test:e2e
```

If Windows reports UnixDomainSockets / Unable to establish loopback connection with accented TEMP paths, create a dedicated ASCII temporary directory and configure the shell session:

```powershell
New-Item -ItemType Directory -Force C:\Users\Public\shark-empti-java-tmp
$env:JAVA_TOOL_OPTIONS='-Djava.io.tmpdir=C:\Users\Public\shark-empti-java-tmp -Djdk.net.unixdomain.tmpdir=C:\Users\Public\shark-empti-java-tmp'
npm run test:integration
```

This is a local workaround, unnecessary on Linux CI. Do not delete TEMP or user directories to address this issue. vitest.integration.config.mts requires both Auth and Firestore Emulator; it must not silently skip missing services. Scripts always pass --project demo-shark-empti; do not append --project to npm run test:e2e because it may be forwarded to Firebase CLI.

## 5. AI and troubleshooting

The adapter in src/ai/openrouter.ts uses POST /api/v1/chat/completions. Each attempt times out after60s, with at most two retries for network errors,429 or5xx. Retry-After is capped at10s; default backoff is500ms then1000ms. Total request time may exceed60s across attempts. Authentication, configuration and JSON/schema output errors are not retried.

HTTP200 may still contain error. The adapter reads the body, checks the envelope, parses content JSON and validates with Zod. UI receives safe codes/messages, never raw upstream bodies. Model availability/quota vary over time; one successful smoke run does not guarantee future success.

ai:health checks that a key is declared, reads /api/v1/models and checks model response_format metadata. It does NOT validate key authenticity, quota or inference, and it has no explicit timeout yet. ai:smoke generates a real quiz and chat through the same flows and may consume quota. Do not run live smoke in CI. For429 check quota/cooldown;401/403 check keys; timeout/transport check connectivity; AI-INVALID-RESPONSE check model structured-output support. Do not add failover to hide errors.

## 6. CI and release checklist

Workflow: npm ci → lint → typecheck → unit → Emulator/API/Rules → production build → install Chromium → E2E. Only demo project and AI fixtures are used. Failure artifacts retain traces/screenshots; never put real tokens or data in fixtures.

Before release: run the complete suite, inspect dependency paths, desktop/mobile VI/EN/light/dark screenshots, measure bundles under identical conditions and test a real camera separately. Do not mark real-camera/Safari/Firefox validation passed because fake Chromium tests pass. Verify a fresh npm ci and manifest/lockfile consistency.

## 7. Preserving env, Git and artifacts

Documentation synchronization preserves existing local values. When the project owner explicitly supplies a service account matching the Firebase Web project, FIREBASE_ADMIN_* may be added privately to .env for non-emulator Arena/Forum APIs; documentation never records, prints or certifies a specific credential. API_KEYS/GEMINI_API_KEY/GOOGLE_GENAI_API_KEY are legacy names not read by current src/scripts; local values are not deleted because external tools may still consume them. Comments/placeholders do not configure the API. Never copy credentials into reports or activate test variables in production env files.

.gitignore excludes .env and .env.* except .env.example, plus .firebase cache, test output, debug logs, emulator-data and conventionally named credential files. It does not ignore all JSON or Markdown. Verify using git check-ignore -v .env .env.production .env.test.local; .env.example and docs must remain visible. Ignore rules do not untrack committed files: exposed secrets require a separate authorized credential/history response; never rewrite Git history automatically.

Tools may replace artifacts in coverage/test-results/playwright-report. Keep conclusions and reproduction instructions in documentation; commit only synthetic, secret-free fixtures in tests. Traces can contain tokens even if screenshots do not; inspect/redact before sharing. Do not concurrently run dev, production build and E2E against the same .next directory. Do not increase timeouts to hide races; record the failing step, whether the page loaded, its trace and separate rerun results.

## 8. Troubleshooting matrix

| Symptom | Known cause / hypothesis to investigate | Validate before changing code |
|---|---|---|
| Health passes but AI reports auth/config errors | Model metadata does not authenticate keys; missing Admin is a separate API issue | Use an intentionally invalid key with a non-generating endpoint; inspect variable names/presence, not values; live smoke only when authorized |
| Arena retake conflicts | ID and payload must represent the same operation; retry after a lost response is different | Observe synthetic IDs/payloads on demo; new attempts get different IDs, retries retain the same ID |
| Create Post opens inconsistently after navigation | Auth restoration can replace a private subtree while the page initializes | Delay auth callbacks, inspect loading/dialog state; retain UID reset and do not fix with a fixed sleep |
| Forum keeps loading in WebKit | SDK/Emulator/browser behavior must be isolated | Isolate SDK/Emulator/browser, inspect subscriptions/network and run without interception; do not weaken CORS/Rules speculatively |
| Firefox does not launch | A browser runtime prerequisite may be missing; this is not necessarily an app failure | Repair the runtime prerequisite, then rerun the same suite; do not count an unstarted browser as a functional failure |
| Only the beginning of a report prints | A dialog may constrain printable height/content | Print-media plus multi-page VI/EN PDF; inspect the final page, not just the viewport |

The workflow builds and then runs E2E against npm run dev, not next start. Production-runtime E2E, minimum browser versions, a physical camera and comparable baselines remain additional release checks according to the scope of change.

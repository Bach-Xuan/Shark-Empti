# Shark Empti · v1.15.1

English below. Đây là trang bắt đầu: phạm vi, lệnh phát triển và tài liệu kỹ thuật của ứng dụng.

Nền tảng học tập với quiz AI, phân tích kết quả, flashcards, bài luyện tập, Forum, Arena và Focus Shield. Đợt tối ưu thứ hai giữ URL, dữ liệu lịch sử và quy tắc tính điểm; không deploy hoặc sửa dữ liệu production.

## Học có định hướng, thấy rõ tiến bộ

Shark Empti biến một chủ đề bạn muốn chinh phục thành hành trình học tập rõ ràng: tạo quiz theo môn, trình độ và độ khó; nhận phản hồi để hiểu điểm mạnh/yếu; rồi luyện lại bằng flashcards và bài thực hành. Dashboard biến lịch sử làm bài thành insight, còn Shark Guru sẵn sàng giải thích khi bạn cần một gợi ý.

- **Quiz AI và phản hồi cá nhân hóa:** tạo câu hỏi, chấm Short Answer, phân tích lỗi và đề xuất bước tiếp theo.
- **Practice, Flashcards và Dashboard:** củng cố đúng điểm cần luyện, theo dõi hoạt động và tiến bộ qua thời gian.
- **Arena và Forum:** tạo thử thách cộng đồng, bảng xếp hạng, thảo luận và tương tác học tập.
- **Focus Shield:** hỗ trợ duy trì sự tập trung bằng camera chạy ngay trong trình duyệt khi bạn chủ động bật.

AI luôn được kiểm tra schema ở server và dùng fallback OpenRouter để trải nghiệm không phụ thuộc vào một model duy nhất. Kết quả AI là hỗ trợ học tập, không thay thế việc tự kiểm chứng kiến thức.

Khi AI không hoàn tất, popup giữ mã lỗi và metadata an toàn như thao tác, số model đã thử, lỗi cuối và HTTP status nếu có; không hiển thị prompt, phản hồi raw, stack trace hay secret.

## Bắt đầu

Yêu cầu Node 24, npm và cấu hình Firebase Web App. Dùng PowerShell trên Windows:

```powershell
if (-not (Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath .env.example -Destination .env }
# Điền cấu hình Firebase và OpenRouter trong .env; không commit file này.
npm ci
npm run dev
```

Mở http://localhost:9002. Bật Google provider và authorized domain trong Firebase Authentication. Các API Forum/Arena cần Firebase Admin; AI cần OPENROUTER_API_KEY. Không đưa secret vào biến NEXT_PUBLIC_.

## Công nghệ và phạm vi

Next 16 / React 19, Firebase Auth + Firestore, Zod 4, Tailwind 4, Radix, Recharts và KaTeX. AI dùng fetch OpenRouter trực tiếp với fallback server-side theo thứ tự Inkling → Gemma → Nemotron. Khi khởi động, browser lên lịch probe nền không chặn UI; flow thực vẫn tự fallback nếu probe chưa xong hoặc model đổi trạng thái. TensorFlow chỉ tải runtime/model khi bật Focus Shield. Genkit, Dev UI và Jaeger đã được loại bỏ.

Trình duyệt mục tiêu: Safari 16.4+, Chrome 111+, Firefox 128+. E2E hiện cấu hình Chromium desktop/mobile; đây không phải bằng chứng đã kiểm thử mọi trình duyệt mục tiêu.

Giao diện hỗ trợ VI/EN, lưu ngôn ngữ/theme giữa trang và tab. Không dịch lại dữ liệu người dùng hoặc lịch sử khi đổi ngôn ngữ. Camera chạy trong trình duyệt, cần HTTPS hoặc localhost và quyền camera.

## Lệnh kiểm tra

| Lệnh | Mục đích |
|---|---|
| npm run lint | ESLint, Next và React Hooks |
| npm run typecheck | TypeScript không phát sinh JavaScript |
| npm test | Unit/component, không cần production |
| npm run test:coverage | Coverage V8 |
| npm run test:integration | Auth/Firestore Emulator, Rules và API |
| npm run test:rules | Chỉ kiểm tra Rules qua Emulator |
| npm run build | Build production |
| npm run test:e2e | App thật, Emulator và AI fixture, Chromium desktop/mobile |
| npm run ai:health | Kiểm tra metadata model, không xác thực key/quota hoặc khả năng sinh nội dung |
| npm run ai:smoke | Quiz và chatbot thật; có thể tiêu thụ quota |
| npm run clean | Chỉ xóa cache .next, giữ node_modules |

Integration/E2E cần Java 21 và trình duyệt Playwright: `npx playwright install chromium`. Không chạy integration trực tiếp thiếu Emulator: cấu hình phải báo thất bại. CI nằm ở .github/workflows/ci.yml và dùng demo-shark-empti, không cần secret production.

## Tài liệu

- [Cấu hình, Windows, CI/Vercel và chẩn đoán](docs/CONFIGURATION.md).
- [Kiến trúc, contracts, bảo trì, dependency inventory và giới hạn](docs/TECHNICAL_DOCUMENTATION.md).

Có test không đồng nghĩa tất cả kịch bản đã được chứng minh. Xem báo cáo chạy thực tế trước khi release; không coi ảnh chụp sau migration là so sánh trước/sau. Giữ phiên bản 1.15.1; chỉ deploy sau một yêu cầu riêng.

Chạy các lệnh kiểm tra phù hợp với thay đổi trước khi bàn giao. Kết quả chỉ có ý nghĩa cho đúng môi trường, fixture và thời điểm chạy; kiểm thử browser, camera thật và dịch vụ AI trực tiếp cần được xác nhận riêng khi phạm vi thay đổi liên quan.

Ba tài liệu chính dùng Việt–Anh trong cùng file. AGENTS.md/CLAUDE.md chỉ dẫn quy trình bảo trì; docs/backend.json là sơ đồ dữ liệu có chú thích, không phải validator hoặc nguồn Rules. Không lưu báo cáo lâu dài trong coverage/test-results vì công cụ có thể tạo lại chúng. .gitignore bảo vệ các biến thể .env và artifact local; nó không xóa secret đã từng được theo dõi bởi Git.

---

English below

# Shark Empti · v1.15.1

English below. This is the starting page for the application scope, development commands and technical documentation.

A learning platform with AI quizzes, performance feedback, flashcards, practice, Forum, Arena and Focus Shield. The second optimization pass preserves URLs, historical data and scoring rules; it does not deploy or modify production data.

## Learn with direction and see your progress

Shark Empti turns a topic you want to master into a clear learning journey: create quizzes by subject, level and difficulty; use feedback to understand strengths and gaps; then reinforce them through flashcards and practice. The dashboard turns attempt history into insight, while Shark Guru is ready to explain when you need a hint.

- **AI quizzes and personalized feedback:** generate questions, assess short answers, analyse mistakes and suggest next steps.
- **Practice, Flashcards and Dashboard:** reinforce the right skills and follow activity and progress over time.
- **Arena and Forum:** create community challenges, follow leaderboards and discuss learning.
- **Focus Shield:** supports concentration with an in-browser camera feature when you choose to enable it.

AI responses are schema-validated on the server and use OpenRouter fallback, so the experience does not depend on one model alone. AI output supports learning; it does not replace checking your own understanding.

When AI cannot complete a request, the popup retains an error code and safe metadata such as operation, attempted-model count, last failure and HTTP status when available; it never shows prompts, raw responses, stack traces or secrets.

## Getting started

Requires Node 24, npm and Firebase Web App configuration. On Windows, use PowerShell:

```powershell
if (-not (Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath .env.example -Destination .env }
# Fill Firebase and OpenRouter settings in .env; never commit this file.
npm ci
npm run dev
```

Open http://localhost:9002. Enable the Google provider and authorized domain in Firebase Authentication. Forum/Arena APIs require Firebase Admin; AI requires OPENROUTER_API_KEY. Never put secrets in NEXT_PUBLIC_ variables.

## Technology and scope

Next 16 / React 19, Firebase Auth + Firestore, Zod 4, Tailwind 4, Radix, Recharts and KaTeX. AI uses direct OpenRouter fetch with server-side fallback in this order: Inkling → Gemma → Nemotron. On startup, the browser schedules a background probe that never blocks the UI; real flows still fall back if the probe has not completed or model availability changes. TensorFlow runtime/model load when Focus Shield is enabled. Genkit, its Dev UI and Jaeger have been removed.

Target browsers: Safari 16.4+, Chrome 111+, Firefox 128+. E2E currently configures desktop/mobile Chromium; this is not evidence that every target browser has been tested.

The UI supports VI/EN with shared language/theme persistence across pages and tabs. Changing language does not translate user content or historical data. Camera inference runs in the browser and requires HTTPS or localhost plus camera permission.

## Validation commands

| Command | Purpose |
|---|---|
| npm run lint | ESLint, Next and React Hooks |
| npm run typecheck | TypeScript without JavaScript output |
| npm test | Unit/component tests without production |
| npm run test:coverage | V8 coverage |
| npm run test:integration | Auth/Firestore Emulator, Rules and API |
| npm run test:rules | Rules-only Emulator validation |
| npm run build | Production build |
| npm run test:e2e | Real app, Emulator and AI fixture, desktop/mobile Chromium |
| npm run ai:health | Check model metadata, not key validity/quota or successful inference |
| npm run ai:smoke | Live quiz and chatbot; may consume quota |
| npm run clean | Remove only .next cache, retain node_modules |

Integration/E2E require Java 21 and Playwright browsers: `npx playwright install chromium`. Do not run integration directly without Emulator: configuration must fail. CI lives in .github/workflows/ci.yml and uses demo-shark-empti without production secrets.

## Documentation

- [Configuration, Windows, CI/Vercel and troubleshooting](docs/CONFIGURATION.md).
- [Architecture, contracts, maintenance, dependency inventory and limitations](docs/TECHNICAL_DOCUMENTATION.md).

Having tests does not prove every scenario. Review actual execution results before release; post-migration screenshots are not before/after comparisons. Version remains 1.15.1; deployment requires a separate request.

Run validation commands appropriate to the change before handoff. Results apply only to the environment, fixtures and time in which they ran; browser coverage, physical cameras and live AI services need separate confirmation when the change involves them.

The three main documents keep Vietnamese and English in the same file. Agent instruction files, when present, provide maintenance guidance; docs/backend.json is an annotated data map, not a validator or Rules source. Keep durable reports out of coverage/test-results because tools may recreate them. .gitignore protects .env variants and local artifacts; it does not remove secrets already tracked by Git.

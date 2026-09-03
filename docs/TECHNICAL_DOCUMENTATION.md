# 🛠️ Tài liệu kỹ thuật · Shark Empti v1.15.1

English below. Tài liệu này mô tả kiến trúc, hợp đồng kỹ thuật, cấu hình và cách bảo trì ứng dụng.

## 1. 🎯 Phạm vi và baseline

Đợt thứ hai bắt đầu trên worktree đã có thay đổi chưa commit từ đợt trước. Không dùng git diff tổng để quy toàn bộ thay đổi cho đợt này. Baseline gồm API Admin Forum/Arena, cấu hình model, cải thiện prompt, next/font và chỉnh docs/lint trước đó. Đợt mới thêm transport fetch/Zod, nâng dependency, provider chung, reducer, idempotency, Rules hardening, test/CI và sửa song ngữ. Giữ version1.15.1, URL và dữ liệu; không migration production hoặc failover model.

## 2. 🏗️ Kiến trúc và ownership

App Router server layout cung cấp font/CSS, AppPreferencesProvider và FirebaseClientProvider. Provider preference sở hữu lang/theme, validate storage, cập nhật html.lang/dark và nhận storage event từ tab khác. Các hooks useLanguageState/useThemeState không tự tạo state riêng. Root error UI không phụ thuộc Firebase.

FirebaseProvider sở hữu một onAuthStateChanged. useUser chỉ đọc context; key UID ở subtree riêng tư làm reset component state khi đổi tài khoản/logout. Preference provider nằm ngoài subtree nên lựa chọn VI/EN/theme không mất. Không đặt dialog/input/tooltip vào global state.

Home sở hữu navigation/view, learningSessionReducer, history subscription và notes hook. Reducer mô hình hóa setup/loading/quiz/result/error nhưng Home chưa dispatch fail/reset; Quiz vẫn sở hữu loading/error, câu trả lời, timer và pending flags. UI language thay đổi không sinh bộ câu hỏi mới. Các luồng Quiz/Playground bỏ qua response sau unmount; các callback bất đồng bộ khác phải áp dụng cùng nguyên tắc kiểm tra vòng đời. Kết quả Arena chưa lưu được giữ trong ref, retry giữ cùng payload/request ID và không phân tích lại. Auth dùng key UID để cách ly state; thao tác riêng tư chỉ nên bắt đầu khi trạng thái xác thực đã ổn định.

History được tính thống kê một lần tại Home qua memo và truyền Dashboard. Dashboard/playground dùng dynamic import. Nhãn dịch hiện vẫn tham gia một phần phép tính thống kê: chưa được tách hoàn toàn khỏi dữ liệu số. Không tuyên bố mọi phép tính không chạy lại khi đổi locale.

## 3. 🔄 Data flow và dữ liệu tương thích

Quiz: Setup → academic validation → generateQuestions → trả lời/timer → feedback → result → users/{uid}/history → dashboard. Short Answer thường dùng AI; numeric Arena dùng đáp án số chuẩn. Không sửa nội dung lịch sử khi đổi VI/EN.

Firestore chính:

- users/{uid}: profile và sharkCoins; coins chỉ Admin cập nhật.
- users/{uid}/history/{id}: config, quizResults, totalTime, analysis?, date ISO, lang; ID từ document.
- users/{uid}/notes/main: content và updatedAt.
- users/{uid}/activity/main: activeDays map YYYY-MM-DD → boolean và updatedAt; calendar gọi trackToday khi sẵn sàng, không phải chứng nhận đã hoàn tất quiz.
- users/{uid}/flashcards/{id}: userId/sourceType/sourceValue/cards/createdAt ISO; users/{uid}/practice/{id}: userId/concept/questions/userAnswers/score/createdAt ISO.
- posts/{id}: title/content/subject/author, createdAt, likesCount, likedBy, commentsCount; comments nằm ở subcollection.
- arenaExams/{id}: title/config/questions/author, totalAttempts; attempts lưu score/duration/user.
- _requestReceipts/{hash}: fingerprint, result, createdAt; chỉ Admin.

Dữ liệu cũ thiếu analysis/nhãn topic được hiển thị bằng fallback hiện có. Legacy Arena không có đáp án numeric đáng tin bị từ chối chấm bằng contract hiện tại. Không backfill lịch sử. History được đọc qua Zod với default cho trường legacy thiếu; core record hỏng được bỏ khỏi phần hiển thị và phát mã APP-DATA-INVALID, không sửa/xóa bản lưu. Một số boundary profile/Forum/Arena vẫn còn cast cần tiếp tục schema hóa.

Notes hook trả Promise<boolean>; chỉ báo lưu thành công sau setDoc resolve. Document không tồn tại trả chuỗi rỗng. Subscription cleanup bỏ snapshot muộn. QuickNotes giữ draft khi ghi lỗi và không áp snapshot đè draft dirty. Khi đổi UID, private subtree bị remount, không giữ draft của tài khoản cũ.

Roadmap mới lưu ở localStorage `shark_roadmap_checks:{uid}` và validate bản đồ boolean trước khi đọc. Khóa legacy `shark_roadmap_checks` không có UID: giữ nguyên nhưng không tự nhập vào tài khoản hiện tại, vì không xác định được chủ sở hữu. Người dùng có thể thấy checklist mới trống; dữ liệu cũ không bị xóa. Khôi phục/import legacy cần xác nhận đúng tài khoản trước khi gán. Ngôn ngữ/theme tiếp tục dùng khóa cũ `shark_lang`/`shark_theme`.

Test `ui-copy.test.ts` duyệt AST của TSX để chặn text JSX và title/placeholder/aria-label/alt tĩnh ngoài ngoại lệ: thương hiệu/version, SHARK COINS, English, Tiếng Việt và UID. Đây không phải bằng chứng mọi chuỗi động đều đã dịch; chuỗi tạo trong event handler/prompt/export vẫn cần kiểm tra riêng.

## 4. 🔐 API, authentication và idempotency

src/lib/server-api.ts gom Bearer token verification, ApiError, apiFailure và transaction receipt. Route handler phải parse payload và kiểm tra ownership sau auth; Admin bypass Rules.

Arena POST /api/arena/{examId}/submit nhận answers:string[], duration? và requestId?:UUID. Comment POST /api/forum/{postId}/comments nhận content và requestId?:UUID. Comment DELETE /api/forum/{postId}/comments?commentId={commentId} kiểm tra quyền. Response thành công giữ contract trước; lỗi luôn có error:string, code:string, values:object để client dịch. Không đưa exception/stack/token upstream vào response.

Receipt key = SHA256(scope, UID, requestId); fingerprint từ payload đã parse. Cùng ID/cùng payload trả kết quả cũ; khác payload trả409 APP-REQUEST-CONFLICT. Transaction gồm đọc receipt, business writes/counter/coin và tạo receipt, chống race giữa hai request đồng thời. requestId còn optional cho client cũ; client mới luôn gửi. Không có receipt khi client cũ bỏ ID. Receipt chưa có TTL, cần chính sách retention riêng, không tự xóa.

Contract yêu cầu UI khóa submit đồng thời, thao tác mới có ID mới và retry sau response mất giữ payload cũ kể cả duration. Mọi đường bắt đầu hoặc làm lại phải duy trì phân biệt này. Idempotency không chống gian lận toàn Arena: nghiệp vụ vẫn cho làm lại có điểm/thưởng; không có trusted exam timer hay secrecy của đáp án.

## 5. 🛡️ Rules và xử lý lỗi

Post create yêu cầu author self, counters0 và likedBy rỗng. Author update chỉ title/content/subject/updatedAt; comment update chỉ content/updatedAt. Like chỉ cho phép delta đúng theo UID và không trùng likedBy. Tác giả không được bypass counter/like checks. Comment create/delete và Arena attempts dùng Admin API. Arena create totalAttempts0; update chỉ title/config/questions.

Wildcard users/{uid}/{collection}/{document=**} chỉ áp dụng subcollection; không dùng users/{uid}/{document=**} vì Rulesv2 có thể match zero segments và vô tình cho đổi coins tại profile. Test Emulator phải giữ regression này.

Route error.tsx và global-error.tsx dùng retry của Next16. ErrorBoundary riêng bọc Focus và Dashboard; lỗi render không kéo toàn app xuống. Global fallback có HTML/body và không cần Firebase/context bắt buộc. Lỗi event/request/camera/clipboard/subscription phải catch tại nguồn, không trông chờ boundary.

Mã an toàn qua i18n/errors và error-toast. Chẩn đoán toast chỉ allowlist `httpStatus`, `providerCode`, `retryAfterSeconds`, `operation`, `attemptedModels` và `lastFailure`. Khi adapter cạn fallback, nó trả `AI-FALLBACK-EXHAUSTED` với số model đã thử và mã lỗi cuối; không trả tên model, raw provider payload, prompt, stack hoặc secret. FirestorePermissionError là tên export tương thích; nội bộ phân loại permission/unavailable/auth/not-found/generic bằng cause, không tự coi mọi lỗi là permission. Callsite chưa truyền cause sẽ hiện lỗi chung.

## 6. 🤖 AI transport, prompt và Focus Shield

Bảy public flow giữ tên hàm/input/output/AppResult: academic-validation, generate-questions, generate-flashcards, generate-practice, short-answer-analysis, personalized-quiz-feedback, ai-coaching-chatbot. Input được Zod parse; adapter dùng fallback chung Inkling → Gemma → Nemotron và luôn validate response bằng Zod. Gemma nhận JSON Schema native; Inkling/Nemotron nhận JSON-only để tránh gửi `response_format` không được metadata của chúng quảng cáo. Không có framework thay Genkit hoặc key rotation.

Base prompt chỉ dùng vai trò Shark Guru, phong cách, locale và LaTeX. Luật số câu, loại câu, rubric feedback và numeric Arena nằm trong flow. JSON dữ liệu người dùng được đánh dấu là task data, không instruction override; đây là giảm nhập nhằng, không bảo đảm miễn nhiễm prompt injection. Chat history model được map assistant; toàn bộ context review được đưa vào prompt.

Timeout/retry và env được mô tả trong CONFIGURATION.md. Unit fixtures không gọi mạng ngoài; live smoke là kiểm tra riêng, không coi HTTP200 là thành công nếu body error/schema sai.

Focus Shield import type TensorFlow ở đầu file; import() runtime chỉ trong loadModel sau thao tác bật. Turbopack dev có thể gửi manifest async-loader nhỏ trước đó; manifest không phải runtime/model. generationRef chặn model/stream đến muộn; startingRef khóa khởi tạo đồng thời. Stop/unmount dispose model, dừng track và cancelAnimationFrame. tf.tidy dọn tensors; inference throttle800ms. Kiểm tra camera thật, quyền bị từ chối, model load lỗi và cleanup phải được ghi kết quả riêng.

## 7. 🌐 Song ngữ và bảo trì

translations.ts giữ catalog nghiệp vụ; i18n/common.ts và errors.ts bổ sung UI/error dùng chung; UiText truy cập catalog common có kiểu. i18n/ui.ts gom 89 vị trí chuỗi UI trước đây inline, với key có prefix chức năng; i18n/index.ts cung cấp messages/uiMessage. Snippet LaTeX dùng catalog riêng. Kiểm tra JSX text tĩnh không thay thế rà nội dung động. Test parity so key và interpolation ở cả VI/EN. Thương hiệu Shark Empti/Shark Guru, mã lỗi, tên model, ký hiệu khoa học/LaTeX và nội dung người dùng là ngoại lệ không dịch tự động. Đổi locale không gọi AI để dịch lịch sử.

Thêm translation: khai báo cả en/vi, giữ placeholder trùng, dùng API catalog trong UI, thêm test hai locale và kiểm tra mobile với tiếng Việt dài.
Thêm flow: schema input/output, prompt riêng + base rules, AppResult, fixtures success/error, timeout/retry test tại adapter; không import secret module vào client.
Thêm API: auth trước business logic, Zod input, stable code/error string, quyền tác giả và transaction, requestId nếu ghi có thể retry; test missing/invalid token/payload, concurrency và conflict.
Thêm subscription: một owner, reset khi key đổi, unsubscribe và bỏ response cũ, error cause an toàn; test account switch.
Thêm test: unit/component vào tests, integration Node vào tests/integration; Rules chỉ chạy qua Emulator. E2E dùng demo project và localhost AI fixture; không thêm credential production.
Nâng dependency: xem engines/peers, nâng theo nhóm, cài không force, chạy suite liên quan; cập nhật cả lockfile và bảng bên dưới. ESLint set-state-in-effect hiện tắt để cho phép khởi tạo browser state/subscriptions; purity/static-components/exhaustive-deps vẫn bật.

## 8. 📦 Danh mục dependency trực tiếp

Baseline là range trong manifest, không giả lập phiên bản đã cài trước đó. Đích là resolution chính xác trong lockfile đợt này.

| Package | Baseline manifest | Đích đã khóa | Nơi dùng / lý do / kiểm tra |
|---|---|---|---|
| @firebase/rules-unit-testing | ^4.0.1 | 5.0.2 | Emulator rules tests; migration5; test:rules |
| @playwright/test | — | 1.62.1 | Browser fixtures desktop/mobile; E2E + screenshot |
| @radix-ui/react-alert-dialog | ^1.1.6 | 1.1.23 | src/components/ui; giữ primitive accessible; kiểm tra keyboard/dialog/E2E |
| @radix-ui/react-avatar | ^1.1.3 | 1.2.6 | src/components/ui; giữ primitive accessible; kiểm tra keyboard/dialog/E2E |
| @radix-ui/react-checkbox | ^1.1.4 | 1.3.11 | src/components/ui; giữ primitive accessible; kiểm tra keyboard/dialog/E2E |
| @radix-ui/react-dialog | ^1.1.6 | 1.1.23 | src/components/ui; giữ primitive accessible; kiểm tra keyboard/dialog/E2E |
| @radix-ui/react-dropdown-menu | ^2.1.6 | 2.1.24 | src/components/ui; giữ primitive accessible; kiểm tra keyboard/dialog/E2E |
| @radix-ui/react-label | ^2.1.2 | 2.1.15 | src/components/ui; giữ primitive accessible; kiểm tra keyboard/dialog/E2E |
| @radix-ui/react-progress | ^1.1.2 | 1.1.16 | src/components/ui; giữ primitive accessible; kiểm tra keyboard/dialog/E2E |
| @radix-ui/react-radio-group | ^1.2.3 | 1.4.7 | src/components/ui; giữ primitive accessible; kiểm tra keyboard/dialog/E2E |
| @radix-ui/react-scroll-area | ^1.2.3 | 1.2.18 | src/components/ui; giữ primitive accessible; kiểm tra keyboard/dialog/E2E |
| @radix-ui/react-select | ^2.1.6 | 2.3.7 | src/components/ui; giữ primitive accessible; kiểm tra keyboard/dialog/E2E |
| @radix-ui/react-slot | ^1.2.3 | 1.3.3 | src/components/ui; giữ primitive accessible; kiểm tra keyboard/dialog/E2E |
| @radix-ui/react-switch | ^1.1.3 | 1.3.7 | src/components/ui; giữ primitive accessible; kiểm tra keyboard/dialog/E2E |
| @radix-ui/react-tabs | ^1.1.3 | 1.1.21 | src/components/ui; giữ primitive accessible; kiểm tra keyboard/dialog/E2E |
| @radix-ui/react-toast | ^1.2.6 | 1.2.23 | src/components/ui; giữ primitive accessible; kiểm tra keyboard/dialog/E2E |
| @radix-ui/react-tooltip | ^1.1.8 | 1.2.16 | src/components/ui; giữ primitive accessible; kiểm tra keyboard/dialog/E2E |
| @tailwindcss/postcss | — | 4.3.3 | PostCSS4 integration mới; thay plugin3; build |
| @tensorflow/tfjs | ^4.22.0 | 4.22.0 | FocusTrackerWidget; dynamic import, CPU/WebGL; camera tests |
| @testing-library/react | ^16.3.0 | 16.3.3 | Component hành vi; Vitest |
| @testing-library/user-event | ^14.6.1 | 14.6.7 | Tương tác component; Vitest |
| @types/katex | ^0.16.7 | 0.16.8 | Kiểu parser KaTeX; typecheck |
| @types/node | ^20.19.43 | 24.13.3 | Theo Node24, không chạy theo latest major; typecheck |
| @types/react | ^19.2.1 | 19.2.18 | Theo React19; typecheck |
| @types/react-dom | ^19.2.1 | 19.2.6 | Theo React DOM19; typecheck |
| @vitest/coverage-v8 | ^3.2.4 | 4.1.11 | Đồng bộ Vitest; báo coverage V8 |
| class-variance-authority | ^0.7.1 | 0.7.1 | UI variants; giữ kiểu variants; typecheck |
| clsx | ^2.1.1 | 2.1.1 | lib/utils; class điều kiện; UI |
| eslint | ^9.39.5 | 9.39.5 | 9.39.5 thay vì10: react/jsx-a11y peers chỉ đến9; lint |
| eslint-config-next | ^15.5.9 | 16.3.4 | Flat config đồng bộ Next16; lint |
| firebase | ^11.9.1 | 12.18.0 | src/firebase và client data; Auth/Firestore; Emulator + E2E |
| firebase-admin | ^13.10.0 | 14.3.0 | server API/token/transaction; giữ server-only; API integration |
| firebase-tools | ^15.1.0 | 15.29.0 | CLI emulator/CI; dev-only; integration + E2E |
| jsdom | ^26.1.0 | 30.0.1 | Unit DOM; migration30; component tests |
| katex | ^0.16.11 | 0.18.5 | LatexText; giữ parser phức tạp; công thức và ảnh |
| lucide-react | ^0.475.0 | 1.40.0 | Icon UI; migration1; typecheck + ảnh |
| next | 15.5.9 | 16.3.4 | App Router/server actions; migration16; build + E2E |
| postcss | ^8 | 8.5.27 | CSS pipeline; Tailwind4 plugin; build |
| react | ^19.2.1 | 19.2.8 | Provider/hooks; cập nhật19; component + E2E |
| react-dom | ^19.2.1 | 19.2.8 | Hydration/portal; đồng bộ React; component + E2E |
| recharts | ^2.15.1 | 3.10.1 | Dashboard trực tiếp; migration3, bỏ wrapper vô chủ; ảnh/chart |
| server-only | — | 0.0.1 | Chặn import server secret vào client; build |
| tailwind-merge | ^3.0.1 | 3.6.0 | lib/utils; giữ giải quyết xung đột class; unit/UI |
| tailwindcss | ^3.4.1 | 4.3.3 | globals.css/config.mts; migration4; build + visual QA |
| tailwindcss-animate | ^1.0.7 | 1.0.7 | Config plugin; giữ animations; build/ảnh |
| tsx | — | 4.23.13 | Node scripts TypeScript; ai:health/ai:smoke |
| typescript | ^5 | 6.0.3 | 6.0.3 thay vì7: typescript-eslint yêu cầu <6.1; typecheck |
| vitest | ^3.2.4 | 4.1.11 | Unit và integration configs .mts; OXC JSX automatic; tests |
| zod | ^3.24.2 | 4.5.4 | src/ai và API; schema4/JSON Schema; flow + API fixtures |

### Dependency trực tiếp đã bỏ

| Package | Baseline | Lý do / kiểm tra |
|---|---|---|
| @genkit-ai/compat-oai | ^1.37.0 | Thay stack AI bằng fetch/Zod; flow fixtures |
| @opentelemetry/exporter-jaeger | 1.25.1 | Thay stack AI bằng fetch/Zod; flow fixtures |
| @radix-ui/react-accordion | ^1.2.3 | Không còn consumer từ route roots; xóa wrapper kèm; build/E2E |
| @radix-ui/react-collapsible | ^1.1.11 | Không còn consumer từ route roots; xóa wrapper kèm; build/E2E |
| @radix-ui/react-menubar | ^1.1.6 | Không còn consumer từ route roots; xóa wrapper kèm; build/E2E |
| @radix-ui/react-popover | ^1.1.6 | Không còn consumer từ route roots; xóa wrapper kèm; build/E2E |
| @radix-ui/react-separator | ^1.1.2 | Không còn consumer từ route roots; xóa wrapper kèm; build/E2E |
| @radix-ui/react-slider | ^1.2.3 | Không còn consumer từ route roots; xóa wrapper kèm; build/E2E |
| @tensorflow/tfjs-backend-webgl | ^4.22.0 | Đã có qua tfjs; bỏ khai báo trực tiếp trùng |
| date-fns | ^3.6.0 | Intl; kiểm tra locale |
| dotenv | ^16.5.0 | Node env-file; kiểm tra scripts |
| embla-carousel-react | ^8.6.0 | Không còn consumer từ route roots; xóa wrapper kèm; build/E2E |
| genkit | ^1.28.0 | Thay stack AI bằng fetch/Zod; flow fixtures |
| react-day-picker | ^9.11.3 | Không còn consumer từ route roots; xóa wrapper kèm; build/E2E |
| react-hook-form | ^7.54.2 | Không còn consumer từ route roots; xóa wrapper kèm; build/E2E |
| genkit-cli | ^1.28.0 | Thay stack AI bằng fetch/Zod; flow fixtures |

## 9. ✅ Kiểm thử, số đo và giới hạn

Unit/component tách khỏi integration Node/Emulator. Regression đã thêm cho adapter, bảy flow, preferences, reducer, boundary và catalog parity; integration kiểm tra API concurrent/idempotency/auth/legacy cùng Rules. Playwright chạy app thật với Auth popup giả lập và AI fixture. Xem output chạy thực tế để biết pass/fail; file test tồn tại không chứng minh acceptance đã đầy đủ.

Không có bộ ảnh trước migration được chụp đầy đủ ở cùng điều kiện. Không thể dùng ảnh sau hoặc báo cáo First Load JS Next15 để khẳng định phần trăm tăng tốc Next16. Cần đo cold load, bytes script, tương tác dashboard/quiz và snapshot light/dark ở cùng máy/browser. Camera thật và Safari/Firefox vẫn cần kiểm chứng riêng. E2E thêm lỗi có kiểm soát tại matchMedia của dashboard: fallback hiện, navigation còn hoạt động và Retry khôi phục nội dung, không thêm cổng gây lỗi vào mã production.

Kiểm tra dependency trước release bằng `npm audit --json`, sau đó đánh giá đường phụ thuộc, mức áp dụng thực tế và peer dependencies trước khi nâng, override hoặc hạ phiên bản. Không dùng `--force` hay `--legacy-peer-deps` để che xung đột. CLI và Emulator chỉ dùng endpoint local/demo trong kiểm thử.

TypeScript6.0.3 và ESLint9.39.5 giữ dưới latest vì peer compatibility; @types/node24 cố ý theo runtime. Không tự viết lại accessibility/schema/LaTeX/chart chỉ để giảm package. Tailwind4 đổi pipeline; cần kiểm tra riêng border/shadow/ring/dark/animation trước release. Không cam kết “không có bug”.


### Ghi chú migration CSS và live AI

Đã ánh xạ shadow-sm → shadow-xs, blur-sm → blur-xs và outline-none → outline-hidden theo [hướng dẫn Tailwind](https://tailwindcss.com/docs/upgrade-guide); giữ border-radius tùy chỉnh thay vì thay toàn bộ class. Nút làm lại bài xếp dọc ở mobile để không tràn ngang. Có ảnh sau migration; không có bộ ảnh trước tương ứng để tính pixel diff đáng tin.

Live smoke từng trả AI-INVALID-RESPONSE, sau đó quiz/chat riêng và smoke tổng đều qua. Đây là bằng chứng phản hồi model có thể không ổn định; fallback thử model khác nhưng vẫn trả mã lỗi an toàn nếu toàn bộ danh sách thất bại. Không đưa nội dung upstream vào báo cáo.

---

# 🛠️ Technical documentation · Shark Empti v1.15.1

English below. This document describes the application architecture, technical contracts, configuration and maintenance practices.

## 1. 🎯 Scope and baseline

The second pass starts from a worktree containing uncommitted first-pass changes. Do not attribute the entire git diff to this pass. Baseline includes Admin Forum/Arena APIs, model configuration, prompt improvements, next/font and earlier docs/lint changes. New work adds fetch/Zod transport, dependency upgrades, shared providers, reducer, idempotency, Rules hardening, tests/CI and bilingual fixes. Version1.15.1, URLs and data are retained; no production migration or model failover.

## 2. 🏗️ Architecture and ownership

The App Router server layout supplies fonts/CSS, AppPreferencesProvider and FirebaseClientProvider. Preferences own lang/theme, validate storage, update html.lang/dark and receive cross-tab storage events. useLanguageState/useThemeState read shared state. Root error UI does not require Firebase.

FirebaseProvider owns one onAuthStateChanged subscription. useUser only reads context; the UID-keyed private subtree resets component state on account changes/logout. Preferences remain outside that subtree. Dialog/input/tooltip state stays local.

Home owns navigation/view, learningSessionReducer, history subscription and notes hook. The reducer models setup/loading/quiz/result/error but Home does not dispatch fail/reset; Quiz still owns loading/error, answers, timer and pending flags. UI language changes do not generate a new quiz. Quiz/Playground paths reject responses after unmount; other asynchronous callbacks must follow the same lifecycle rule. Unsaved Arena results are retained in a ref; retry keeps the same payload/request ID without repeating analysis. UID keys isolate auth state; private interactions should begin only after authentication has stabilized.

Home memoizes history statistics and passes them to Dashboard. Dashboard/playground use dynamic imports. Translated labels still participate in part of statistics computation: numeric data is not fully separated yet. Do not claim locale changes never recompute statistics.

## 3. 🔄 Data flow and compatible data

Quiz: Setup → academic validation → generateQuestions → answers/timer → feedback → result → users/{uid}/history → dashboard. Ordinary Short Answer uses AI; numeric Arena uses normalized numeric answers. Changing VI/EN does not rewrite history.

Main Firestore data:

- users/{uid}: profile and sharkCoins; coins are Admin-managed.
- users/{uid}/history/{id}: config, quizResults, totalTime, optional analysis, ISO date, lang; ID from document.
- users/{uid}/notes/main: content and updatedAt.
- users/{uid}/activity/main: activeDays map YYYY-MM-DD → boolean and updatedAt; calendar calls trackToday when ready, not as proof of quiz completion.
- users/{uid}/flashcards/{id}: userId/sourceType/sourceValue/cards/ISO createdAt; users/{uid}/practice/{id}: userId/concept/questions/userAnswers/score/ISO createdAt.
- posts/{id}: title/content/subject/author, createdAt, likesCount, likedBy, commentsCount; comments in subcollection.
- arenaExams/{id}: title/config/questions/author, totalAttempts; attempts contain score/duration/user.
- _requestReceipts/{hash}: fingerprint, result, createdAt; Admin-only.

Historical records missing analysis/topic labels use existing display fallbacks. Legacy Arena without trustworthy numeric answers is rejected by the current grading contract. History is not backfilled. History is read through Zod with defaults for legacy omissions; corrupt core records are omitted from display with APP-DATA-INVALID without modifying/deleting stored data. Some profile/Forum/Arena boundaries still use casts and need further schema work.

The notes hook returns Promise<boolean>; success is reported only after setDoc resolves. Missing documents return an empty string. Subscription cleanup ignores late snapshots. QuickNotes retains drafts on failed writes and does not overwrite dirty drafts from snapshots. UID changes remount the private subtree, discarding the previous account draft.

New roadmap checks use localStorage `shark_roadmap_checks:{uid}` and validate the boolean map before reading it. The legacy `shark_roadmap_checks` key has no UID: it is retained but not automatically imported into the current account because ownership is unknown. Users may see an empty new checklist; old data is not deleted. Restoring/importing legacy checks requires confirming the correct account first. Language/theme retain the existing `shark_lang`/`shark_theme` keys.

The `ui-copy.test.ts` AST check rejects static JSX text and title/placeholder/aria-label/alt outside explicit exceptions: brand/version, SHARK COINS, English, Tiếng Việt and UID. This does not prove all dynamic copy is translated; strings constructed in event handlers/prompts/exports still need separate review.

## 4. 🔐 API, authentication and idempotency

src/lib/server-api.ts centralizes Bearer verification, ApiError, apiFailure and receipt transactions. Route handlers parse payloads and enforce ownership after authentication; Admin bypasses Rules.

Arena POST /api/arena/{examId}/submit accepts answers:string[], optional duration and requestId:UUID. Comment POST /api/forum/{postId}/comments accepts content and optional requestId:UUID. Comment DELETE /api/forum/{postId}/comments?commentId={commentId} enforces ownership. Success responses preserve prior contracts; errors always include error:string, code:string, values:object for client translation. Exceptions, stacks and upstream tokens never enter responses.

Receipt key = SHA256(scope, UID, requestId); fingerprint uses the parsed payload. Same ID/payload returns the saved result; different payload returns409 APP-REQUEST-CONFLICT. Receipt reads, business writes/counter/coin updates and receipt creation share one transaction to handle concurrent requests. requestId remains optional for old clients; new clients send it. Old requests without IDs have no receipt. Receipts currently have no TTL; retention needs a separate policy, not automatic deletion.

The contract locks duplicate submissions, creates a new ID for a new operation and reuses the original payload, including duration, after a lost response. Every start or retake path must preserve that distinction. Idempotency is not comprehensive Arena anti-cheat: business rules still allow rewarded retakes; there is no trusted exam timer or answer secrecy.

## 5. 🛡️ Rules and error handling

Post creation requires self author, zero counters and empty likedBy. Author updates allow only title/content/subject/updatedAt; comment updates only content/updatedAt. Likes enforce the correct UID delta and no duplicate likedBy entries. Authors cannot bypass counter/like checks. Comment create/delete and Arena attempts use Admin APIs. Arena creation requires totalAttempts0; updates allow only title/config/questions.

The users/{uid}/{collection}/{document=**} wildcard applies only to subcollections; do not use users/{uid}/{document=**}, because Rulesv2 can match zero segments and accidentally permit profile coin changes. Keep this Emulator regression test.

Route error.tsx and global-error.tsx use Next16 retry. Local ErrorBoundary wraps Focus and Dashboard, isolating render failures. Global fallback owns HTML/body without mandatory Firebase/context. Event/request/camera/clipboard/subscription errors must be caught at their source, not delegated to render boundaries.

Safe codes are translated through i18n/errors and error-toast. Toast diagnostics allow only `httpStatus`, `providerCode`, `retryAfterSeconds`, `operation`, `attemptedModels` and `lastFailure`. When the adapter exhausts fallback, it returns `AI-FALLBACK-EXHAUSTED` with an attempted-model count and final failure code; it never returns a model name, raw provider payload, prompt, stack or secret. FirestorePermissionError remains a compatibility export; internally cause distinguishes permission/unavailable/auth/not-found/generic instead of treating everything as permission. Call sites without cause receive a generic error.

## 6. 🤖 AI transport, prompts and Focus Shield

Seven public flows preserve function names, input/output and AppResult: academic-validation, generate-questions, generate-flashcards, generate-practice, short-answer-analysis, personalized-quiz-feedback, ai-coaching-chatbot. Zod parses inputs; the adapter shares the Inkling → Gemma → Nemotron fallback and always validates responses with Zod. Gemma receives native JSON Schema; Inkling/Nemotron receive a JSON-only contract so no unsupported `response_format` is sent according to their advertised metadata. There is no replacement framework or key rotation.

The base prompt carries only Shark Guru role, style, locale and LaTeX. Counts, question types, feedback rubric and numeric Arena rules belong to flows. User JSON is marked as task data rather than overriding instructions; this reduces ambiguity, not a guarantee against prompt injection. Chat model roles map to assistant; complete review context enters the prompt.

CONFIGURATION.md details timeout/retries/environment. Unit fixtures never call external networks; live smoke is separate. HTTP200 is not success when the body contains error or fails schema validation.

Focus Shield imports TensorFlow types at module scope; runtime import() occurs only in loadModel after enabling. Turbopack dev may send a small async-loader manifest earlier; it is not the runtime/model. generationRef rejects late models/streams; startingRef prevents concurrent initialization. Stop/unmount disposes the model, stops tracks and cancels animation frames. tf.tidy releases tensors; inference is throttled800ms. Real camera, denied permission, model failure and cleanup need separately recorded validation.

## 7. 🌐 Bilingual content and maintenance

translations.ts retains domain catalogs; i18n/common.ts and errors.ts add shared UI/error catalogs, accessed through typed UiText for common content. i18n/ui.ts centralizes 89 previously inline UI message locations with feature-prefixed keys; i18n/index.ts exposes messages/uiMessage. LaTeX snippets use their own catalog. Static JSX text checks do not replace dynamic-content review. Parity tests compare keys and interpolation in VI/EN. Shark Empti/Shark Guru brands, error codes, model names, scientific/LaTeX notation and user content are not automatically translated. Locale changes do not call AI to translate history.

Add translation: define en/vi with identical placeholders, consume the catalog API, test both locales and long Vietnamese mobile text.
Add flow: input/output schemas, flow prompt plus base rules, AppResult, success/error fixtures and adapter timeout/retry tests; never import secret modules into clients.
Add API: authenticate before business logic, Zod input, stable code/error string, ownership and transactions, requestId for retryable writes; test missing/invalid tokens/payloads, concurrency and conflict.
Add subscription: one owner, reset on key changes, unsubscribe and reject stale responses, safe error cause; test account switching.
Add test: unit/components in tests, Node integration in tests/integration; Rules only through Emulator. E2E uses demo project and localhost AI fixtures, never production credentials.
Upgrade dependency: inspect engines/peers, upgrade by group, install without force, run relevant suites and update lockfile plus inventory below. ESLint set-state-in-effect is currently disabled for browser-state/subscription initialization; purity/static-components/exhaustive-deps stay enabled.

## 8. 📦 Direct dependency inventory

Baseline values are manifest ranges, not reconstructed installed versions. Targets are exact lockfile resolutions for this pass.

| Package | Baseline manifest | Locked target | Usage / rationale / validation |
|---|---|---|---|
| @firebase/rules-unit-testing | ^4.0.1 | 5.0.2 | Emulator rules tests; v5 migration; test:rules |
| @playwright/test | — | 1.62.1 | Desktop/mobile browser fixtures; E2E + screenshots |
| @radix-ui/react-alert-dialog | ^1.1.6 | 1.1.23 | src/components/ui; retain accessible primitives; keyboard/dialog/E2E checks |
| @radix-ui/react-avatar | ^1.1.3 | 1.2.6 | src/components/ui; retain accessible primitives; keyboard/dialog/E2E checks |
| @radix-ui/react-checkbox | ^1.1.4 | 1.3.11 | src/components/ui; retain accessible primitives; keyboard/dialog/E2E checks |
| @radix-ui/react-dialog | ^1.1.6 | 1.1.23 | src/components/ui; retain accessible primitives; keyboard/dialog/E2E checks |
| @radix-ui/react-dropdown-menu | ^2.1.6 | 2.1.24 | src/components/ui; retain accessible primitives; keyboard/dialog/E2E checks |
| @radix-ui/react-label | ^2.1.2 | 2.1.15 | src/components/ui; retain accessible primitives; keyboard/dialog/E2E checks |
| @radix-ui/react-progress | ^1.1.2 | 1.1.16 | src/components/ui; retain accessible primitives; keyboard/dialog/E2E checks |
| @radix-ui/react-radio-group | ^1.2.3 | 1.4.7 | src/components/ui; retain accessible primitives; keyboard/dialog/E2E checks |
| @radix-ui/react-scroll-area | ^1.2.3 | 1.2.18 | src/components/ui; retain accessible primitives; keyboard/dialog/E2E checks |
| @radix-ui/react-select | ^2.1.6 | 2.3.7 | src/components/ui; retain accessible primitives; keyboard/dialog/E2E checks |
| @radix-ui/react-slot | ^1.2.3 | 1.3.3 | src/components/ui; retain accessible primitives; keyboard/dialog/E2E checks |
| @radix-ui/react-switch | ^1.1.3 | 1.3.7 | src/components/ui; retain accessible primitives; keyboard/dialog/E2E checks |
| @radix-ui/react-tabs | ^1.1.3 | 1.1.21 | src/components/ui; retain accessible primitives; keyboard/dialog/E2E checks |
| @radix-ui/react-toast | ^1.2.6 | 1.2.23 | src/components/ui; retain accessible primitives; keyboard/dialog/E2E checks |
| @radix-ui/react-tooltip | ^1.1.8 | 1.2.16 | src/components/ui; retain accessible primitives; keyboard/dialog/E2E checks |
| @tailwindcss/postcss | — | 4.3.3 | New PostCSS4 integration; replace v3 plugin; build |
| @tensorflow/tfjs | ^4.22.0 | 4.22.0 | FocusTrackerWidget; dynamic import, CPU/WebGL; camera tests |
| @testing-library/react | ^16.3.0 | 16.3.3 | Component behavior; Vitest |
| @testing-library/user-event | ^14.6.1 | 14.6.7 | Component interactions; Vitest |
| @types/katex | ^0.16.7 | 0.16.8 | KaTeX parser types; typecheck |
| @types/node | ^20.19.43 | 24.13.3 | Follow Node24, not newest major; typecheck |
| @types/react | ^19.2.1 | 19.2.18 | Follow React19; typecheck |
| @types/react-dom | ^19.2.1 | 19.2.6 | Follow React DOM19; typecheck |
| @vitest/coverage-v8 | ^3.2.4 | 4.1.11 | Align Vitest; V8 coverage reporting |
| class-variance-authority | ^0.7.1 | 0.7.1 | UI variants; retain typed variants; typecheck |
| clsx | ^2.1.1 | 2.1.1 | lib/utils; conditional classes; UI |
| eslint | ^9.39.5 | 9.39.5 | 9.39.5 instead of10: react/jsx-a11y peers support up to9; lint |
| eslint-config-next | ^15.5.9 | 16.3.4 | Flat config aligned with Next16; lint |
| firebase | ^11.9.1 | 12.18.0 | src/firebase and client data; Auth/Firestore; Emulator + E2E |
| firebase-admin | ^13.10.0 | 14.3.0 | Server API/token/transactions; server-only; API integration |
| firebase-tools | ^15.1.0 | 15.29.0 | Emulator/CI CLI; dev-only; integration + E2E |
| jsdom | ^26.1.0 | 30.0.1 | Unit DOM; v30 migration; component tests |
| katex | ^0.16.11 | 0.18.5 | LatexText; retain complex parser; equations/screenshots |
| lucide-react | ^0.475.0 | 1.40.0 | UI icons; v1 migration; typecheck + screenshots |
| next | 15.5.9 | 16.3.4 | App Router/server actions; v16 migration; build + E2E |
| postcss | ^8 | 8.5.27 | CSS pipeline; Tailwind4 plugin; build |
| react | ^19.2.1 | 19.2.8 | Providers/hooks; update19; component + E2E |
| react-dom | ^19.2.1 | 19.2.8 | Hydration/portals; align React; component + E2E |
| recharts | ^2.15.1 | 3.10.1 | Dashboard directly; v3 migration, remove unused wrapper; chart/screenshots |
| server-only | — | 0.0.1 | Prevent client imports of secret modules; build |
| tailwind-merge | ^3.0.1 | 3.6.0 | lib/utils; retain class conflict handling; unit/UI |
| tailwindcss | ^3.4.1 | 4.3.3 | globals.css/config.mts; v4 migration; build + visual QA |
| tailwindcss-animate | ^1.0.7 | 1.0.7 | Config plugin; retain animations; build/screenshots |
| tsx | — | 4.23.13 | Node TypeScript scripts; ai:health/ai:smoke |
| typescript | ^5 | 6.0.3 | 6.0.3 instead of7: typescript-eslint requires <6.1; typecheck |
| vitest | ^3.2.4 | 4.1.11 | Unit/integration .mts configs; automatic OXC JSX; tests |
| zod | ^3.24.2 | 4.5.4 | src/ai and API; v4/JSON Schema; flow + API fixtures |

### Removed direct dependencies

| Package | Baseline | Reason / validation |
|---|---|---|
| @genkit-ai/compat-oai | ^1.37.0 | Replaced AI stack with fetch/Zod; flow fixtures |
| @opentelemetry/exporter-jaeger | 1.25.1 | Replaced AI stack with fetch/Zod; flow fixtures |
| @radix-ui/react-accordion | ^1.2.3 | No consumers reachable from route roots; removed wrappers; build/E2E |
| @radix-ui/react-collapsible | ^1.1.11 | No consumers reachable from route roots; removed wrappers; build/E2E |
| @radix-ui/react-menubar | ^1.1.6 | No consumers reachable from route roots; removed wrappers; build/E2E |
| @radix-ui/react-popover | ^1.1.6 | No consumers reachable from route roots; removed wrappers; build/E2E |
| @radix-ui/react-separator | ^1.1.2 | No consumers reachable from route roots; removed wrappers; build/E2E |
| @radix-ui/react-slider | ^1.2.3 | No consumers reachable from route roots; removed wrappers; build/E2E |
| @tensorflow/tfjs-backend-webgl | ^4.22.0 | Already included through tfjs; remove duplicate direct declaration |
| date-fns | ^3.6.0 | Intl; locale checks |
| dotenv | ^16.5.0 | Node env-file; script checks |
| embla-carousel-react | ^8.6.0 | No consumers reachable from route roots; removed wrappers; build/E2E |
| genkit | ^1.28.0 | Replaced AI stack with fetch/Zod; flow fixtures |
| react-day-picker | ^9.11.3 | No consumers reachable from route roots; removed wrappers; build/E2E |
| react-hook-form | ^7.54.2 | No consumers reachable from route roots; removed wrappers; build/E2E |
| genkit-cli | ^1.28.0 | Replaced AI stack with fetch/Zod; flow fixtures |

## 9. ✅ Tests, measurements and limitations

Unit/components are separate from Node/Emulator integration. Added regressions cover the adapter, seven flows, preferences, reducer, boundary and catalog parity; integration covers concurrent/idempotent APIs, auth/legacy and Rules. Playwright runs the real app with an emulated Auth popup and AI fixture. Actual execution output determines pass/fail; test files alone do not prove complete acceptance.

No complete pre-migration screenshot set exists under identical conditions. Post-migration images or Next15 First Load JS cannot establish a Next16 speedup percentage. Measure cold load, script bytes, dashboard/quiz interaction and light/dark snapshots on the same machine/browser. Real camera and Safari/Firefox still require separate evidence. E2E adds a controlled dashboard matchMedia failure: the fallback appears, navigation remains available and Retry restores content, without introducing a fault-injection endpoint into production code.

Before release, run `npm audit --json`, then assess the dependency path, practical applicability and peer dependencies before upgrading, overriding or downgrading. Do not use `--force` or `--legacy-peer-deps` to conceal conflicts. The CLI and Emulator use local/demo endpoints for tests.

TypeScript6.0.3 and ESLint9.39.5 remain below latest for peer compatibility; @types/node24 deliberately matches runtime. Accessibility/schema/LaTeX/chart libraries are not rewritten just to reduce packages. Tailwind4 changes the pipeline; independently verify border/shadow/ring/dark/animation before release. No “bug-free” guarantee is made.


### CSS migration and live AI notes

Mapped shadow-sm → shadow-xs, blur-sm → blur-xs and outline-none → outline-hidden following the [Tailwind guide](https://tailwindcss.com/docs/upgrade-guide); retained custom border-radius definitions. Retake buttons stack on mobile to prevent overflow. Post-migration screenshots exist, without matching pre-migration images for reliable pixel diffs.

One live smoke returned AI-INVALID-RESPONSE; subsequent separate quiz/chat checks and the full smoke passed. This demonstrates potentially inconsistent model output; fallback tries another model but still returns a safe error code if every candidate fails. Upstream content is not included in reports.

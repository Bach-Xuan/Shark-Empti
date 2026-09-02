> English below.

# Shark Empti - Technical Documentation (v1.15.1)

## 1. Tổng Quan Dự Án (Project Overview)
**Shark Empti** là một nền tảng học tập thông minh tích hợp AI (Cognitive Learning Platform), lấy cảm hứng từ phong cách thiết kế của Duolingo (Neo-brutalism). Ứng dụng không chỉ dừng lại ở việc tạo câu hỏi mà còn tập trung vào việc **phân tích tư duy**, **giám sát sự tập trung** và **cá nhân hóa lộ trình ôn tập** dựa trên dữ liệu lịch sử của người dùng.

### 1.1. Mục tiêu & Vấn đề giải quyết
*   **Vấn đề**: Người học thường gặp khó khăn trong việc xác định mình yếu ở đâu (hổng kiến thức hay do bất cẩn) và thiếu sự giám sát khi tự học tại nhà.
*   **Giải pháp**: 
    *   Sử dụng AI (Shark Guru) để phân tích lỗi sai thành 4 danh mục (Hiểu sai đề, Lỗi khái niệm, Lỗi tư duy, Lỗi bất cẩn).
    *   Tích hợp "Lá chắn tập trung" (Focus Shield) sử dụng Computer Vision để cảnh báo khi người dùng xao nhãng.
    *   Tự động hóa việc tạo Flashcards và bài tập bổ trợ từ chính những lỗi sai trong quá khứ.

### 1.2. Đối tượng người dùng
*   Học sinh bậc phổ thông (Lớp 6 - 12) chuẩn bị cho các kỳ thi.
*   Sinh viên và người tự học các bộ môn khoa học (Toán, Lý, Hóa, Sinh, Anh).

---

## 2. Kiến Trúc Hệ Thống (System Architecture)

### 2.1. Tech Stack & Dependencies
*   **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS.
*   **UI Components**: ShadCN UI (Radix Primitives) được tinh chỉnh theo style "Duo" (border dày, shadow cứng).
*   **Backend as a Service**: Firebase (Authentication, Firestore).
*   **Generative AI**: Firebase Genkit v1.37 phối hợp với OpenRouter. Model được chọn bằng `OPENROUTER_MODEL` (mặc định: `liquid/lfm-2.5-2.6b:free`), không tự động failover.
*   **On-device AI**: TensorFlow.js (xử lý Focus Tracking trực tiếp trên trình duyệt để bảo mật và tiết kiệm tài nguyên server).
*   **Math Rendering**: KaTeX (hiển thị công thức Toán/Hóa chuyên nghiệp).

### 2.2. Sơ đồ luồng dữ liệu (Data Flow)
1.  **Client**: Người dùng thiết lập Topic -> Gọi Server Action (Genkit Flow).
2.  **AI Layer**: Genkit gọi OpenRouter API -> Trả về cấu trúc JSON câu hỏi -> Client hiển thị.
3.  **Persistence**: Kết quả bài làm được lưu vào Firestore (`users/{uid}/history`).
4.  **Analytics**: Dashboard component fetch dữ liệu lịch sử -> Chuyển qua `stats-utils.ts` -> Hiển thị biểu đồ Radar và Bar Chart (Recharts).

---

## 3. Chi Tiết Kỹ Thuật (Technical Deep Dive)

### 3.1. Hệ thống AI (Genkit & OpenRouter)
Dự án sử dụng một cơ chế đặc biệt để vượt qua giới hạn của môi trường đám mây:
*   **Fallback Mechanism (`src/ai/lib/fallback.ts`)**: Hiện xác thực và cung cấp một API key. Cơ chế xoay vòng nhiều key chưa được triển khai.
*   **Cấu hình Plugin (`src/ai/genkit.ts`)**: Sử dụng `openAICompatible` để kết nối với OpenRouter. Định danh plugin là `openai`, khớp với model ref `openai/<OPENROUTER_MODEL>`.
*   **Ổn định kết nối**: Adapter được cấu hình dùng `globalThis.fetch` (native `fetch` của Node) thay cho HTTP transport mặc định từng gây lỗi `Premature close` khi đọc response từ OpenRouter. Mỗi request có timeout 60 giây; nếu request bị lỗi transport tạm thời, OpenAI-compatible client tự thử lại tối đa 2 lần. Retry không che giấu lỗi API key, model không tồn tại hoặc response sai schema; các lỗi đó vẫn được trả về để UI báo đúng nguyên nhân.
*   **Prompt Engineering**: Sử dụng Handlebars để chèn ngữ cảnh học tập (khối lớp, độ khó) vào System Prompt của Shark Guru.

### 3.2. Lá Chắn Tập Trung (Focus Shield)
*   **Mô hình**: Sử dụng mô hình MobileNet/Face-Landmark đã được convert sang định dạng `model.json` của TensorFlow.js.
*   **Cơ chế**: Thử nạp `LayersModel` trước, nếu thất bại (do định dạng graph) sẽ tự động chuyển sang `loadGraphModel`. 
*   **Hiệu năng**: Chạy `requestAnimationFrame` với chu kỳ xử lý 800ms/frame để không làm nóng máy người dùng.
*   **Ổn định (v1.15.1)**: Khắc phục lỗi ngắt vòng lặp khi thu nhỏ widget và đảm bảo webcam hiển thị mượt mà.

### 3.3. Schema Dữ liệu (Firestore)
*   `/users/{userId}`: Thông tin profile, Shark Coins.
*   `/users/{userId}/history/{sessionId}`: Chứa kết quả bài thi chi tiết và phân tích AI đi kèm.
*   `/posts/{postId}`: Bài viết diễn đàn (hỗ trợ LaTeX).
*   `/arenaExams/{examId}`: Bài thi vĩnh viễn do cộng đồng tạo.

---

## 4. Các Module & Component Chính

### 4.1. `QuizView`
*   **Logic**: Xử lý đếm ngược thời gian, chấm điểm tự động (AI hỗ trợ chấm "Trả lời ngắn").
*   **Hydration Error Handling**: Sử dụng `useEffect` để khởi tạo timer, tránh lệch múi giờ giữa Server và Client.

### 4.2. `DashboardView`
*   **Business Logic**: Tính toán "Kỹ năng nhận thức" (Cognitive Metrics).
*   **Assumption**: Giả định rằng nếu người dùng trả lời sai trong < 5 giây thì đó là "Lỗi bất cẩn" (Careless Mistake).

---

## 5. Trạng Thái Hiện Tại & Technical Debt

### 5.1. Phần đã hoàn thành (Done)
*   [x] Hệ thống Quiz đa ngôn ngữ (Vi/En).
*   [x] Phân tích hiệu suất bằng AI.
*   [x] Diễn đàn thảo luận hỗ trợ LaTeX.
*   [x] Focus Shield ổn định (v1.15.1).
*   [x] Playground (Flashcards 3D & Luyện lỗi sai).
*   [x] Cấu hình Genkit v1.x ổn định với OpenRouter.

### 5.2. Phần đang phát triển (WIP)
*   **Sàn Đấu (Arena)**: Hiện tại bài thi đã được tạo nhưng hệ thống "Đối đầu trực tiếp" vẫn đang là giả định (Assumption: Sẽ dùng Firebase Realtime Database để đồng bộ).
*   **Hệ thống Đổi quà**: Nút đổi Shark Coins hiện mới chỉ là giao diện demo.

### 5.3. Technical Debt (Nợ kỹ thuật)
*   **State Management**: Hiện đang sử dụng Prop Drilling khá nhiều ở trang chủ. Cần chuyển sang React Context hoặc Zustand nếu mở rộng thêm.
*   **Images**: Vẫn sử dụng Placeholder (Picsum/Unsplash) trong file `placeholder-images.json`. Cần upload ảnh thật của Shark Guru.

---

## 6. Hướng dẫn cho Developer mới (Onboarding)

### 6.1. Biến môi trường
Cần cấu hình `OPENROUTER_API_KEY` và sáu biến `NEXT_PUBLIC_FIREBASE_*` trong `.env`. `OPENROUTER_MODEL` là tùy chọn. Xem hướng dẫn đầy đủ tại [CONFIGURATION.md](CONFIGURATION.md).

### 6.2. Cấu trúc thư mục
*   `src/ai/flows`: Nơi định nghĩa logic của AI (Input/Output schemas).
*   `src/components/ui`: ShadCN components (Đừng sửa trực tiếp ở đây, hãy override qua className).
*   `src/lib/translations.ts`: Nơi quản lý toàn bộ text của ứng dụng. Để thêm ngôn ngữ mới, hãy copy cấu trúc của `vi`.

### 6.3. Chiến lược Kiểm thử (Test Strategy)
*   **Manual**: Test các trường hợp nhập Topic không hợp lệ (Ví dụ: "Ăn gì hôm nay") để kiểm tra `academic-validation-flow`.
*   **Edge Case**: Tắt mạng khi đang làm bài để kiểm tra tính năng lưu tạm (Optimistic UI).

---

# Shark Empti - Technical Documentation (English)

## 1. Project overview

Shark Empti is a Duolingo-inspired cognitive learning platform. It creates quizzes, classifies mistakes, tracks focus, and personalizes revision through history-based Flashcards and practice.

## 2. Architecture

The stack is Next.js 15 App Router, React 19, Tailwind/ShadCN UI, Firebase Authentication/Firestore, Genkit 1.37 with OpenRouter, TensorFlow.js Focus Shield, and KaTeX. The client sends quiz configuration to server AI flows; results are stored under `users/{uid}/history` and rendered by the dashboard.

## 3. AI layer

The default model is `liquid/lfm-2.5-2.6b:free`; `OPENROUTER_MODEL` can override it, and the application intentionally uses one configured model without automatic failover. The OpenAI-compatible adapter uses native fetch, a 60-second timeout, and two transport retries. A provider response with HTTP 200 but an embedded `error` is detected before Genkit accesses `choices`, preventing the previous `undefined.length` crash.

Every AI flow returns a serializable success/error result. Safe error codes include `AI-CONFIG-MISSING`, `AI-UPSTREAM-502`, `AI-RATE-LIMIT-429`, `AI-TRANSPORT`, `AI-TIMEOUT`, and `AI-INVALID-RESPONSE`. Toasts expose only safe diagnostic values.

## 4. Data and security

User profiles are readable by signed-in users for profile search. Histories, notes, activity, Flashcard sessions, and practice sessions are owner-only. Forum posts/comments and Arena exams are publicly readable; authenticated authors may create and edit only their own content. These rules are represented in `firestore.rules` and tested with the Firebase Emulator.

## 5. Testing and onboarding

Use `npm test` for unit/component tests, `npm run test:rules` for emulator rules, `npm run typecheck` for TypeScript, `npm run build` for production compilation, `npm run ai:health` for model capability, and `npm run ai:smoke` for quiz/chat structured-output contracts. The test suite covers authentication/profile, setup, every quiz mode, scoring/results, chatbot, dashboard, notes/activity, Flashcards, practice, Arena, forum, and Focus Shield failure paths.

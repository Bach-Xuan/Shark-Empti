> English below.

# Cấu hình và chẩn đoán

## 1. Thiết lập `.env`

Sao chép `.env.example` thành `.env`, sau đó điền toàn bộ giá trị. Next.js tự nạp `.env`; Genkit Developer UI cũng nạp cùng file qua `dotenv`. Dự án không dùng `.env.local`.

| Nhóm | Biến bắt buộc |
| --- | --- |
| OpenRouter | `OPENROUTER_API_KEY` |
| Firebase Web App | `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` |
| Vercel server (Arena) | `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` |

`OPENROUTER_MODEL` là tùy chọn. Giá trị phải là model ID của OpenRouter, ví dụ `provider/model-name`; mã tự thêm tiền tố Genkit `openai/`.

## 2. Firebase

Trong Firebase Console, vào **Project settings → General → Your apps → SDK setup and configuration**, chọn cấu hình của Web App và ánh xạ các trường camelCase sang biến `NEXT_PUBLIC_FIREBASE_*` tương ứng.

Sau khi thêm cấu hình, hãy bật các dịch vụ ứng dụng dùng:

- Authentication: bật Google Sign-In nếu dùng đăng nhập Google.
- Firestore Database: tạo database và thiết lập Security Rules cho các collection `users`, `posts`, `arenaExams`.

Firebase Web API key xuất hiện ở client là thiết kế bình thường; không thay thế Authentication, Firestore Security Rules hoặc giới hạn API key trong Google Cloud Console.

### Arena server secrets

Arena xác minh Firebase ID token và tự chấm điểm ở Route Handler của Next.js, nên cần Firebase Admin service account trên Vercel. Đặt ba biến `FIREBASE_ADMIN_*` trong Vercel Project Settings; private key phải giữ dấu xuống dòng dưới dạng `\n`. Không đặt chúng vào `.env` client hoặc biến `NEXT_PUBLIC_*`.

## 3. OpenRouter và Genkit

Tạo key tại OpenRouter, đặt vào `OPENROUTER_API_KEY`, sau đó khởi động lại Next.js/Genkit. Tầng AI dùng adapter `@genkit-ai/compat-oai` với endpoint `https://openrouter.ai/api/v1` và model ref `openai/<OPENROUTER_MODEL>`. Mặc định là `liquid/lfm-2.5-2.6b:free`, hỗ trợ structured output cần cho các AI flow; ứng dụng không tự động chuyển model.

### Transport và retry

Adapter truyền `fetch: globalThis.fetch` để buộc OpenAI-compatible client sử dụng native `fetch` của Node. Trong môi trường này, native fetch đọc response stream của OpenRouter ổn định hơn transport mặc định và tránh lỗi `Premature close`.

- **Timeout 60 giây**: một request bị hủy nếu OpenRouter không phản hồi trong thời gian này, tránh request treo vô hạn.
- **Retry tối đa 2 lần**: chỉ giúp phục hồi các lỗi transport tạm thời như connection reset hoặc response stream bị đóng sớm; mỗi lần thử lại vẫn dùng cùng model và API key.
- Retry không sửa được HTTP 401/403, API key sai, model không khả dụng hoặc JSON/schema không hợp lệ. Những trường hợp đó cần sửa cấu hình hoặc chọn model khác.

Chạy:

```bash
npm run ai:health
npm run ai:smoke
```

`ai:health` chỉ gọi danh sách model: nó xác nhận API key, kết nối OpenRouter và model được chọn mà không in API key hoặc tạo nội dung AI. `ai:smoke` gửi một prompt JSON tối thiểu qua chính adapter Genkit để kiểm tra structured output và lỗi transport.

## 4. Xử lý lỗi thường gặp

| Triệu chứng | Cách xử lý |
| --- | --- |
| `OPENROUTER_API_KEY is missing` | Thêm key vào `.env`, không phải `.env.local`, rồi restart server. |
| Health check HTTP 401/403 | Kiểm tra key, trạng thái tài khoản OpenRouter và quyền mạng. |
| Model unavailable | Đặt `OPENROUTER_MODEL` thành một model hiện có trong OpenRouter. |
| Firebase khởi tạo rỗng hoặc lỗi domain/project | Kiểm tra đủ sáu biến `NEXT_PUBLIC_FIREBASE_*`, sau đó restart Next.js. |
| Firestore permission error | Sửa Firebase Security Rules; không giải quyết bằng cách sửa API key client. |

## 6. Mã lỗi AI và kiểm thử

Các lỗi AI được chuẩn hóa và hiển thị trong toast với mã và giá trị an toàn:

| Code | Meaning |
| --- | --- |
| `AI-CONFIG-MISSING` | `OPENROUTER_API_KEY` is missing. |
| `AI-UPSTREAM-502` | The configured provider is overloaded or unavailable. |
| `AI-RATE-LIMIT-429` | The provider rate limit was reached. |
| `AI-TRANSPORT` / `AI-TIMEOUT` | The request connection failed or timed out. |
| `AI-INVALID-RESPONSE` | The model did not satisfy the required schema. |

The toast may include HTTP status, provider code/name, model ID, retry-after seconds, or a Firebase path/operation. It never includes API keys, prompts, or raw provider payloads.

Run `npm test` for unit/component coverage and `npm run test:rules` for the local Firestore Emulator policy. The policy permits signed-in users to read public profiles, forum posts, and Arena exams; learning history, notes, activity, Flashcard sessions, and practice sessions remain owner-only.

The Emulator CLI requires Java 11 or newer on `PATH`.

---

# English version

## 1. `.env` setup

Copy `.env.example` to `.env` and fill every value. Next.js and the Genkit Developer UI load `.env`; this project does not use `.env.local`.

Required groups are `OPENROUTER_API_KEY` and the six `NEXT_PUBLIC_FIREBASE_*` Web App values. `OPENROUTER_MODEL` is optional and must be a valid OpenRouter model ID without the `openai/` prefix. The default is `liquid/lfm-2.5-2.6b:free`; there is no automatic model failover.

## Arena server secrets

Trusted Arena submission runs in a Next.js Node Route Handler on Vercel. Configure `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, and `FIREBASE_ADMIN_PRIVATE_KEY` as Vercel-only service-account secrets. Preserve private-key newlines as `\n`; never expose these values through `NEXT_PUBLIC_*` variables.

## 2. Firebase

Copy the Firebase Console Web App SDK configuration into the six public environment variables. Enable Authentication and Firestore and deploy rules from `firestore.rules` when using production. Browser Firebase API keys are public by design; Authentication and Security Rules protect data.

## 3. OpenRouter and Genkit

The AI layer uses `@genkit-ai/compat-oai` at `https://openrouter.ai/api/v1`, with the model reference `openai/<OPENROUTER_MODEL>`. Native Node fetch is used to avoid premature stream closure, with a 60-second timeout and two transport retries. A 2xx response containing a provider `error` is converted to a safe application error before Genkit parses it.

`npm run ai:health` checks the key, model availability, and `response_format` support without generating content. `npm run ai:smoke` verifies realistic quiz and chatbot structured output.

## 4. Common failures

`AI-CONFIG-MISSING` means the key is absent; `AI-UPSTREAM-502` means the configured provider is overloaded; `AI-RATE-LIMIT-429` means a rate limit; `AI-TRANSPORT` or `AI-TIMEOUT` means a network failure; `AI-INVALID-RESPONSE` means the schema was not satisfied. Toasts expose only safe values such as status, provider, model, retry-after, Firebase path, or operation.

## 5. Emulator and tests

Run `npm test` for unit/component tests and `npm run test:rules` for Firestore Emulator rules tests. Signed-in users may read public profiles, forum posts, and Arena exams. Histories, notes, activity, Flashcard sessions, and practice sessions are owner-only.

The Emulator CLI requires Java 11 or newer on `PATH`.

## 5. Tình trạng kiểm tra TypeScript

Phạm vi sửa lần này chỉ bao gồm Firebase và AI provider. `npm run typecheck` vẫn có thể báo các lỗi tồn đọng của Arena, Forum, types dịch và UI calendar; các lỗi đó cần một đợt sửa riêng.

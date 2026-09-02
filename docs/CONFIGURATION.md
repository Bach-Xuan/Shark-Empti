# Cấu hình và chẩn đoán

## 1. Thiết lập `.env`

Sao chép `.env.example` thành `.env`, sau đó điền toàn bộ giá trị. Next.js tự nạp `.env`; Genkit Developer UI cũng nạp cùng file qua `dotenv`. Dự án không dùng `.env.local`.

| Nhóm | Biến bắt buộc |
| --- | --- |
| OpenRouter | `OPENROUTER_API_KEY` |
| Firebase Web App | `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID` |

`OPENROUTER_MODEL` là tùy chọn. Giá trị phải là model ID của OpenRouter, ví dụ `provider/model-name`; mã tự thêm tiền tố Genkit `openai/`.

## 2. Firebase

Trong Firebase Console, vào **Project settings → General → Your apps → SDK setup and configuration**, chọn cấu hình của Web App và ánh xạ các trường camelCase sang biến `NEXT_PUBLIC_FIREBASE_*` tương ứng.

Sau khi thêm cấu hình, hãy bật các dịch vụ ứng dụng dùng:

- Authentication: bật Google Sign-In nếu dùng đăng nhập Google.
- Firestore Database: tạo database và thiết lập Security Rules cho các collection `users`, `posts`, `arenaExams`.

Firebase Web API key xuất hiện ở client là thiết kế bình thường; không thay thế Authentication, Firestore Security Rules hoặc giới hạn API key trong Google Cloud Console.

## 3. OpenRouter và Genkit

Tạo key tại OpenRouter, đặt vào `OPENROUTER_API_KEY`, sau đó khởi động lại Next.js/Genkit. Tầng AI dùng adapter `@genkit-ai/compat-oai` với endpoint `https://openrouter.ai/api/v1` và model ref `openai/<OPENROUTER_MODEL>`. Mặc định là `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`, hỗ trợ structured output cần cho các AI flow.

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

## 5. Tình trạng kiểm tra TypeScript

Phạm vi sửa lần này chỉ bao gồm Firebase và AI provider. `npm run typecheck` vẫn có thể báo các lỗi tồn đọng của Arena, Forum, types dịch và UI calendar; các lỗi đó cần một đợt sửa riêng.

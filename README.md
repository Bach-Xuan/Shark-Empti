# Shark Empti

Nền tảng học tập thông minh với quiz, phân tích kết quả, Flashcards, luyện tập cá nhân hóa, Firebase và AI qua OpenRouter.

## Bắt đầu nhanh

Yêu cầu Node.js 20+ và một Firebase Web App đã bật Authentication/Firestore.

```bash
npm install
Copy-Item .env.example .env
# Điền giá trị Firebase và OPENROUTER_API_KEY vào .env
npm run dev
```

Ứng dụng chạy tại `http://localhost:9002`.

## Biến môi trường

Sao chép `.env.example` thành `.env`. Không commit `.env`.

| Biến | Mục đích |
| --- | --- |
| `OPENROUTER_API_KEY` | API key phía server để gọi OpenRouter. |
| `OPENROUTER_MODEL` | Tùy chọn; model OpenRouter không gồm tiền tố `openai/`. |
| `NEXT_PUBLIC_FIREBASE_*` | Cấu hình Web App Firebase dùng ở trình duyệt. |

`OPENROUTER_MODEL` mặc định là `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`. Cấu hình Firebase Web App không phải secret, nhưng quyền truy cập dữ liệu phải được bảo vệ bằng Firebase Authentication và Security Rules.

## Lệnh hữu ích

```bash
npm run dev          # Chạy Next.js ở cổng 9002
npm run genkit:dev   # Chạy Genkit Developer UI
npm run ai:health    # Kiểm tra API key, kết nối và model OpenRouter
npm run ai:smoke     # Kiểm tra structured output qua Genkit/OpenRouter
npm run typecheck    # Kiểm tra kiểu TypeScript
npm run build        # Build production (works on Windows, macOS and Linux)
```

Xem [hướng dẫn cấu hình và chẩn đoán](docs/CONFIGURATION.md) và [tài liệu kỹ thuật](docs/TECHNICAL_DOCUMENTATION.md).

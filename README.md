> English below.

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

`OPENROUTER_MODEL` mặc định là `liquid/lfm-2.5-2.6b:free`. Ứng dụng chỉ dùng model được cấu hình, không tự động chuyển model khi provider quá tải. Cấu hình Firebase Web App không phải secret, nhưng quyền truy cập dữ liệu phải được bảo vệ bằng Firebase Authentication và Security Rules.

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

---

# English version

Shark Empti is an intelligent learning platform with quizzes, result analysis, Flashcards, personalized practice, Firebase, and OpenRouter AI.

## Quick start

Requires Node.js 20+ and a Firebase Web App with Authentication and Firestore enabled.

```bash
npm install
Copy-Item .env.example .env
# Fill in Firebase values and OPENROUTER_API_KEY in .env
npm run dev
```

The app runs at `http://localhost:9002`.

## Environment variables

Copy `.env.example` to `.env`; never commit `.env`.

| Variable | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | Server-side key for OpenRouter. |
| `OPENROUTER_MODEL` | Optional OpenRouter model ID override. |
| `NEXT_PUBLIC_FIREBASE_*` | Browser Firebase Web App configuration. |

The default model is `liquid/lfm-2.5-2.6b:free`. The app uses one configured model and does not automatically fail over to another model.

## Useful commands

```bash
npm run dev          # Start Next.js on port 9002
npm run genkit:dev   # Start the Genkit Developer UI
npm run ai:health    # Check key, model availability, and structured-output support
npm run ai:smoke     # Exercise quiz and chatbot structured-output contracts
npm run typecheck    # TypeScript validation
npm test             # Unit and component tests
npm run test:rules   # Firebase Firestore Emulator rules tests
npm run build        # Production build
```

Firebase Emulator tests require Java 11+ on `PATH`.

See [configuration and troubleshooting](docs/CONFIGURATION.md) and [technical documentation](docs/TECHNICAL_DOCUMENTATION.md).

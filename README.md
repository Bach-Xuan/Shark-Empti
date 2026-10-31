# 🦈 Shark Empti · v2.0.0 **β**

[![XERJ Corpus Hub contributor](https://hub.xerj.org/contributors/Bach-Xuan/badge.svg)](https://hub.xerj.org/contributors/Bach-Xuan)

Shark Empti brings assessment, feedback, focused practice and peer learning into a continuous learning process. Its bilingual interface combines learning history with guidance so learners can reflect on progress and choose their next steps. AI provides educational assistance, not a substitute for independently checking knowledge.

## 🏆 National Recognition and Continuing Development

At **AI Young Guru 2026**, **VTS - Cá Mập Laze**, representing **Võ Thị Sáu High School, Hồ Chí Minh City**, reached the **Top 12** and received the **Promising Award**. The competition attracted over 26,000 participants, 15,000 teams and 1,800 upper-secondary and vocational schools. This repository continues the same award-winning product, retaining its educational purpose while improving reliability and practical value.

AI Young Guru is organized by **FPT University** under the patronage of the **Ministry of Education and Training** and professional patronage of the **Ministry of Science and Technology**, with Vietnam Television's Science and Education Programme Department, the Ho Chi Minh Communist Youth Union Central Committee, the Ministry of Public Security's Department of Cybersecurity and High-Tech Crime Prevention, and FPT units. Its “Bình dân học AI” mission promotes accessible, practical AI learning. Official records: [competition](https://www.facebook.com/aiyoungguru1), [regional round](https://www.facebook.com/aiyoungguru1/posts/pfbid0jQvJgADPYpX3ZxuSmLBTrs25xaxLsn7urWU9bNyTQqANqcAFsqi1gXj1Hx9Qv5Hkl), [practical round](https://www.facebook.com/aiyoungguru1/posts/pfbid02bfr57ZqxfWRtY7LYwfaFQ7Bit4x94NHMsmGJBAcWoGN6odB4vApv3L2v64uzxN61l), [invitation](https://www.facebook.com/aiyoungguru1/posts/pfbid0JTEMeq62vQy9evu9SS99cbYHpHofMUbMXbV4vrfGVyxYcYsjLP5Mpl), [school recognition](https://www.facebook.com/permalink.php?story_fbid=pfbid023FaPNEaCvTwEcFmfQ9CrxVHXpY2zKhc9xBpDdiYeVXZcjn8Q9VrEWuCawZWkAwuUl&id=61583508615694&rdid=BipgwzyCQMh6luqG), and [award ceremony](https://www.facebook.com/reel/1516002886825130).

The product's educational purpose aligns with Vietnam's science and education modernization agenda, including Resolutions 57-NQ/TW (2024) and 71-NQ/TW (2025) and Decisions 131/QĐ-TTg (2022) and 127/QĐ-TTg (2021). This contextual alignment does not imply endorsement or regulatory compliance.

## 🎯 Learning and technology

- **Quiz and AI feedback:** generate questions and help learners understand mistakes. Shark Guru provides contextual coaching.
- **Practice, Flashcards and Dashboard:** revisit skills, retain knowledge and review progress.
- **Arena and Forum:** support community practice, symbolic leaderboards and discussion.
- **Focus Shield:** offers optional in-browser camera support after explicit permission; its estimates remain experimental.

Next.js 16, React 19, TypeScript 6, Firebase Auth/Firestore, OpenRouter, Tailwind 4, Radix UI, Recharts, KaTeX and TensorFlow.js form the application. Vitest, Testing Library, Firebase Emulators and Playwright provide local verification. The server validates AI requests/results; an authenticated ledger coordinates up to three attempts, at most one provider request per invocation and recovery after response loss. Safe errors exclude sensitive provider details. See [architecture and AI lifecycle](docs/TECHNICAL_DOCUMENTATION.md#ai-request-lifecycle).

## 🚀 Quick Start

Use Node **24.x** and npm, a Firebase project with a Web App, Firestore and Google Authentication. AI needs an OpenRouter key; server mutations need Firebase Admin credentials. Integration/browser tests require JDK 21 and Playwright browsers.

```powershell
npm ci
if (-not (Test-Path -LiteralPath .env)) {
  Copy-Item -LiteralPath .env.example -Destination .env
}
# Configure .env without committing or printing secrets.
npm run dev
```

Open [localhost:9002](http://localhost:9002). `npm ci` may replace `node_modules`; use the existing npm lockfile rather than mixing package managers. The [configuration guide](docs/CONFIGURATION.md) covers Firebase, OpenRouter, environment variables, authorized domains, Rules and deployment. Browser-visible `NEXT_PUBLIC_*` values are not secrets; never put Admin credentials or the OpenRouter key there.

## 🧪 Development and validation

| Command | Purpose |
|---|---|
| `npm run dev` | Local app |
| `npm run lint`, `npm run typecheck`, `npm run check:maintenance` | Static and repository contracts |
| `npm test`, `npm run test:coverage` | Unit/component tests and optional V8 coverage |
| `npm run test:rules`, `npm run test:integration` | Firebase Emulator Rules and API checks |
| `npm run build:demo`, `npm run test:e2e`, `npm run test:production` | Verified demo build, browser matrix and production HTTP smoke |
| `npm run report:bundle`, `npm run report:performance`, `npm run report:browser`, `npm run report:queries`, `npm run report:comparison` | Bundle and controlled performance reports |
| `npm run audit:dependencies` | Registry advisory assessment; sends dependency names/versions to npm |
| `npm run ai:health`, `npm run ai:smoke` | Live provider checks; smoke may use quota |
| `npm run clean`, `npm run clean:artifacts`, `npm run clean:cache` | Scoped build, artifact and cache cleanup |

Install browser engines with `npx --no-install playwright install chromium webkit firefox`. The [validation guide](docs/VALIDATION.md) explains prerequisites, commands, output, limitations and cleanup. A production E2E run needs the demo-configured build; runtime overrides cannot change public values already embedded in it. CI uses demo Firebase and AI fixtures, not production credentials.

## 📚 Documentation

- [Configuration](docs/CONFIGURATION.md): environment, Firebase, OpenRouter, timestamp migration, deployment and troubleshooting.
- [Technical documentation](docs/TECHNICAL_DOCUMENTATION.md): architecture, data ownership and security contracts.
- [Backend data map](docs/backend.json): descriptive entities, storage paths and interfaces; executable code, schemas and Rules remain authoritative.
- [Audit register](docs/AUDIT_REPORT.md): finding statuses and unresolved verification boundaries.
- [Validation](docs/VALIDATION.md): built-in tests, interpretation and evidence limits.
- [Account operations](docs/ACCOUNT_OPERATIONS.md): background export/deletion, retention and encrypted backup/restore.

The interface supports Vietnamese and English; preferences persist between pages and tabs. Camera access requires HTTPS or localhost and explicit permission. Lists expose 50 records per page; client-side search/statistics reflect exposed records. During timestamp migration, history merges two bounded candidate streams as described in the [data contract](docs/TECHNICAL_DOCUMENTATION.md). Documented browser targets are Safari 16.4+, Chrome 111+ and Firefox 128+; current engine tests do not establish exact-version or physical-device acceptance. See the [audit](docs/AUDIT_REPORT.md) before release.

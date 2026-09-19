# 🦈 Shark Empti · v1.15.1

Shark Empti addresses a practical educational concern: abundant digital resources often remain disconnected from learners' actual progress. Static question banks encourage repetition, general-purpose chatbots lack sustained learning context, and conventional assessments frequently end with a score rather than meaningful guidance. Shark Empti instead approaches learning as a continuous, evidence-informed process.

This purpose is consistent with Vietnam's wider educational modernization agenda, including **Resolution 57-NQ/TW (2024)** on science, innovation, and digital transformation; **Resolution 71-NQ/TW (2025)** on educational breakthroughs; **Decision 131/QĐ-TTg (2022)** on digital transformation in education; and **Decision 127/QĐ-TTg (2021)** on the national AI strategy. These references establish contextual alignment only; they do not imply governmental endorsement or regulatory compliance.

Within this context, Shark Empti unifies assessment, reflection, focused practice, and peer learning. Configurable activities, contextual guidance, bilingual access, learning records, community participation, and optional attention support help learners understand their present position, identify appropriate goals, and exercise meaningful control over their progress. Each learning event consequently becomes a visible sequence of evidence, interpretation, and purposeful action.

## 🏆 National Recognition and Continuing Development

Shark Empti earned national recognition at **AI Young Guru 2026** through **"VTS - Cá Mập Laze"**, representing **Võ Thị Sáu High School, Hồ Chí Minh City**. From more than **26,000 participants**, over **15,000 teams**, and **1,800 upper-secondary and vocational schools**, the team progressed through the Top 250 and Top 30, ranked among the **Top 12**, and received the **Promising Award**. This repository directly continues that award-winning Shark Empti product, not a separate successor or reconstruction. It preserves the original educational purpose while advancing toward greater pedagogical maturity, operational dependability, and socially meaningful application.

**AI Young Guru** is a nationwide AI creativity competition for upper-secondary and vocational students. **FPT University** organizes it under the patronage of the **Ministry of Education and Training** and professional patronage of the **Ministry of Science and Technology**, with the **Science and Education Programme Department of Vietnam Television**, the **Central Committee of the Ho Chi Minh Communist Youth Union**, the **Department of Cybersecurity and High-Tech Crime Prevention under the Ministry of Public Security**, and units of **FPT Corporation**. Its mission, **“Bình dân học AI”**-making AI learning broadly accessible-promotes innovative thinking and practical AI proficiency to improve quality of life and support sustainable development.

The progression and recognition of "VTS - Cá Mập Laze" may be consulted through the following official records:

- [Official AI Young Guru Fanpage](https://www.facebook.com/aiyoungguru1)
- ["VTS - Cá Mập Laze" advancing to the Regional round](https://www.facebook.com/aiyoungguru1/posts/pfbid0jQvJgADPYpX3ZxuSmLBTrs25xaxLsn7urWU9bNyTQqANqcAFsqi1gXj1Hx9Qv5Hkl)
- ["VTS - Cá Mập Laze" advancing to the Practical round](https://www.facebook.com/aiyoungguru1/posts/pfbid02bfr57ZqxfWRtY7LYwfaFQ7Bit4x94NHMsmGJBAcWoGN6odB4vApv3L2v64uzxN61l?rdid=nlLB1dfbhFpVTRG9#)
- [Invitation to the Practical round](https://www.facebook.com/aiyoungguru1/posts/pfbid0JTEMeq62vQy9evu9SS99cbYHpHofMUbMXbV4vrfGVyxYcYsjLP5MveBnR974B1Mpl?rdid=sc7MoUU3UXosSdm5#)
- [Recognition published by Võ Thị Sáu High School](https://www.facebook.com/permalink.php?story_fbid=pfbid023FaPNEaCvTwEcFmfQ9CrxVHXpY2zKhc9xBpDdiYeVXZcjn8Q9VrEWuCawZWkAwuUl&id=61583508615694&rdid=BipgwzyCQMh6luqG#)
- [Promising Award ceremony and recognition](https://www.facebook.com/reel/1516002886825130)

## 🎯 Directed Learning with Visible Progress

Every learning activity leaves a meaningful marker: a question indicates the learner's present understanding, feedback explains why an answer was unsuccessful, and the next practice activity provides an opportunity to advance. The Dashboard connects these markers into a broader view of progress, while Shark Guru remains available when a learner needs sufficient explanation to continue independently.

- **AI-generated quizzes and personalized feedback:** transform a learning objective into an appropriate set of questions, then translate mistakes into specific directions for improvement.
- **Practice, Flashcards, and Dashboard:** revisit the knowledge that must be retained, the skills that require reinforcement, and the evidence that should be reviewed.
- **Arena and Forum:** support community learning through academic challenges, leaderboards, and constructive discussion.
- **Focus Shield:** protects a deliberate period of concentration through an in-browser camera feature that operates only when the learner explicitly enables it.

AI inputs and outputs are validated against server-side schemas, and the OpenRouter fallback sequence prevents generation from depending upon a single model. AI results remain educational support and do not replace independent verification of academic knowledge.

When an AI operation cannot be completed, the error notification preserves an error code and allowlisted diagnostic metadata, such as the operation, number of attempted models, final failure classification, and HTTP status when available. It does not display prompts, raw model responses, stack traces, or secrets.

## 🧭 Current Technology

- Next.js 16.3.4, React 19.2.8 and TypeScript 6.
- Firebase Authentication, Cloud Firestore, Firebase Admin SDK and Firestore Security Rules.
- OpenRouter Chat Completions through `fetch`, with a nominal Inkling → Gemma → Nemotron priority. The effective starting model can change to the process-scoped `preferredModel` after a successful request or warm-up.
- Tailwind CSS 4, Radix UI, Recharts and KaTeX.
- TensorFlow.js for Focus Shield; its runtime and model load only when the feature is enabled.
- Vitest, Testing Library, Firebase Emulator Suite and Playwright.

## 🚀 Quick Start

### 🔧 Prerequisites

- Node.js **24.x** and its bundled npm. `.nvmrc` and `package.json#engines` both select major 24.
- npm registry access for the first clean installation.
- A Firebase project with a Web App, Cloud Firestore and Google Authentication.
- An OpenRouter API key when AI features are required.
- Firebase Admin service-account credentials when Arena submission or Forum comment creation/deletion APIs must run outside the Emulator.
- JDK 21 and Playwright Chromium/WebKit/Firefox for integration/E2E tests.

### 📦 Install Dependencies and Create the Environment File

From the repository root, use PowerShell:

```powershell
node --version
npm --version
npm ci

if (-not (Test-Path -LiteralPath .env)) {
  Copy-Item -LiteralPath .env.example -Destination .env
}

# Fill the required variables in .env; never commit or print this file.
npm run dev
```

Open [http://localhost:9002](http://localhost:9002).

The repository is governed by `package-lock.json`; do not use pnpm or Yarn against the same `node_modules`. `npm ci` performs a clean installation, requires the lockfile to match the manifest and may replace the complete `node_modules` directory.

### 🔑 Minimum Configuration by Feature

| Feature | Configuration requirement or guidance |
|---|---|
| Configure the Firebase browser client, sign in and access Firestore | Provide the complete six-field Firebase Web configuration for consistency. The current application initializes Auth and Firestore but not Storage or Messaging; `storageBucket` and `messagingSenderId` are carried as configuration fields rather than independently validated runtime prerequisites. Google provider and the relevant authorized domains remain required for Google sign-in. |
| Generate quizzes, flashcards, practice, feedback and chatbot responses | `OPENROUTER_API_KEY` |
| Submit Arena attempts; create/delete Forum comments outside the Emulator | Three `FIREBASE_ADMIN_*` values |
| Local integration/E2E | JDK 21; Firebase CLI in dev dependencies; Playwright Chromium, WebKit and Firefox |

[docs/CONFIGURATION.md](docs/CONFIGURATION.md) contains the complete process for obtaining every Firebase/OpenRouter value, mapping service-account JSON fields, enabling Google sign-in, creating Firestore, deploying Rules and configuring Vercel. Never expose `OPENROUTER_API_KEY` or `FIREBASE_ADMIN_*` through `NEXT_PUBLIC_*` variables.

## 🧪 Development and Validation Commands

| Command | Purpose | Network/external services |
|---|---|---|
| `npm run dev` | Run the Next development server on port 9002 | Not required for static pages; Firebase/AI require their respective configuration |
| `npm run lint` | ESLint, Next and React Hooks | No |
| `npm run typecheck` | TypeScript `--noEmit` | No |
| `npm test` | Unit/component tests | Never calls production services |
| `npm run test:coverage` | Unit/component tests with V8 coverage | Never calls production services |
| `npm run test:rules` | Firestore Rules tests through the Emulator | JDK 21 |
| `npm run test:integration` | Auth/Firestore Emulator, Rules and API integration | JDK 21 |
| `npm run build` | Next production build | No font download; uses local system fonts |
| `npm run test:e2e` | Real app, Auth/Firestore Emulator and AI fixture; Chromium desktop/mobile, WebKit and Firefox | JDK 21 and installed Playwright browsers |
| `npm run test:production` | Start the optimized build and check six routes, script payload budgets and API authentication | No production service; requires a completed build |
| `npm run report:bundle` | Inventory production entry and deferred JavaScript chunks | No; requires a completed build |
| `npm run report:performance` | Record synthetic 100/1,000/10,000-record processing baselines | No |
| `npm run audit:dependencies` | Query npm's advisory endpoint for the current lockfile and write `reports/dependency-audit.json` | npm Registry; transmits dependency names and versions |
| `node scripts/inspect-firestore.mjs` | Read deployed posts-index and receipt-TTL metadata; write `reports/firestore-metadata.json` | Google API and Admin credentials; read-only |
| `node --conditions=react-server --env-file=.env --import tsx scripts/receipt-retention.ts` | Inspect receipt expiry metadata; `--apply` backfills missing `expiresAt` values only | Firebase Admin credentials; `--apply` changes receipt documents |
| `npm run ai:health` | Check the model catalogue endpoint and fallback-model presence | OpenRouter network; does not prove key/quota/inference validity |
| `npm run ai:smoke` | Generate one real quiz and chatbot response | OpenRouter key; may consume quota |
| `npm run clean` | Remove `.next` only; retain `node_modules` | No |

Install the browser after `npm ci`:

```powershell
npx --no-install playwright install chromium webkit firefox
```

CI in `.github/workflows/ci.yml` uses Node 24, JDK 21, a demo Firebase project and an AI fixture; it does not require production credentials.

## 🧩 Functional and Data Scope

- The interface supports Vietnamese and English; language/theme preferences persist across pages and tabs.
- Camera access requires HTTPS or `localhost` and explicit user permission.
- Firestore Web SDK access is governed by `firestore.rules`; Firebase Admin SDK bypasses Rules, so server APIs must enforce tokens, ownership and payload contracts.
- `docs/backend.json` is a descriptive data map; Zod schemas, TypeScript readers, Route Handlers and Firestore Rules are the executable contracts.
- Documented browser targets are Safari 16.4+, Chrome 111+ and Firefox 128+, while E2E configures desktop/mobile Chromium, WebKit and Firefox (current engine versions). Review the audit validation gaps before release.

## 📚 Documentation

- [Configuration](docs/CONFIGURATION.md)
- [Technical Documentation](docs/TECHNICAL_DOCUMENTATION.md)
- [Backend](docs/backend.json)
- [Audit Report](docs/AUDIT_REPORT.md)

### 🧭 Recommended Reading Order

1. Start with [Configuration](docs/CONFIGURATION.md) to install dependencies, create `.env`, and run the local application.
2. Read [Technical Documentation](docs/TECHNICAL_DOCUMENTATION.md) for the executable architecture, data ownership, and operational boundaries.
3. Review [Audit Report](docs/AUDIT_REPORT.md) before release work; its unresolved findings and validation gaps define the evidence that is still required.

All repository documentation is maintained in English. The application interface itself remains bilingual, and localization behavior is described in the technical documentation.

Never commit `.env`, service-account JSON, private keys, API tokens, Playwright traces containing credentials or production data. `.gitignore` cannot remove a secret that was already committed; exposed credentials require revocation/rotation and a separately approved history-remediation procedure.

Lists use explicit cursor pagination in batches of 50; search, statistics and reports reflect the records loaded in the client. Current implementation status and external validation gaps are tracked in the audit report.

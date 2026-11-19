# 🎨 Interface Design · Shark Empti v2.0.0 **β**

Shark Empti helps a learner choose an activity, finish it, understand their answers and return to practice. A learner can move between Vietnamese and English, change theme or recover an interrupted session while keeping their work. This guide describes how those behaviors appear in the interface.

## 🧭 Screens and navigation

| Surface | Primary action | Design considerations |
|---|---|---|
| Public home, About and service pages | Understand the service and decide whether to sign in | Render readable public text, a descriptive page heading and ordinary links. Keep contact, privacy and data controls discoverable. |
| Setup, Quiz and Result | Choose a topic, answer questions and review feedback | Keep the active question and its answer controls together. Preserve the submitted answer during feedback, and expose a retry if saving fails. |
| Dashboard and Playground | Find a topic to revisit, practise or review cards | Label the scope of loaded history. Keep missing measurements distinct from zero and retain bilingual topic identity when switching views. |
| Forum, Arena and moderation | Discuss a topic or complete a community challenge | Show the state of the current user's reaction separately from the public count. Keep the Arena answer key private until the server accepts the submission. |
| Profile, account data and receipt | Review learning records or exercise data rights | Data controls have their own route. Give export, deletion confirmation and receipt status distinct labels and recovery actions. |

Login and registration enable the age confirmation once the guest form can receive input. The first check enables the Google button. Setup makes topic entry available before warming learning history. Dashboard and Playground share that history when the learner switches views. Resorting Forum posts retains the learner’s confirmed reaction indicators.

The root layout applies the initial language and theme. Navigation, route-aware providers and feature components own the transitions inside the app. See [technical documentation](TECHNICAL_DOCUMENTATION.md) and [account operations](ACCOUNT_OPERATIONS.md).

## 🎨 Colour, typography and surfaces

Use the semantic tokens in [global styles](../src/app/globals.css) and their mappings in the [theme configuration](../tailwind.config.mts). Use each surface with its matching foreground.

| Token pair or family | Role |
|---|---|
| `background` / `foreground`, `card` / `card-foreground` | Page and content surfaces. Light mode uses warm neutrals. Dark mode uses cool near-black surfaces. |
| `primary` / `primary-foreground`, `secondary` / `secondary-foreground` | The orange primary identifies prominent actions. The amber secondary supports highlights. |
| `muted` / `muted-foreground`, `destructive` / `destructive-foreground` | Supporting text and error or destructive actions. Pair colour with text, an icon with an accessible name, or a state label. |
| `border`, `input`, `ring`, `chart-1` through `chart-5` | Boundaries, keyboard focus and data series. Label chart values independently of colour. |

Inter is the body face. Space Grotesk is the headline face. Both are self-hosted with Vietnamese subsets, swap during loading and fall back to system fonts. Use semantic headings and allow long Vietnamese labels to wrap. KaTeX expressions can scroll horizontally inside their own container. [Font definitions](../src/app/fonts.css)

Rounded cards, thick borders and offset shadows give buttons and panels depth. Use the shared button, card and dialog components so hover, active, disabled and keyboard-focus states remain consistent. Reserve hover effects for enhancement. Touch and keyboard users must be able to perform the same action. [UI primitives](../src/components/ui)

## 📐 Layout, overlays and print

The root font is 16 px on small screens and 12.8 px from 1024 px wide. The main desktop container is capped at 80% of the viewport width. Size type and touch targets with their rendered dimensions in mind. Check narrow portrait screens, short landscape screens and long translated labels.

Keep navigation reachable while scrolling, constrain chat and Focus Shield panels within the viewport, and let long panel contents scroll. Dialogs need a readable title, an accessible close action, keyboard focus containment and focus return. Honour reduced-motion preferences for decorative animation and intentional scrolling.

The Profile page offers **Export Academic Report** as soon as the profile is ready. Opening it starts a fresh selection and shows loading, retry and pagination inside the dialog. A successful empty read and a search with no matches have distinct messages. Keep the empty message and selected count legible in both themes. The dialog actions wrap on narrow screens so the full Generate button remains visible. Each session row uses a labelled native checkbox with the same keyboard and pointer selection behavior. The count includes only sessions still available to select. Generating the report captures those sessions so that preview, copy and print describe the same attempts even if history changes. [Report selection](../src/hooks/use-profile-report.ts)

The profile report uses a printable article under the document body. Printing hides the surrounding application, removes viewport constraints and represents chart data as labelled tables. Keep topic headings, mathematical content and long recommendations legible across page breaks. [Print implementation](../src/components/profile-print-report.tsx)

## 🔄 Interaction and recovery

| State | What the learner sees and can do |
|---|---|
| Loading | A skeleton that follows the route layout. A stalled reader offers an explicit retry. |
| Empty or partial | An empty state after a successful read. Summaries and searches describe the pages already loaded. |
| Editing or saving | The typed draft and pending action remain visible. Prevent duplicate submissions and acknowledge a save after persistence. |
| Error | Describe the affected action in the active language, keep recoverable input and offer an appropriate retry. Keep credentials and provider payloads private. |
| Recovery or completion | Resume owner-scoped work when available. Use the original save identity after response loss. Distinguish an unavailable receipt from a temporary read failure. |

Focus Shield’s launcher stays disabled until the panel can open on the first activation. Tracking starts when the learner enables **Tracking Mode** and grants camera permission. The camera preview plays continuously between score updates. Hiding the preview keeps tracking active. Minimizing pauses sampling and keeps the camera available to resume. Closing the panel releases the camera. Show its active state, stop control and recovery message. Describe its score as experimental. AI feedback should identify what the learner can practise and acknowledge uncertainty. [Data and AI contracts](backend.json)

## 🧪 Reviewing a change

Trace one complete task with keyboard and touch, in both themes and languages. Check the visible focus indicator, accessible name, error announcement, text wrapping, loading state and recovery after failure. Exercise the affected flow on the configured browser matrix, including mobile viewport constraints. Record the engine, version, environment and result for any compatibility claim.

The [validation guide](VALIDATION.md) covers browser, accessibility and print checks. [Configuration](CONFIGURATION.md) describes the build environment. The [audit register](AUDIT_REPORT.md) lists open and resolved findings. See the [project overview](../README.md) for product scope.

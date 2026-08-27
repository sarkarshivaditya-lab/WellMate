# WellMate Project State

## Baseline

Current protected application baseline:

- Application rollback baseline: 5575511c4372896318a2dc1185475f00ed231465
- Engineering baseline: d595c16ceb2c0d09ac836e914c616a1508fca3a3
- Branch: main

Do not rewrite either protected baseline commit.

## Stack

- Frontend: React 19 + TypeScript 5.9 + Vite 7
- Routing: React Router
- Backend/sync: Convex
- Authentication: Auth0 React SDK; Capacitor native callback handler exists
- Mobile runtime: Capacitor Android/iOS 7.x
- Architecture: mobile-first, local-first, privacy-first, deferred server sync

## Current source architecture

Primary frontend roots observed under `src/` include:

- `components/` shared UI/layout/providers
- `contexts/` application contexts
- `hooks/` reusable local/state hooks
- `adapters/` integration boundaries
- `data/` local data ownership including onboarding payloads
- `pages/` route-level experiences including Welcome, Onboarding, Transition, PhysicalDashboard, Habits, Sleep, mental pages, Profile, Chat, Tools, Roadmap and Pricing
- `ai/` current AI runtime/provider/assistant/cognition infrastructure
- `analytics/`, `notifications/`, `reliability/`, `intelligence/`, `insights/`, `export/`, `design/` supporting systems

Backend Convex modules include users, habits, meals, moods, journal, sleep, subscriptions and AI coach modules.

## Routing and authentication

`src/App.tsx` uses `BrowserRouter` and lazy route loading. Key routes are `/`, `/welcome`, `/onboarding`, `/overview`, `/physical`, `/mental`, `/journal`, `/mental/coach`, `/habits`, `/tools`, `/profile`, `/chat`, `/sleep`, `/roadmap`, and `/pricing` plus development routes.

Authenticated application routes use `RequireAuth` and then `RequireOnboarding`. `RequireAuth` invokes Auth0 login; on Capacitor it opens Auth0 through the system browser and relies on `CapacitorAuthHandler`/`appUrlOpen` handling for the native callback. `RootEntry` currently routes unauthenticated users based on local `onboarded` and welcome flags.

The requested transformation explicitly requires repairing the onboarding-to-Auth0-to-authenticated-app flow while preserving the ability to render onboarding/profile locally without network availability.

## Onboarding and canonical profile ownership

`src/pages/Onboarding.tsx` is the existing 8-step onboarding experience. It stores an in-progress draft through `src/data/local/onboardingPayload.ts` and writes the completed snapshot to `localStorage` key `onboarding_profile` before navigating to `/physical`.

`src/hooks/useLocalProfile.ts` derives the canonical local profile directly from the local onboarding payload. The source code and `CLAUDE.md` treat this local profile as authoritative for onboarding/profile rendering and local wellness calculations.

The transformation requires adding blood type, allergies and emergency contacts to this same local ownership model. Do not create a duplicate canonical profile store and do not make completion network-dependent. The user request explicitly authorizes changing the locked onboarding behavior for this feature, but not replacing its architecture.

## Existing emergency/sensor capability

Initial repository search did not find an existing production accident-detection state machine or a dedicated GPS/accelerometer/gyroscope service. The current package contains Capacitor core/mobile packages but no dedicated motion plugin was identified in the initial dependency inspection. The emergency subsystem therefore needs a new sensor-service abstraction with platform adapters and a deterministic accident state machine rather than UI-level sensor logic.

Requested automatic mode semantics: low-frequency location sampling around 20 seconds while stable, then higher-frequency motion sensing when meaningful movement is detected. Accident detection must use multiple signals and temporal windows rather than a zero-speed shortcut.

Requested manual mode: explicit tracking state with clear `TRACKING ACTIVE` status and user stop control.

## Platform constraints discovered during initial research

- Capacitor is the supported native bridge and can expose native device APIs through plugins/custom native plugins. Authoritative Capacitor documentation describes Geolocation as a native-capability bridge and supports adding custom plugins for platform-specific functionality. See current research in execution notes.
- Android exposes a `KEYCODE_POWER`, but the key is system-controlled; a normal app cannot assume it will receive repeated power-button events. The requested three-press shortcut must therefore be treated as an explicit platform adapter/fallback, not simulated in JavaScript.
- iOS currently documents hardware-button capture event APIs, but they are constrained to camera/capture use cases and only delivered to apps actively using capture. This does not provide a general power-button triple-press interception mechanism for WellMate.
- iOS supports user-configurable Action Button/App Shortcut and Controls pathways, which are legitimate alternatives for a hardware-assisted emergency shortcut where appropriate; this is not equivalent to silently intercepting the power button.

## Auth0 risk

`src/App.tsx` currently contains both web and Capacitor-specific Auth0 entry handling. Native auth explicitly opens the Auth0 URL with Capacitor Browser and expects the native app callback handler to complete the exchange. A timeout fallback currently routes users back toward onboarding instead of permanently trapping the app. This area is a priority because the requested product flow currently gets stuck after onboarding.

## AI architecture and removal boundary

The current application has a large local/offline AI subsystem under `src/ai/`, including runtime lifecycle management, local provider implementations, model bridges, cognition/assistant infrastructure, memory/consolidation, workers and related state. Initial search confirms direct local-provider implementations using Wllama and Transformers libraries, and the package currently declares `@wllama/wllama` and `@xenova/transformers` dependencies.

The requested transformation requires complete removal of the offline AI runtime/provider/model-download/cache/inference graph and all obsolete dependencies, while preserving a clean application-facing AI service boundary for a future online adapter. The future provider must not be invented in this change.

## Privacy and data handling

Blood type, allergies, emergency contacts, location and motion data are sensitive. The canonical local-first profile must remain device-resident by default. Emergency escalation may transmit only the minimum necessary emergency information to configured recipients when required. Sensitive information must not be placed in generic diagnostics or logs.

## Validation requirements

Every meaningful change must be validated with targeted tests plus TypeScript/build/lint where applicable. Emergency detection requires deterministic unit coverage for normal movement, normal stops, GPS jitter, suspicious movement, sudden stop, sustained inactivity, sensor/GPS unavailability, permission denial and duplicate escalation protection. Confirmation-window tests must cover cancellation, explicit escalation and timeout escalation. Auth tests must cover launch, callback, hydration and route transition. Offline-AI removal must be checked with dependency/import searches and production build.

## Likely files to change

- `src/data/local/onboardingPayload.ts`
- `src/pages/Onboarding.tsx`
- `src/hooks/useLocalProfile.ts`
- `src/App.tsx`
- new emergency/sensor/state-machine services and tests under `src/`
- Auth0/Capacitor integration files under `src/components/providers/` and `src/pages/auth/` as required by inspection
- `package.json` and lockfile after offline-AI graph removal
- AI service boundary files after local runtime removal
- memory/documentation files as durable discoveries are made

## Known technical debt / risks

- Existing auth flow has a known post-onboarding failure mode.
- Existing AI startup in `App.tsx` initializes a broad local AI runtime and related self-healing/cognition infrastructure; this must be excised without breaking unrelated app startup.
- The repository includes an extensive engineering-skill system and several historical Claude memory documents; source code plus `CLAUDE.md` remain authoritative.
- No repository-local clone is available in the current tool workspace, so repository writes are being performed through the GitHub connector. Local command execution must only be claimed when a real checkout is present.

## Current transformation direction

WellMate is being repositioned around the Golden Hour emergency-response workflow: detect possible accidents conservatively, provide an approximately 15-second confirmation window, then escalate with current location and the minimum necessary medical/emergency-contact context. Existing wellness surfaces should remain intact unless they conflict with this emergency center of gravity.
## Liquid Glass design-engineering foundation

A WellMate-specific Liquid Glass skill system now lives under `.engineering-skills/wellmate/liquid-glass/`, covering implementation principles, design tokens, actual component mapping, accessibility, performance, responsive behavior, and research. The visual rebuild also has a repeatable validation skill at `.engineering-skills/wellmate/visual-regression/SKILL.md`.

The direction is intentionally selective: Liquid Glass is primarily a functional-layer treatment for navigation, persistent tools, floating actions and selected transient controls. Dense content surfaces, lists, charts, sensitive profile information and emergency-critical controls remain solid or near-opaque by default.

The existing frontend foundation must be extended rather than duplicated: `src/design/tokens.ts`, `src/index.css`, `src/motion/`, `src/components/ui/`, and `src/components/layout/AppShell.tsx`, `PageLayout.tsx`, and `BottomNav.tsx`.

Durable accessibility constraints: Golden Hour emergency interactions must remain instantly readable and usable under stress; transparency cannot be the sole semantic signal; focus-visible must remain obvious; touch targets must stay 44px-class; reduced motion/high contrast must preserve state clarity; explicit opaque fallbacks are required.

Durable performance constraints: backdrop blur is a limited rendering budget; no per-row blur in long lists; avoid nested filters and continuous filter/shadow animation; concentrate glass in a small number of functional containers; use progressive enhancement; do not add a runtime Liquid Glass package until an actual need is proven.

Responsive requirements remain mobile-first, including 360px/390px/430px phone widths, landscape mobile, tablet portrait/landscape and common desktop widths. Preserve existing safe-area behavior.

Research conclusion: Apple's current guidance supports using Liquid Glass primarily for functional layers and standard materials for content. Third-party React/React Native projects are implementation references only. WellMate-specific implementation must preserve its green identity and existing architecture.

This task is documentation-only. No application source files or package dependencies were changed.

## Memory maintenance rule

Update this file whenever durable architecture, platform constraints, root causes, dependency relationships, emergency-state behavior, AI-removal findings or rollback information materially changes. Source code and `CLAUDE.md` remain authoritative if any discrepancy appears.
## Liquid Glass implementation status

The documented Liquid Glass frontend rebuild is implemented on `chore/liquid-glass-foundation` using the existing WellMate CSS/token/component architecture. Functional layers use named material classes; dense content remains stable/opaque; emergency-critical content remains solid/high-contrast.

Shared surfaces implemented: AppShell search/profile, BottomNav, Button variants, Input, Card baseline, Dialog, Sheet. Selective page-level treatment is applied to Overview, Mental Overview, Habits, Sleep, Chat and Roadmap. Long lists, charts, sensitive profile data and emergency-critical actions are not broadly blurred.

Accessibility constraints are encoded in the shared material layer: `prefers-reduced-motion`, `prefers-contrast: more`, and progressive opaque fallbacks for transparency/browser support. Focus-visible and 44px-class interactive targets remain part of the component contracts.

Performance constraints are encoded in the shared material layer and implementation: bounded blur radii, no per-row glass, no continuous blur animation, and functional-layer concentration. No new runtime dependency was added for Liquid Glass.

Validation recovery completed: repository CI initially exposed seven lint errors and one OPFS typing build failure. The lint errors were repaired without disabling lint rules, then CI exposed the real toolchain mismatch: Vite 7 requires Node 20.19+/22.12+ while CI pinned Node 18. The workflow was updated to Node 22. A subsequent full CI run passed dependency installation, ESLint, TypeScript, and production build.

Build-compatibility fixes made during validation were limited to:
- typed Capacitor runtime detection in `src/ai/providers/local/llamaBridge.ts`;
- stable chart hook ordering in `src/components/charts/SparkLine.tsx`;
- empty-expression/catch cleanup in affected existing components;
- typed non-standard `memorypressure` event registration in `src/reliability/lifecycleCoordinator.ts`;
- compatible OPFS directory iteration typing in `src/ai/providers/local/modelStorage.ts`;
- CI Node runtime alignment to Node 22 in `.github/workflows/ci-lint-test.yml`.

CI run `33091534730` completed successfully on the final branch commit. The repository does not contain an automated browser/e2e test harness, so screenshot/render validation remains an environment/tooling gap rather than a passed automated check. Source-level visual, responsive, accessibility and performance review was performed against the documented Liquid Glass rules.

PR #2 is open, mergeable, and points at the final branch head. Protected baselines remain untouched.

## Rollback

The current frontend changes are isolated on `chore/liquid-glass-foundation`. The protected application baseline is `5575511c4372896318a2dc1185475f00ed231465`; engineering baseline is `d595c16ceb2c0d09ac836e914c616a1508fca3a3`.
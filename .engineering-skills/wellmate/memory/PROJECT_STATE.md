# WellMate Project State

## Baselines and rollback
- Protected application baseline: `5575511c4372896318a2dc1185475f00ed231465`
- Protected engineering baseline: `d595c16ceb2c0d09ac836e914c616a1508fca3a3`
- Working branch: `chore/liquid-glass-foundation`
- Never rewrite or force-push either protected baseline.

## Stack and ownership
- React 19 + TypeScript 5.9 + Vite 7
- React Router
- Convex backend/sync
- Auth0 React SDK with Capacitor native callback handling
- Capacitor Android/iOS 7.x
- Mobile-first, local-first, privacy-first architecture
- `src/data/local/onboardingPayload.ts` is the canonical local onboarding/profile ownership path; `src/hooks/useLocalProfile.ts` derives the local profile.

## Authentication
- `src/App.tsx` uses BrowserRouter and protected routes with Auth0 plus onboarding guards.
- Capacitor authentication uses the system browser and `CapacitorAuthHandler`/`appUrlOpen` callback handling.
- Auth0 source architecture was preserved during the Golden Hour/Liquid Glass work.
- Full interactive browser auth validation is not available in the current environment; do not record it as browser-validated.

## Golden Hour product center
WellMate is positioned around: `Bridging the Golden Hour gap between accident and action.`

Golden Hour is a first-class authenticated experience and is rendered near the top of Physical Health. It is also represented during onboarding through the existing local-first profile flow.

Emergency profile fields are collected through the existing onboarding/profile ownership model:
- blood type
- allergies
- emergency contact name
- emergency contact phone
- tracking mode: automatic/manual

## Emergency detection architecture
`src/emergency/detection.ts` contains the deterministic state model:
- IDLE
- TRACKING
- MOVING
- SUSPICIOUS_MOTION
- CONFIRMATION
- ESCALATING
- ESCALATED
- CANCELLED

Detection uses:
- consecutive GPS coordinates and timestamps to derive speed
- GPS accuracy filtering
- recent-sample temporal windows
- acceleration and rotation signals
- movement-before-stop corroboration
- multiple impact samples
- a 1.2-second suspicious-motion temporal requirement when the state carries `suspiciousSinceMs`
- no missing-speed-as-movement shortcut
- no stationary/GPS-jitter direct accident trigger

Automatic mode samples location on an approximately 20-second interval while active. Device-motion permission/listening is foreground browser functionality and is currently attached from the Golden Hour surface; browser background execution limitations must remain explicit.

Manual mode exposes explicit `TRACKING ACTIVE` and a stop control.

Confirmation is 15 seconds with `I'M OK` and `I NEED HELP NOW`; timeout and explicit escalation share duplicate-escalation protection.

## Emergency delivery
`src/emergency/emergencyService.ts` defines:
- `EmergencyDispatcher`
- `WebEmergencyDispatcher`
- `NativeEmergencyDispatcher`
- `createEmergencyDispatcher()`
- truthful `PENDING`, `SUCCESS`, `PARTIAL_SUCCESS`, `FAILED` delivery vocabulary

Browser `tel:`/`sms:` actions are system-mediated and are reported as `PENDING`, not as confirmed delivery. Native dispatcher support is isolated and does not claim capabilities that are not implemented. The emergency event carries only the minimum necessary profile/location/timestamp/reason context.

Power-button support remains platform-honest: ordinary web is unsupported; native is represented as a fallback rather than falsely claiming universal interception.

## Liquid Glass implementation
The shared Liquid Glass foundation is implemented through existing WellMate CSS/tokens/components rather than a new runtime package.

Glass is selective and functional:
- ambient green-tinted environment/depth
- AppShell search/profile layers
- floating BottomNav
- PageLayout/header/sync surfaces
- selected inputs/buttons/dialogs/sheets
- selective overview, mental, habits, sleep, chat and roadmap layers
- onboarding uses the same material language

Dense lists, charts, sensitive profile data and emergency-critical controls remain solid/near-opaque. Emergency actions are intentionally not glass-dependent.

Accessibility/performance rules include progressive opaque fallbacks, reduced-motion/reduced-transparency/high-contrast handling, obvious focus-visible states, 44px-class targets, bounded blur, no per-row blur and no continuous blur/shadow animation.

Rendered browser/screenshot validation is NOT available in the current tool environment. Source-level visual/accessibility/responsive/performance review can be recorded, but live viewport rendering must not be claimed.

## Offline AI removal
The obsolete local/offline AI execution graph has been removed from the current branch, including local providers, model lifecycle/download/storage, inference workers, runtime governors, offline retrieval/cognition support and the old unconfigured emergency Jest test.

`package.json` no longer declares `@wllama/wllama` or `@xenova/transformers`. The lockfile was cleaned of those packages and orphaned ONNX entries. The remaining AI surface is limited to application-facing/neutral service contracts and the live UI boundary; no future online backend is invented here.

Repository search indexes can return historical baseline matches, so current-tree/file inspection is authoritative for removal verification.

## Deterministic tests
The repository now has an executable Node-native test command:
`node --experimental-strip-types --test tests/emergency-detection.test.mjs`

CI runs it before production build. Current deterministic coverage includes normal movement, normal stop, GPS-derived speed, poor-accuracy GPS jitter, single hard acceleration, sustained suspicious motion plus stop, rotation, unavailable motion, sustained inactivity, confirmation timing, tracking modes and cancellation.

Latest verified CI run for commit `da58c5b56999899b3e699191a0f3d7d051fcf2bd` was run `33100669277` / workflow run #483 and completed successfully for dependency installation, ESLint, TypeScript, deterministic emergency tests and production build.

## Current validation limits
- No local repository checkout is exposed; local `git status`, local command execution and local browser tooling must not be claimed.
- No browser runtime/screenshot harness is exposed, so responsive/rendered validation remains unverified.
- Native emergency delivery cannot be claimed as successful without an implemented platform-specific native call/SMS plugin.
- Full interactive Auth0/browser transition testing remains unverified.
- CI must be rerun after this memory update because the memory file is part of the final commit.

## CI workflow
`.github/workflows/ci-lint-test.yml` runs on PRs to main/develop and now executes:
1. frozen pnpm install
2. ESLint
3. TypeScript typecheck
4. deterministic emergency tests
5. production build

## Final-state maintenance rule
Update this file whenever durable architecture, emergency-state behavior, AI-removal findings, dependency relationships, rollback information or validation results materially change. Never mark a capability as browser/native validated unless the corresponding runtime validation actually occurred.

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
The shared Liquid Glass foundation is implemented through the existing WellMate CSS/tokens/components with no new runtime package.

Current visual hierarchy:
- atmospheric green/neutral environment
- floating AppShell/PageLayout functional glass
- floating BottomNav glass dock
- elevated Dialog/Sheet surfaces
- restrained glass Inputs
- selective glass on Physical, Mental, Habits, Sleep, Chat, Roadmap and Profile functional layers
- onboarding main surfaces use the same material vocabulary
- dense content, charts and sensitive data remain solid/near-opaque
- emergency-critical actions remain solid/high contrast

The visual intensification pass strengthened translucency, environmental depth and material separation while retaining the repository's performance rules: bounded backdrop blur, no per-row blur, no continuous blur animation and opaque fallbacks.

## Golden Hour verification
The deterministic emergency model in `src/emergency/detection.ts` remains explicit:
- IDLE
- TRACKING
- MOVING
- SUSPICIOUS_MOTION
- CONFIRMATION
- ESCALATING
- ESCALATED
- CANCELLED

Verified source behavior includes approximately 20-second stable GPS sampling in automatic mode, GPS-derived speed from consecutive points/timestamps, poor-accuracy filtering, temporary GPS/motion unavailability tolerance, temporal suspicious-motion handling, 15-second confirmation, duplicate escalation protection and truthful browser/native dispatcher semantics.

A detector hardening change now requires the abrupt-stop decision to use the latest sample as stopped plus a prior meaningful movement sample inside the temporal window, rather than merely finding movement and stop somewhere in the buffer.

`Onboarding.tsx` and `useLocalProfile.ts` remained protected/unchanged during this pass; emergency profile ownership remains local-first with blood type, allergies, emergency contact name/phone and automatic/manual tracking mode.

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
- No local repository checkout is exposed; local `git status` and local command execution cannot be claimed.
- No browser runtime/screenshot harness is exposed, so rendered viewport validation remains unverified.
- Native emergency delivery cannot be claimed as successful without an implemented native call/SMS integration.
- Interactive Auth0/browser transition testing remains unverified.
- The repository's current CI workflow is the validation authority.

## CI workflow
`.github/workflows/ci-lint-test.yml` runs on PRs to main/develop and now executes:
1. frozen pnpm install
2. ESLint
3. TypeScript typecheck
4. deterministic emergency tests
5. production build

## Latest pass status
The current branch head after the latest accepted changes is being validated through GitHub Actions. The most recent completed CI evidence before this pass showed install, ESLint and TypeScript green but the build failed on stale emergency/AI references; those references were repaired. The latest commit's fresh CI result is not yet available, so it must not be recorded as passing.

## Final-state maintenance rule
Update this file whenever durable architecture, emergency-state behavior, AI-removal findings, dependency relationships, rollback information or validation results materially change. Never mark a capability as browser/native validated unless the corresponding runtime validation actually occurred.


## Latest Liquid Glass + Golden Hour polish checkpoint

The current branch now has a stronger, visibly translucent Liquid Glass treatment across shared interactive controls, page headers/tabs, floating navigation and functional surfaces. Interactive outline/secondary/ghost buttons use a high-opacity glass material (~0.90 surface alpha) rather than opaque card fills; destructive/emergency actions remain solid.

Profile now includes a persistent Golden Hour tracking-mode selector (Automatic/Manual) backed by the canonical `onboarding_profile` store. Physical Health now leads with an emergency-readiness/SOS entry and Golden Hour surface.

The Golden Hour emergency surface remains deterministic and platform-honest: temporal movement/suspicious-motion/abrupt-stop detection, 15-second confirmation, duplicate escalation guard, local emergency profile context, web tel:/sms: fallbacks modeled as PENDING rather than delivery success, and honest power-button capability reporting.

Latest GitHub Actions validation run `33143630210` passed all available repository gates: dependency installation, ESLint, TypeScript, deterministic emergency tests, and production build. No browser renderer is available through the engineering connector, so rendered screenshot validation is not claimed. Local developer validation was separately confirmed by the user via `pnpm dev`.

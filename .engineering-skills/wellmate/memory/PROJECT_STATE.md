# WellMate Project State

## Baseline

Protected rollback points:

- Application baseline: `5575511c4372896318a2dc1185475f00ed231465`
- Engineering baseline: `d595c16ceb2c0d09ac836e914c616a1508fca3a3`

Neither protected commit may be rewritten or destroyed.

Current transformation branch: `feat/golden-hour-emergency`.

## Stack

- Frontend: React 19 + TypeScript 5.9 + Vite 7
- Routing: React Router
- Backend/sync: Convex
- Authentication: Auth0 React SDK
- Mobile runtime: Capacitor Android/iOS 7.x
- Package manager: pnpm 10
- CI runtime: Node 22.x

## Golden Hour application architecture

The emergency system is a first-class product path surfaced from the Physical Health route.

Core modules:

- `src/emergency/accidentStateMachine.ts`: deterministic multi-signal accident state machine.
- `src/emergency/accidentStateMachine.test.ts`: deterministic transition coverage.
- `src/emergency/sensorService.ts`: platform-neutral location, accelerometer and gyroscope-equivalent motion abstraction.
- `src/emergency/automaticTracking.ts`: stable ~20-second location sampling with movement promotion to higher-frequency motion sensing.
- `src/emergency/trackingController.ts`: automatic/manual tracking, confirmation timing, deduplication and escalation orchestration.
- `src/hooks/useEmergencyTracking.ts`: React binding.
- `src/components/emergency/EmergencyTrackingPanel.tsx`: tracking UI, 15-second confirmation, `I'M OK`, `I NEED HELP NOW`, stop and manual SOS.
- `src/emergency/emergencyEscalation.ts`: emergency event and `PENDING` / `SUCCESS` / `PARTIAL_SUCCESS` / `FAILED` delivery semantics.
- `src/emergency/platformCommunication.ts`: legitimate browser/Capacitor SMS and telephone handoffs.
- `src/emergency/hardwareEmergencyShortcut.ts`: explicit unsupported hardware power-button boundary.

Accident detection uses suspicious movement, temporal context, abrupt-stop and inactivity signals. Normal stationary GPS jitter is rejected. Sensor input is frozen during confirmation. Timeout escalates; explicit user cancellation restores tracking; explicit user distress escalates immediately. Controller-level duplicate escalation is guarded.

Automatic mode samples location at approximately 20 seconds while stable. Manual mode exposes active tracking and user stop controls.

## Emergency onboarding/profile

`src/data/local/onboardingPayload.ts` owns the canonical local onboarding snapshot under `onboarding_profile`; drafts use `onboarding_draft`.

Emergency profile fields:

- blood type
- allergies
- typed emergency contacts

`src/pages/Onboarding.tsx` collects and validates these fields. `src/pages/Profile.tsx` provides editable emergency profile controls. `src/hooks/useLocalProfile.ts` remains the single application-facing local profile projection.

Emergency escalation transmits only the minimum required context: event reason/time, best available location, blood type, allergies and configured emergency contacts.

## Sensor/platform limitations

- Browser geolocation and DeviceMotion cannot be assumed to provide OS-level background guarantees.
- Location accuracy worse than 100m is filtered.
- Implausible derived speed above 90m/s is ignored.
- iOS-style DeviceMotion `requestPermission` is supported when exposed.
- Android physical power-button interception is not assumed or faked.
- iOS hardware-button APIs are not treated as a generic third-party power-button event stream.
- SMS opens a system composer and remains `PENDING`; the app does not falsely claim delivery.
- Emergency calls use explicit user-driven `tel:` handoff rather than silent dialing.

## Auth0

Native authentication handles both foreground `appUrlOpen` callbacks and cold-start `CapApp.getLaunchUrl()` callbacks in `src/components/CapacitorAuthHandler.tsx`, deduplicates callback processing, delegates to `handleRedirectCallback()` and closes the browser.

Native callback URI is derived from `VITE_AUTH0_NATIVE_REDIRECT_URI` or the documented Capacitor form. Web redirect is controlled through `VITE_AUTH0_REDIRECT_URI` or current origin. Auth0 refresh tokens remain enabled. Actual Auth0 tenant callback registration remains external configuration.

## AI architecture after offline-AI removal

The obsolete offline inference architecture has been removed rather than patched.

Removed graph includes local model storage/download/runtime, llama/WASM bridge, transformers embeddings, vector/RAG retrieval, offline orchestration/cognition, inference queues/runtime governors/thermal model lifecycle, and obsolete local-AI UI/startup coupling.

The known obsolete packages `@wllama/wllama` and `@xenova/transformers` are absent from `package.json` and are removed from the regenerated dependency graph.

The surviving application-facing boundary is:

`UI -> src/ai/service.ts -> OnlineAIAdapter -> future provider/plugin`

No future backend, credentials or fake API calls are implemented. The default adapter is explicitly unconfigured.

The existing Convex mental-coach action is separate online infrastructure and is not part of the deleted offline runtime.

## Testing / Vitest decision

Vitest is intentionally a devDependency because the repository contains the real emergency state-machine test suite and CI must execute it.

Selected version: `vitest@4.1.11`.

Compatibility basis: the project uses Vite 7, TypeScript 5.9 and Node 22.x; Vitest 4 requires Vite >=6 and Node >=20, so the existing toolchain satisfies the supported floor. Vitest ships its own TypeScript declarations; no global TypeScript weakening is required.

`vitest.config.ts` is a dedicated test configuration because the existing Vite configuration contains application-only build/server configuration. The test config keeps the existing `@` and `@/convex` aliases and scopes tests to `src/**/*.test.{ts,tsx}` while excluding backend boilerplate.

The emergency state-machine test remains at `src/emergency/accidentStateMachine.test.ts`; it was not deleted or weakened.

## Dependency / lockfile findings

The initial missing-Vitest failure was real: `package.json` contained the Vitest devDependency but the installed/locked dependency graph did not.

A separate stale dependency was also found: `@radix-ui/react-dropdown-menu@^2.2.16` does not exist in the npm registry; the registry currently exposes the 2.1.x line. The manifest was corrected to `^2.1.24` before dependency validation.

CI proved that pnpm 10 + Node 22 can install the current manifest, execute Vitest, typecheck and build successfully. The regenerated lockfile now contains a Vitest 4.1.11 importer entry and no longer contains the retired offline-AI direct dependencies.

The generated lockfile may resolve newer versions allowed by the existing semver ranges; this is a dependency-resolution consequence of regenerating a stale lockfile, not a deliberate application dependency upgrade. No new runtime dependency was introduced for offline AI.

## CI validation

`.github/workflows/ci-lint-test.yml` validates:

1. pnpm installation
2. dependency installation
3. frozen-lockfile reproducibility
4. ESLint
5. Vitest
6. TypeScript
7. production build

The Golden Hour branch is explicitly included in push validation so dependency changes on the feature branch are exercised directly. The workflow also synchronizes a generated lockfile on the feature branch rather than hiding lockfile drift.

A complete CI run on the current dependency state has already proven:

- dependency installation: PASS
- ESLint: PASS
- Vitest: PASS
- TypeScript: PASS
- production build: PASS

The validated emergency test suite passed all existing accident-state-machine tests.

## Validation caveat

The current direct runtime does not contain a mounted repository checkout, so local shell commands cannot be honestly claimed from this assistant environment. GitHub Actions is the authoritative repository execution surface used for validation. CI has already executed the actual project commands successfully against the feature branch.

## Privacy/security

Blood type, allergies, emergency contacts, location, motion data and Auth0 credentials are sensitive. Keep the canonical profile device-resident by default and never put sensitive emergency data into generic diagnostic logs. Emergency transmission should remain minimum-necessary.

## Documentation

Historical `.claude` material may describe the retired offline-AI architecture and is not authoritative. This file is the live engineering memory. Product/roadmap material should describe Golden Hour and the future online-AI boundary rather than offline model download/runtime capabilities.

## Maintenance rule

Update this file whenever durable architecture, dependency relationships, platform constraints, emergency-state behavior, AI removal, Auth0 behavior, privacy constraints or validation results materially change. Source code remains authoritative if any discrepancy appears.

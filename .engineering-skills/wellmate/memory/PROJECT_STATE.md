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
- Architecture: mobile-first, local-first, privacy-first, deferred server sync

## Routing and application shell

`src/App.tsx` uses `BrowserRouter`, lazy route loading, Auth0 route protection and onboarding gating. Authenticated routes include `/overview`, `/physical`, `/mental`, `/journal`, `/mental/coach`, `/habits`, `/tools`, `/profile`, `/chat`, `/sleep`, `/roadmap`, and `/pricing`.

The application shell no longer initializes an offline AI runtime at startup. Startup remains responsible for hydration, reliability lifecycle, analytics and notifications only.

## Onboarding and canonical profile ownership

`src/data/local/onboardingPayload.ts` owns the canonical local onboarding snapshot under localStorage key `onboarding_profile`; draft state is under `onboarding_draft`.

The profile now includes:

- blood type
- allergies
- typed emergency contacts

`src/pages/Onboarding.tsx` collects and validates these fields in step 8 before completing setup. The final profile writes numeric height/weight values, normalized allergies and trimmed contact details. `readOnboardingPayload()` validates the stored shape before returning it.

`src/hooks/useLocalProfile.ts` remains the single local-profile projection used by application code. Emergency escalation reads from this source rather than introducing a duplicate profile store.

`src/pages/Profile.tsx` now provides an editable Emergency Profile section that writes back to `onboarding_profile`.

## Golden Hour emergency architecture

The emergency system is now a first-class product path surfaced from the Physical Health route.

Core modules:

- `src/emergency/accidentStateMachine.ts`: deterministic state machine with configurable movement, suspicious-motion, abrupt-stop, inactivity and confirmation thresholds.
- `src/emergency/accidentStateMachine.test.ts`: deterministic transition coverage for normal movement/stops, GPS jitter, suspicious motion, sustained inactivity, confirmation, cancellation, timeout, unavailable sensors and duplicate/reopen protection.
- `src/emergency/sensorService.ts`: platform-neutral sensor contract and browser implementation for location, accelerometer and gyroscope-equivalent motion signals.
- `src/emergency/automaticTracking.ts`: promotes from low-frequency location monitoring to higher-frequency motion sensing when meaningful movement is detected.
- `src/emergency/trackingController.ts`: orchestrates automatic/manual tracking, confirmation timer, duplicate escalation protection and emergency delivery.
- `src/hooks/useEmergencyTracking.ts`: React binding for the tracking controller.
- `src/components/emergency/EmergencyTrackingPanel.tsx`: prominent tracking status, 15-second confirmation, `I'M OK`, `I NEED HELP NOW`, tracking stop and manual SOS controls.
- `src/emergency/emergencyEscalation.ts`: emergency event and explicit delivery status model.
- `src/emergency/platformCommunication.ts`: legitimate browser/Capacitor communication fallbacks.
- `src/emergency/hardwareEmergencyShortcut.ts`: explicit hardware shortcut capability boundary; currently reports unavailable rather than pretending to intercept the physical power button.

Automatic mode samples location around every 20 seconds while stable. Meaningful movement promotes to higher-frequency motion sensing. Accident detection requires multiple signals and temporal context rather than `speed === 0`.

Manual mode shows `TRACKING ACTIVE` and can be stopped by the user.

Possible accidents enter an approximately 15-second confirmation window. `I'M OK` cancels and restores tracking; `I NEED HELP NOW` escalates immediately; timeout escalates automatically. Sensor input is frozen while the confirmation window is active.

Duplicate escalation is guarded by state plus a 30-second controller-level deduplication window.

## Emergency notification semantics

Emergency information may include only the minimum needed context:

- event timestamp/reason
- best available current location
- blood type
- allergies
- configured emergency contacts

The delivery state machine distinguishes `PENDING`, `SUCCESS`, `PARTIAL_SUCCESS` and `FAILED`.

Browser/Capacitor SMS currently opens a system SMS composer and reports `PENDING`; it does not claim delivery. Emergency calls use an explicit user-driven `tel:` handoff and are not silently dialed by the normal web application.

## Sensor and platform constraints

- Browser geolocation and DeviceMotion are usable only while the relevant runtime permits them; background/OS-level guarantees are not assumed.
- High-accuracy location is filtered when accuracy exceeds 100m, and implausible derived speed above 90m/s is ignored.
- DeviceMotion permission handling supports iOS-style `requestPermission` when exposed by the runtime.
- No dedicated motion plugin was present in the original dependency graph, so application logic is behind an adapter rather than coupled to a nonexistent plugin.
- Android physical power-button presses are system-controlled; the app does not assume it can intercept a triple press.
- iOS hardware-button capture APIs are not a general-purpose power-button event stream for a normal third-party app. A future native shortcut can be implemented behind `HardwareEmergencyShortcut`; the current legitimate fallback is the prominent in-app SOS/assistance action.

## Auth0 flow and callback repair

Native authentication now handles both `appUrlOpen` callbacks and cold-start `CapApp.getLaunchUrl()` callbacks in `src/components/CapacitorAuthHandler.tsx`, prevents duplicate callback processing, delegates to `handleRedirectCallback()` and closes the browser.

`src/components/providers/auth.tsx` derives the native callback URI from `VITE_AUTH0_NATIVE_REDIRECT_URI` or the documented Auth0 Capacitor form:

`com.wellmate.app://<AUTH0_DOMAIN>/capacitor/com.wellmate.app/callback`

The web redirect can be controlled through `VITE_AUTH0_REDIRECT_URI` or the current origin. Auth0 refresh tokens remain enabled. Current implementation is designed to prevent the onboarding -> Auth0 -> authenticated app cold-start stall; actual tenant dashboard configuration remains external environment configuration and must match the generated callback URI.

## AI architecture after offline-AI removal

The offline/local inference graph is being removed entirely. The app no longer starts the offline runtime, the local provider is deleted, local model-download UI is deleted, and offline-only build configuration is removed.

`src/ai/service.ts` is now the application-facing future-online boundary:

`UI -> OnlineAIAdapter interface -> future provider/plugin`

No provider integration is invented. The default adapter is explicitly unconfigured and throws a clear configuration error rather than pretending to provide AI.

The existing Convex-backed mental-coach action remains separate server-side online infrastructure and is not part of the deleted offline runtime.

## Dependency cleanup

`package.json` no longer declares `@wllama/wllama` or `@xenova/transformers`. `vite.config.ts` no longer configures offline WASM assets.

`pnpm-lock.yaml` still requires a lockfile regeneration/update to remove those dependency graph entries. Because the runtime environment cannot reach GitHub directly and no repository checkout is available, lockfile generation has not yet been executed locally; this remains a blocking validation item.

## Validation and testing state

Deterministic emergency tests exist as `.test.ts`, but the repository does not currently have an installed test runner in its package manifest/lockfile. A temporary Vitest addition was intentionally reverted because adding it without regenerating the lockfile would create an inconsistent install state.

No local `pnpm build`, `pnpm lint` or test command has been executed in this environment. The direct container cannot reach GitHub (`DNS/network unavailable`), so final validation must use GitHub Actions if an applicable workflow exists, or remain explicitly unverified rather than being claimed as passed.

## Privacy and security

Blood type, allergies, emergency contacts, location, motion data and Auth0 credentials are sensitive. The local canonical profile remains device-resident by default. Emergency escalation should transmit only the minimum necessary emergency context. Sensitive data must not be placed in generic diagnostic logs.

## Documentation and technical debt

Historical `.claude` memory documents may still describe the retired offline AI runtime. They are historical and not authoritative for the transformed architecture; `.engineering-skills/wellmate/memory/PROJECT_STATE.md` is the live engineering memory.

Roadmap/product copy should be updated to the Golden Hour positioning and future online-AI boundary rather than advertising offline model download/runtime capabilities.

## Memory maintenance rule

Update this file whenever durable architecture, platform constraints, root causes, dependency relationships, emergency-state behavior, AI removal, Auth0 behavior, privacy constraints or validation state materially changes. Source code remains authoritative if any discrepancy appears.
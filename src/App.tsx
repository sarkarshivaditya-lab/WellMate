import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { Skeleton } from "@/components/ui/skeleton";

import AuthSyncBoundary from "./pages/auth/AuthSyncBoundary";
import CapacitorAuthHandler from "./components/CapacitorAuthHandler";
import { isCapacitorNative } from "./components/providers/auth";

// Route-level lazy loading — only the active route's code is parsed at startup.
// Onboarding and PhysicalDashboard are the two most-likely initial routes, so
// they get a short preload hint via webpackPrefetch (Vite respects this).
const WelcomePage = React.lazy(() => import("./pages/Welcome"));
const Onboarding = React.lazy(() => import("./pages/Onboarding"));
const TransitionGate = React.lazy(() => import("./pages/Transition"));
const PhysicalDashboard = React.lazy(() => import("./pages/physical/PhysicalDashboard"));
const Habits = React.lazy(() => import("./pages/Habits"));
const Index = React.lazy(() => import("./pages/Index"));
const Journal = React.lazy(() => import("./pages/mental/Journal"));
const MentalOverview = React.lazy(() => import("./pages/mental/Overview"));
const Tools = React.lazy(() => import("./pages/Tools"));
const AiMentalCoach = React.lazy(() => import("./pages/mental/AiMentalCoach"));
const Profile = React.lazy(() => import("./pages/Profile"));
const Chat = React.lazy(() => import("./pages/Chat"));
const Roadmap = React.lazy(() => import("./pages/Roadmap"));
const Sleep = React.lazy(() => import("./pages/Sleep"));
const Pricing = React.lazy(() => import("./pages/Pricing"));
const NotFound = React.lazy(() => import("./pages/NotFound"));

// Development-only routes — tree-shaken from production by import.meta.env.DEV
// These modules are never bundled when building for production (Vite dead-code elimination).
const DevPage = import.meta.env.DEV ? React.lazy(() => import("./pages/Dev")) : null;
const StateInspectorPage = import.meta.env.DEV ? React.lazy(() => import("./pages/StateInspector")) : null;

import AppShell from "./components/layout/AppShell";
import {
  init as initLifecycle,
  dispose as disposeLifecycle,
} from "./reliability/lifecycleCoordinator";
import { recoverAllInterruptedWrites } from "./reliability/transactionGuard";
import { startHydration, markHydrationReady } from "./reliability/hydration";
import { initAnalytics, disposeAnalytics } from "./analytics";
import { initNotifications, disposeNotifications } from "./notifications";
import {
  initAIRuntime,
  disposeAIRuntime,
} from "./ai/runtime/aiRuntime";
import { initAssistantBehaviorRuntime } from "./ai/assistant/assistantBehaviorRuntime";
import { bindProactiveCognitionToLifecycle, unbindProactiveCognition } from "./ai/cognition/proactiveCognitionLoop";
import { initMobileHardener } from "./ai/platform/mobileExecutionHardener";
import { initSelfHealingRuntime, disposeSelfHealingRuntime } from "./ai/runtime/selfHealingRuntime";
import { initAutoModelLifecycle } from "./ai/production/autoModelLifecycle";
import { scheduleConsolidation } from "./ai/memory/memoryConsolidationScheduler";

/* ======================================================
   LOADING SCREEN
   ====================================================== */

function AppLoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        WellMate
      </p>
      <div className="flex flex-col items-center gap-2 w-28">
        <Skeleton className="h-1.5 w-full" />
        <Skeleton className="h-1.5 w-2/3" />
      </div>
    </div>
  );
}

function AuthErrorScreen({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-5 px-8 text-center">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">WellMate</p>
      <p className="text-sm text-muted-foreground max-w-sm">
        We could not finish signing you in. Please try again.
      </p>
      <button
        className="rounded-xl bg-primary text-primary-foreground text-sm font-semibold px-6 py-3"
        onClick={onRetry}
      >
        Try again
      </button>
      <p className="text-[11px] text-muted-foreground/60 max-w-sm break-words">{error.message}</p>
    </div>
  );
}

/* ======================================================
   ROUTE HELPERS
   ====================================================== */

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, error, loginWithRedirect } = useAuth0();

  const loginStartedRef = React.useRef(false);

  React.useEffect(() => {
    if (isLoading || isAuthenticated || loginStartedRef.current) return;

    loginStartedRef.current = true;

    void loginWithRedirect({
      appState: {
        returnTo:
          window.location.pathname !== "/"
            ? window.location.pathname + window.location.search
            : "/",
      },
    }).catch((error) => {
      loginStartedRef.current = false;
      console.error("[Auth] loginWithRedirect failed", error);
    });
  }, [isLoading, isAuthenticated, loginWithRedirect]);

  if (isLoading) return <AppLoadingScreen />;
  if (error) {
    return (
      <AuthErrorScreen
        error={error}
        onRetry={() => {
          void loginWithRedirect({
            appState: {
              returnTo:
                window.location.pathname !== "/"
                  ? window.location.pathname + window.location.search
                  : "/",
            },
          }).catch((retryError) => {
            console.error("[Auth] retry failed", retryError);
          });
        }}
      />
    );
  }
  if (!isAuthenticated) return <AppLoadingScreen />;

  return <>{children}</>;
}

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const onboardingComplete = localStorage.getItem("onboarded") === "true";
  if (!onboardingComplete) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

const WELCOME_SEEN_KEY = "wellmate_welcome_v1";

function RootEntry() {
  const { isAuthenticated, isLoading, error, loginWithRedirect } = useAuth0();

  if (isLoading) return <AppLoadingScreen />;
  if (error) {
    return (
      <AuthErrorScreen
        error={error}
        onRetry={() => {
          void loginWithRedirect({
            appState: { returnTo: "/" },
          }).catch((retryError) => console.error("[Auth] retry failed", retryError));
        }}
      />
    );
  }

  const isOnboarded = localStorage.getItem("onboarded") === "true";
  const hasSeenWelcome = !!localStorage.getItem(WELCOME_SEEN_KEY);

  if (!isAuthenticated) {
    // Existing onboarded users return to their protected destination.
    if (isOnboarded) return <Navigate to="/physical" replace />;
    // First-time users see the welcome experience before onboarding.
    if (!hasSeenWelcome) return <Navigate to="/welcome" replace />;
    return <Navigate to="/onboarding" replace />;
  }

  // Authenticated — but new users who haven't seen welcome should still see it.
  if (!isOnboarded && !hasSeenWelcome) return <Navigate to="/welcome" replace />;
  return <Navigate to="/physical" replace />;
}


function AuthCallbackBridge() {
  const { isLoading, isAuthenticated, error, loginWithRedirect } = useAuth0();

  if (isLoading) return <AppLoadingScreen />;

  if (error) {
    return (
      <AuthErrorScreen
        error={error}
        onRetry={() => {
          void loginWithRedirect({ appState: { returnTo: "/" } }).catch((retryError) =>
            console.error("[Auth] callback retry failed", retryError),
          );
        }}
      />
    );
  }

  if (isAuthenticated) return <Navigate to="/" replace />;

  return <AppLoadingScreen />;
}

/* ======================================================
   APP STARTUP — lifecycle init + interrupted write recovery
   ====================================================== */

function useAppStartup() {
  React.useEffect(() => {
    // Recover any writes interrupted by prior tab crash / kill
    recoverAllInterruptedWrites();

    // Start hydration state machine
    startHydration();

    // Initialize lifecycle coordinator (visibility, connectivity, memory pressure)
    initLifecycle();

    // Mark hydration ready — stores are synchronously available from localStorage
    markHydrationReady();

    // Initialize privacy-first analytics (must come after lifecycle init)
    initAnalytics();

    // Initialize calm notification system (must come after analytics init)
    initNotifications();

    // Initialize AI runtime — post-hydration, non-blocking, failure-tolerant.
    // Uses Promise.resolve() scheduling so it never runs before the first paint.
    void Promise.resolve().then(async () => {
      await initAIRuntime();
      // Phase 20: unified AI convergence — all inits are idempotent
      initMobileHardener();
      initAssistantBehaviorRuntime();
      bindProactiveCognitionToLifecycle();
      initSelfHealingRuntime();
      initAutoModelLifecycle();
      scheduleConsolidation();
    });

    return () => {
      disposeLifecycle();
      disposeAnalytics();
      disposeNotifications();
      void disposeAIRuntime();
      unbindProactiveCognition();
      disposeSelfHealingRuntime();
    };
  }, []);
}

/* ======================================================
   GLOBAL RUNTIME SAFETY (NON-VISUAL)
   ====================================================== */

function useGlobalRuntimeGuards() {
  React.useEffect(() => {
    const onError = (event: ErrorEvent) => {
      console.error("Global runtime error:", {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("Unhandled promise rejection:", event.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);
}

/* ======================================================
   APP
   ====================================================== */

export default function App() {
  useAppStartup();
  useGlobalRuntimeGuards();

  return (
      <AuthSyncBoundary />
      <CapacitorAuthHandler />

      <React.Suspense fallback={<AppLoadingScreen />}>
      <Routes>
        <Route path="/" element={<RootEntry />} />
        <Route path="/callback" element={<AuthCallbackBridge />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/onboarding" element={<Onboarding />} />

        <Route
          path="/overview"
          element={
            <RequireAuth>
              <RequireOnboarding>
                <AppShell>
                  <Index />
                </AppShell>
              </RequireOnboarding>
            </RequireAuth>
          }
        />

        <Route
          path="/physical"
          element={
            <RequireAuth>
              <RequireOnboarding>
                <AppShell>
                  <TransitionGate>
                    <PhysicalDashboard />
                  </TransitionGate>
                </AppShell>
              </RequireOnboarding>
            </RequireAuth>
          }
        />

        {/* /mental — the mental wellness hub (tabs: Overview, Journal, Tools) */}
        <Route
          path="/mental"
          element={
            <RequireAuth>
              <RequireOnboarding>
                <AppShell>
                  <MentalOverview />
                </AppShell>
              </RequireOnboarding>
            </RequireAuth>
          }
        />

        {/* /journal — legacy route, kept for backwards compat */}
        <Route
          path="/journal"
          element={
            <RequireAuth>
              <RequireOnboarding>
                <AppShell>
                  <Journal />
                </AppShell>
              </RequireOnboarding>
            </RequireAuth>
          }
        />

        <Route
          path="/mental/coach"
          element={
            <RequireAuth>
              <RequireOnboarding>
                <AppShell>
                  <AiMentalCoach />
                </AppShell>
              </RequireOnboarding>
            </RequireAuth>
          }
        />

        <Route
          path="/habits"
          element={
            <RequireAuth>
              <RequireOnboarding>
                <AppShell>
                  <Habits />
                </AppShell>
              </RequireOnboarding>
            </RequireAuth>
          }
        />

        <Route
          path="/tools"
          element={
            <RequireAuth>
              <RequireOnboarding>
                <AppShell>
                  <Tools />
                </AppShell>
              </RequireOnboarding>
            </RequireAuth>
          }
        />

        <Route
          path="/profile"
          element={
            <RequireAuth>
              <RequireOnboarding>
                <AppShell>
                  <Profile />
                </AppShell>
              </RequireOnboarding>
            </RequireAuth>
          }
        />

        <Route
          path="/chat"
          element={
            <RequireAuth>
              <RequireOnboarding>
                <AppShell>
                  <Chat />
                </AppShell>
              </RequireOnboarding>
            </RequireAuth>
          }
        />

        <Route
          path="/sleep"
          element={
            <RequireAuth>
              <RequireOnboarding>
                <AppShell>
                  <Sleep />
                </AppShell>
              </RequireOnboarding>
            </RequireAuth>
          }
        />

        <Route
          path="/roadmap"
          element={
            <RequireAuth>
              <RequireOnboarding>
                <AppShell>
                  <Roadmap />
                </AppShell>
              </RequireOnboarding>
            </RequireAuth>
          }
        />

        <Route
          path="/pricing"
          element={
            <RequireAuth>
              <RequireOnboarding>
                <AppShell>
                  <Pricing />
                </AppShell>
              </RequireOnboarding>
            </RequireAuth>
          }
        />

        {/* Development-only routes — excluded from production builds */}
        {import.meta.env.DEV && DevPage && (
          <Route path="/dev" element={<DevPage />} />
        )}
        {import.meta.env.DEV && StateInspectorPage && (
          <Route path="/dev/state" element={<StateInspectorPage />} />
        )}

        <Route path="*" element={<NotFound />} />
      </Routes>
      </React.Suspense>
  );
}

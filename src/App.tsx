import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Browser } from "@capacitor/browser";

import AuthSyncBoundary from "./pages/auth/AuthSyncBoundary";
import CapacitorAuthHandler from "./components/CapacitorAuthHandler";
import { isCapacitorNative } from "./components/providers/auth";

// Route-level lazy loading — only the active route's code is parsed at startup.
// Onboarding and PhysicalDashboard are the two most-likely initial routes, so
// they get a short preload hint via webpackPrefetch (Vite respects this).
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
const Roadmap = React.lazy(() => import("./pages/Roadmap"));
const Sleep = React.lazy(() => import("./pages/Sleep"));
const Pricing = React.lazy(() => import("./pages/Pricing"));
const NotFound = React.lazy(() => import("./pages/NotFound"));

import AppShell from "./components/layout/AppShell";
import {
  init as initLifecycle,
  dispose as disposeLifecycle,
} from "./reliability/lifecycleCoordinator";
import { recoverAllInterruptedWrites } from "./reliability/transactionGuard";
import { startHydration, markHydrationReady } from "./reliability/hydration";
import { initAnalytics, disposeAnalytics } from "./analytics";
import { initNotifications, disposeNotifications } from "./notifications";

/* ======================================================
   LOADING SCREEN — with timeout guard
   Never stays loading forever: after AUTH_TIMEOUT_MS with no
   resolution it shows a recovery button so the user isn't frozen.
   ====================================================== */

const AUTH_TIMEOUT_MS = 8000;

function AppLoadingScreen({ onTimeout }: { onTimeout?: () => void } = {}) {
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    if (!onTimeout) return;
    const t = setTimeout(() => {
      setTimedOut(true);
      onTimeout();
    }, AUTH_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [onTimeout]);

  if (timedOut) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-8 text-center">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          WellMate
        </p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Taking longer than expected. Check your connection or continue offline.
        </p>
        <button
          className="rounded-xl bg-primary text-primary-foreground text-sm font-semibold px-6 py-3"
          onClick={() => window.location.replace("/onboarding")}
        >
          Continue offline
        </button>
      </div>
    );
  }

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

/* ======================================================
   ROUTE HELPERS
   ====================================================== */

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      if (isCapacitorNative) {
        // On Capacitor, open Auth0 in the system browser so the OS can intercept
        // the com.wellmate.app:// callback and route it back to the app.
        // CapacitorAuthHandler listens for appUrlOpen and completes the exchange.
        loginWithRedirect({
          openUrl: (url) => Browser.open({ url, presentationStyle: "popover" }),
        }).catch(() => {});
      } else {
        loginWithRedirect().catch(() => {});
      }
    }
  }, [isLoading, isAuthenticated, loginWithRedirect]);

  const handleTimeout = React.useCallback(() => setTimedOut(true), []);

  if (timedOut) return <Navigate to="/onboarding" replace />;
  if (isLoading || !isAuthenticated) {
    return <AppLoadingScreen onTimeout={handleTimeout} />;
  }

  return <>{children}</>;
}

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const onboardingComplete = localStorage.getItem("onboarded") === "true";
  if (!onboardingComplete) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

function RootEntry() {
  const { isAuthenticated, isLoading } = useAuth0();
  const [timedOut, setTimedOut] = React.useState(false);
  const handleTimeout = React.useCallback(() => setTimedOut(true), []);

  if (isLoading && !timedOut) {
    return <AppLoadingScreen onTimeout={handleTimeout} />;
  }

  if (!isAuthenticated) {
    // Auth is slow or timed out. If the user already completed onboarding
    // in a prior session, send them to /physical — RequireAuth there will
    // re-prompt login if the session is genuinely expired. This prevents
    // an auth-timeout race from silently resetting a completed onboarding.
    if (localStorage.getItem("onboarded") === "true") {
      return <Navigate to="/physical" replace />;
    }
    return <Navigate to="/onboarding" replace />;
  }

  return <Navigate to="/physical" replace />;
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

    return () => {
      disposeLifecycle();
      disposeAnalytics();
      disposeNotifications();
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
    <BrowserRouter>
      <AuthSyncBoundary />
      <CapacitorAuthHandler />

      <React.Suspense fallback={<AppLoadingScreen />}>
      <Routes>
        <Route path="/" element={<RootEntry />} />
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

        <Route path="*" element={<NotFound />} />
      </Routes>
      </React.Suspense>
    </BrowserRouter>
  );
}

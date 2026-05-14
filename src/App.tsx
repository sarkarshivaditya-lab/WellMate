import React from "react";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Browser } from "@capacitor/browser";

import AuthSyncBoundary from "./pages/auth/AuthSyncBoundary";
import CapacitorAuthHandler from "./components/CapacitorAuthHandler";
import { isCapacitorNative } from "./components/providers/auth";

import Onboarding from "./pages/Onboarding";
import TransitionGate from "./pages/Transition";
import PhysicalDashboard from "./pages/physical/PhysicalDashboard";
import Habits from "./pages/Habits";
import Index from "./pages/Index";
import Journal from "./pages/mental/Journal";
import MentalOverview from "./pages/mental/Overview";
import Tools from "./pages/Tools";
import AiMentalCoach from "./pages/mental/AiMentalCoach";
import Profile from "./pages/Profile";
import Roadmap from "./pages/Roadmap";
import Sleep from "./pages/Sleep";

import AppShell from "./components/layout/AppShell";

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
  useGlobalRuntimeGuards();

  return (
    <BrowserRouter>
      <AuthSyncBoundary />
      <CapacitorAuthHandler />

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
          path="*"
          element={
            <div className="min-h-screen bg-background text-foreground p-8">
              <h1 className="text-2xl font-bold">Not Found</h1>
              <p className="mt-2">
                Nothing here — <Link to="/">Go home</Link>
              </p>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

import React from "react";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { Skeleton } from "@/components/ui/skeleton";

import AuthSyncBoundary from "./pages/auth/AuthSyncBoundary";

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

import AppShell from "./components/layout/AppShell";

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

/* ======================================================
   ROUTE HELPERS
   ====================================================== */

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      loginWithRedirect();
    }
  }, [isLoading, isAuthenticated, loginWithRedirect]);

  if (isLoading || !isAuthenticated) {
    return <AppLoadingScreen />;
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

  if (isLoading) {
    return <AppLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <AppLoadingScreen />;
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

import React from "react";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";

// import AuthSyncBoundary from "./pages/auth/AuthSyncBoundary";

import Onboarding from "./pages/Onboarding";
import TransitionGate from "./pages/Transition";
import PhysicalDashboard from "./pages/physical/PhysicalDashboard";
import Habits from "./pages/Habits";
import Index from "./pages/Index";
import Journal from "./pages/mental/Journal";
import Tools from "./pages/Tools";
import AiMentalCoach from "./pages/mental/AiMentalCoach";
import Profile from "./pages/Profile";

import AppShell from "./components/layout/AppShell";

/* ======================================================
   ROUTE HELPERS
   ====================================================== */

function RootRedirect() {
  return <Navigate to="/physical" replace />;
}

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const onboardingComplete = localStorage.getItem("onboarded") === "true";
  if (!onboardingComplete) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
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
      {/* AuthSyncBoundary intentionally disabled until sign-in is wired */}
      {/* <AuthSyncBoundary /> */}

      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/onboarding" element={<Onboarding />} />

        <Route
          path="/overview"
          element={
            <RequireOnboarding>
              <AppShell>
                <Index />
              </AppShell>
            </RequireOnboarding>
          }
        />

        <Route
          path="/physical"
          element={
            <RequireOnboarding>
              <AppShell>
                <TransitionGate>
                  <PhysicalDashboard />
                </TransitionGate>
              </AppShell>
            </RequireOnboarding>
          }
        />

        <Route
          path="/journal"
          element={
            <RequireOnboarding>
              <AppShell>
                <Journal />
              </AppShell>
            </RequireOnboarding>
          }
        />

        <Route
          path="/mental/coach"
          element={
            <RequireOnboarding>
              <AppShell>
                <AiMentalCoach />
              </AppShell>
            </RequireOnboarding>
          }
        />

        <Route
          path="/habits"
          element={
            <RequireOnboarding>
              <AppShell>
                <Habits />
              </AppShell>
            </RequireOnboarding>
          }
        />

        <Route
          path="/tools"
          element={
            <RequireOnboarding>
              <AppShell>
                <Tools />
              </AppShell>
            </RequireOnboarding>
          }
        />

        {/* NEW: Profile / Settings */}
        <Route
          path="/profile"
          element={
            <RequireOnboarding>
              <AppShell>
                <Profile />
              </AppShell>
            </RequireOnboarding>
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

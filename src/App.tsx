import React from "react";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import { Authenticated, AuthLoading } from "convex/react";
import { useAuth0 } from "@auth0/auth0-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

import Onboarding from "./pages/Onboarding";
import TransitionGate from "./pages/Transition";
import PhysicalDashboard from "./pages/physical/PhysicalDashboard";
import Habits from "./pages/Habits";
import Index from "./pages/Index";
import Journal from "./pages/mental/Journal";
import Tools from "./pages/Tools";
import AiMentalCoach from "./pages/mental/AiMentalCoach"; // ✅ NEW

import AppShell from "./components/layout/AppShell";

/* ======================================================
   ENSURE USER RECORD EXISTS (CRITICAL)
   ====================================================== */

function EnsureUserRecord({ children }: { children: React.ReactNode }) {
  const updateCurrentUser = useMutation(api.users.updateCurrentUser);

  React.useEffect(() => {
    updateCurrentUser().catch(console.error);
  }, [updateCurrentUser]);

  return <>{children}</>;
}

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
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  useGlobalRuntimeGuards();

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      loginWithRedirect();
    }
  }, [isLoading, isAuthenticated, loginWithRedirect]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Redirecting to login…
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          Loading…
        </div>
      </AuthLoading>

      <Authenticated>
        <EnsureUserRecord>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/onboarding" element={<Onboarding />} />

            {/* ---------------- AppShell routes ---------------- */}

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

            {/* ✅ Mental AI Coach route */}
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

            {/* ---------------- Fallback ---------------- */}

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
        </EnsureUserRecord>
      </Authenticated>
    </BrowserRouter>
  );
}

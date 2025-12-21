import React from "react";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import Onboarding from "./pages/Onboarding";

/**
 * Root redirect:
 * - If onboarding is complete → go to app
 * - Otherwise → go to onboarding
 */
function RootRedirect() {
  const onboardingComplete = localStorage.getItem("onboarded") === "true";

  return onboardingComplete ? (
    <Navigate to="/physical" replace />
  ) : (
    <Navigate to="/onboarding" replace />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root gate */}
        <Route path="/" element={<RootRedirect />} />

        {/* Onboarding */}
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Actual app shell (finally) */}
        <Route
          path="/physical"
          element={
            <div className="min-h-screen bg-background text-foreground p-8">
              <h1 className="text-3xl font-bold">WellMate App</h1>
              <p className="mt-4">
                🎉 You are now past onboarding. This is the real app.
              </p>

              <p className="mt-6">
                <button
                  onClick={() => {
                    localStorage.removeItem("onboarded");
                    window.location.href = "/";
                  }}
                  className="underline"
                >
                  Reset onboarding (dev)
                </button>
              </p>
            </div>
          }
        />

        {/* Catch-all */}
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

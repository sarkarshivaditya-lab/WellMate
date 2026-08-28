import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Browser } from "@capacitor/browser";

import CapacitorAuthHandler from "./components/CapacitorAuthHandler";
import { isCapacitorNative, CAPACITOR_CALLBACK_URI } from "./components/providers/auth";

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
const DevPage = import.meta.env.DEV ? React.lazy(() => import("./pages/Dev")) : null;
const StateInspectorPage = import.meta.env.DEV ? React.lazy(() => import("./pages/StateInspector")) : null;

import AppShell from "./components/layout/AppShell";
import { init as initLifecycle, dispose as disposeLifecycle } from "./reliability/lifecycleCoordinator";
import { recoverAllInterruptedWrites } from "./reliability/transactionGuard";
import { startHydration, markHydrationReady } from "./reliability/hydration";
import { initAnalytics, disposeAnalytics } from "./analytics";
import { initNotifications, disposeNotifications } from "./notifications";

const AUTH_TIMEOUT_MS = 8000;

function AppLoadingScreen({ onTimeout }: { onTimeout?: () => void } = {}) {
  const [timedOut, setTimedOut] = React.useState(false);
  React.useEffect(() => {
    if (!onTimeout) return;
    const t = setTimeout(() => { setTimedOut(true); onTimeout(); }, AUTH_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [onTimeout]);
  if (timedOut) return <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-8 text-center"><p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">WellMate</p><p className="text-sm text-muted-foreground max-w-xs">Taking longer than expected. Check your connection or continue offline.</p><button className="rounded-xl bg-primary text-primary-foreground text-sm font-semibold px-6 py-3" onClick={() => window.location.replace("/onboarding")}>Continue offline</button></div>;
  return <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6"><p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">WellMate</p><div className="flex flex-col items-center gap-2 w-28"><Skeleton className="h-1.5 w-full" /><Skeleton className="h-1.5 w-2/3" /></div></div>;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, error: authError, loginWithRedirect } = useAuth0();

  const handleLogin = React.useCallback(async () => {
    try {
      await loginWithRedirect(
        isCapacitorNative
          ? {
              authorizationParams: {
                redirect_uri: CAPACITOR_CALLBACK_URI,
              },
              openUrl: (url: string) => Browser.open({ url, windowName: "_self" }),
            }
          : undefined,
      );
    } catch (error) {
      console.error("[WellMate Auth] loginWithRedirect failed:", error);
    }
  }, [loginWithRedirect]);

  if (authError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">WellMate</p>
        <p className="text-sm font-medium text-foreground">Sign-in could not be completed.</p>
        <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{authError.message}</p>
        <button
          className="rounded-xl bg-primary text-primary-foreground text-sm font-semibold px-6 py-3"
          onClick={() => void handleLogin()}
        >
          Try sign in again
        </button>
      </div>
    );
  }

  if (isLoading) return <AppLoadingScreen />;

  if (!isAuthenticated) {
    return (
      <AppLoadingScreen
        onTimeout={() => {
          void handleLogin();
        }}
      />
    );
  }

  return <>{children}</>;
}

export default function App() {
  const [authBridgeReady, setAuthBridgeReady] = React.useState(!isCapacitorNative);
  const handleAuthBridgeReady = React.useCallback(() => setAuthBridgeReady(true), []);

  React.useEffect(() => {
    void recoverAllInterruptedWrites();
    initLifecycle();
    initAnalytics();
    initNotifications();
    return () => {
      disposeLifecycle();
      disposeAnalytics();
      disposeNotifications();
    };
  }, []);

  React.useEffect(() => {
    startHydration();
    markHydrationReady();
  }, []);

  return (
    <>
      <CapacitorAuthHandler onReady={handleAuthBridgeReady} />
      <BrowserRouter>
        <React.Suspense fallback={<AppLoadingScreen />}>
          <Routes>
            <Route path="/" element={<WelcomePage />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/transition" element={<TransitionGate><Navigate to="/physical" replace /></TransitionGate>} />
            <Route element={<RequireAuth authBridgeReady={authBridgeReady}><AppShell><Outlet /></AppShell></RequireAuth>}>
              <Route path="/physical" element={<PhysicalDashboard />} />
              <Route path="/mental" element={<MentalOverview />} />
              <Route path="/mental/journal" element={<Journal />} />
              <Route path="/mental/coach" element={<AiMentalCoach />} />
              <Route path="/habits" element={<Habits />} />
              <Route path="/tools" element={<Tools />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/roadmap" element={<Roadmap />} />
              <Route path="/sleep" element={<Sleep />} />
              <Route path="/pricing" element={<Pricing />} />
              {DevPage && <Route path="/dev" element={<DevPage />} />}
              {StateInspectorPage && <Route path="/state-inspector" element={<StateInspectorPage />} />}
              <Route path="/" element={<Index />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </React.Suspense>
      </BrowserRouter>
    </>
  );
}

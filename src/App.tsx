import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Browser } from "@capacitor/browser";

import AuthSyncBoundary from "./pages/auth/AuthSyncBoundary";
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
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  const [timedOut, setTimedOut] = React.useState(false);

  React.useEffect(() => {
    if (isLoading || isAuthenticated) return;
    const options = isCapacitorNative
      ? {
          authorizationParams: { redirect_uri: CAPACITOR_CALLBACK_URI, prompt: "login" },
          openUrl: (url: string) => Browser.open({ url }),
        }
      : { authorizationParams: { prompt: "login" } };
    loginWithRedirect(options).catch((error) => console.error("[WellMate Auth] loginWithRedirect failed:", error));
  }, [isLoading, isAuthenticated, loginWithRedirect]);

  const handleTimeout = React.useCallback(() => setTimedOut(true), []);
  if (timedOut) return <Navigate to="/onboarding" replace />;
  if (isLoading || !isAuthenticated) return <AppLoadingScreen onTimeout={handleTimeout} />;
  return <>{children}</>;
}

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  return localStorage.getItem("onboarded") === "true" ? <>{children}</> : <Navigate to="/onboarding" replace />;
}

const WELCOME_SEEN_KEY = "wellmate_welcome_v1";
function RootEntry() {
  const { isAuthenticated, isLoading } = useAuth0();
  const [timedOut, setTimedOut] = React.useState(false);
  const handleTimeout = React.useCallback(() => setTimedOut(true), []);
  if (isLoading && !timedOut) return <AppLoadingScreen onTimeout={handleTimeout} />;
  const isOnboarded = localStorage.getItem("onboarded") === "true";
  const hasSeenWelcome = !!localStorage.getItem(WELCOME_SEEN_KEY);
  if (!isAuthenticated) {
    if (isOnboarded) return <Navigate to="/physical" replace />;
    if (!hasSeenWelcome) return <Navigate to="/welcome" replace />;
    return <Navigate to="/onboarding" replace />;
  }
  if (!isOnboarded && !hasSeenWelcome) return <Navigate to="/welcome" replace />;
  return <Navigate to="/physical" replace />;
}

function useAppStartup() {
  React.useEffect(() => {
    recoverAllInterruptedWrites(); startHydration(); initLifecycle(); markHydrationReady(); initAnalytics(); initNotifications();
    return () => { disposeLifecycle(); disposeAnalytics(); disposeNotifications(); };
  }, []);
}

function useGlobalRuntimeGuards() {
  React.useEffect(() => {
    const onError = (event: ErrorEvent) => console.error("Global runtime error:", event.error ?? event.message);
    const onUnhandledRejection = (event: PromiseRejectionEvent) => console.error("Unhandled promise rejection:", event.reason);
    window.addEventListener("error", onError); window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onUnhandledRejection); };
  }, []);
}

export default function App() {
  useAppStartup(); useGlobalRuntimeGuards();
  return <BrowserRouter><AuthSyncBoundary /><CapacitorAuthHandler /><React.Suspense fallback={<AppLoadingScreen />}><Routes>
    <Route path="/" element={<RootEntry />} /><Route path="/welcome" element={<WelcomePage />} /><Route path="/onboarding" element={<Onboarding />} />
    <Route path="/overview" element={<RequireAuth><RequireOnboarding><AppShell><Index /></AppShell></RequireOnboarding></RequireAuth>} />
    <Route path="/physical" element={<RequireAuth><RequireOnboarding><AppShell><TransitionGate><PhysicalDashboard /></TransitionGate></AppShell></RequireOnboarding></RequireAuth>} />
    <Route path="/mental" element={<RequireAuth><RequireOnboarding><AppShell><MentalOverview /></AppShell></RequireOnboarding></RequireAuth>} />
    <Route path="/journal" element={<RequireAuth><RequireOnboarding><AppShell><Journal /></AppShell></RequireOnboarding></RequireAuth>} />
    <Route path="/mental/coach" element={<RequireAuth><RequireOnboarding><AppShell><AiMentalCoach /></AppShell></RequireOnboarding></RequireAuth>} />
    <Route path="/habits" element={<RequireAuth><RequireOnboarding><AppShell><Habits /></AppShell></RequireOnboarding></RequireAuth>} />
    <Route path="/tools" element={<RequireAuth><RequireOnboarding><AppShell><Tools /></AppShell></RequireOnboarding></RequireAuth>} />
    <Route path="/profile" element={<RequireAuth><RequireOnboarding><AppShell><Profile /></AppShell></RequireOnboarding></RequireAuth>} />
    <Route path="/chat" element={<RequireAuth><RequireOnboarding><AppShell><Chat /></AppShell></RequireOnboarding></RequireAuth>} />
    <Route path="/sleep" element={<RequireAuth><RequireOnboarding><AppShell><Sleep /></AppShell></RequireOnboarding></RequireAuth>} />
    <Route path="/roadmap" element={<RequireAuth><RequireOnboarding><AppShell><Roadmap /></AppShell></RequireOnboarding></RequireAuth>} />
    <Route path="/pricing" element={<RequireAuth><RequireOnboarding><AppShell><Pricing /></AppShell></RequireOnboarding></RequireAuth>} />
    {import.meta.env.DEV && DevPage && <Route path="/dev" element={<DevPage />} />}{import.meta.env.DEV && StateInspectorPage && <Route path="/dev/state" element={<StateInspectorPage />} />}
    <Route path="*" element={<NotFound />} />
  </Routes></React.Suspense></BrowserRouter>;
}

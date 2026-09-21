import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { AUTH0_CLIENT_CACHE_PREFIX, clearAuth0AppCache } from "./auth/auth0Recovery";
import { Skeleton } from "@/components/ui/skeleton";
import AuthSyncBoundary from "./pages/auth/AuthSyncBoundary";
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

import AppShell from "./components/layout/AppShell";
import { init as initLifecycle, dispose as disposeLifecycle } from "./reliability/lifecycleCoordinator";
import { recoverAllInterruptedWrites } from "./reliability/transactionGuard";
import { startHydration, markHydrationReady } from "./reliability/hydration";
import { initAnalytics, disposeAnalytics } from "./analytics";
import { initNotifications, disposeNotifications } from "./notifications";

function AppLoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">WellMate</p>
      <div className="flex flex-col items-center gap-2 w-28">
        <Skeleton className="h-1.5 w-full" />
        <Skeleton className="h-1.5 w-2/3" />
      </div>
    </div>
  );
}

function RootRoute() {
  const params = new URLSearchParams(window.location.search);
  const isAuthCallback =
    params.has("code") || params.has("state") || params.has("error");

  if (isAuthCallback) return <AppLoadingScreen />;

  const welcomeSeen = localStorage.getItem("wellmate_welcome_v1") === "1";
  return welcomeSeen ? <Navigate to="/physical" replace /> : <WelcomePage />;
}

function SignInScreen({ onSignIn, error }: { onSignIn: () => void; error?: string }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-5 px-8 text-center">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">WellMate</p>
      <p className="text-sm font-medium text-foreground">Sign in to continue</p>
      {error ? <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{error}</p> : null}
      <button
        className="rounded-xl bg-primary text-primary-foreground text-sm font-semibold px-6 py-3"
        onClick={onSignIn}
      >
        {error ? "Try sign in again" : "Sign in"}
      </button>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, error: authError, loginWithRedirect } = useAuth0();
  const location = useLocation();
  const loginInFlight = React.useRef(false);
  const [authRecoveryAttempted, setAuthRecoveryAttempted] = React.useState(false);
  const [authRecoveryReloading, setAuthRecoveryReloading] = React.useState(false);
  const [authStartupTimedOut, setAuthStartupTimedOut] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading || authRecoveryAttempted) return;

    const timer = window.setTimeout(() => {
      try {
        const hasAuth0Cache = Object.keys(localStorage).some((key) =>
          key.startsWith(AUTH0_CLIENT_CACHE_PREFIX),
        );

        if (hasAuth0Cache) {
          clearAuth0AppCache();
          setAuthRecoveryReloading(true);
          window.location.reload();
          return;
        }
        setAuthStartupTimedOut(true);
      } finally {
        setAuthRecoveryAttempted(true);
      }
    }, 10000);

    return () => window.clearTimeout(timer);
  }, [isLoading, authRecoveryAttempted]);

  const handleLogin = React.useCallback(async () => {
    if (loginInFlight.current) return;
    loginInFlight.current = true;

    try {
      await loginWithRedirect(
        isCapacitorNative
          ? {
              appState: { returnTo: `${location.pathname}${location.search}${location.hash}` },
              authorizationParams: {
                redirect_uri: CAPACITOR_CALLBACK_URI,
                prompt: "login" as const,
              },
              openUrl: (url: string) => Browser.open({ url, windowName: "_self" }),
            }
          : {
              appState: { returnTo: `${location.pathname}${location.search}${location.hash}` },
              authorizationParams: { prompt: "login" as const },
            },
      );
    } catch (error) {
      console.error("[WellMate Auth] loginWithRedirect failed:", error);
      loginInFlight.current = false;
    }
  }, [location.hash, location.pathname, location.search, loginWithRedirect]);

  if (isLoading || authRecoveryReloading) {
    if (authStartupTimedOut) {
      return <SignInScreen onSignIn={() => void handleLogin()} error="Authentication is taking longer than expected. Please sign in again." />;
    }
    return <AppLoadingScreen />;
  }
  if (isAuthenticated) {
    return (
      <AuthSyncBoundary>
        {children}
      </AuthSyncBoundary>
    );
  }

  return <SignInScreen onSignIn={() => void handleLogin()} error={authError?.message} />;
}

function OnboardingRoute() {
  React.useEffect(() => {
    if (localStorage.getItem("onboarded") !== "true") return;

    const rawProfile = localStorage.getItem("onboarding_profile");
    try {
      const profile = rawProfile ? (JSON.parse(rawProfile) as { completedAt?: unknown }) : null;
      if (typeof profile?.completedAt === "number") return;
    } catch {
      // Treat malformed onboarding state as incomplete.
    }

    if (rawProfile) return;

    localStorage.removeItem("onboarded");
  }, []);

  return <Onboarding />;
}

export default function App() {
  const [nativeAuthCallbackError, setNativeAuthCallbackError] = React.useState<string | null>(null);

  const handleNativeAuthCallbackError = React.useCallback((error: unknown) => {
    setNativeAuthCallbackError(error instanceof Error ? error.message : String(error));
  }, []);

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
      <CapacitorAuthHandler onError={handleNativeAuthCallbackError} />
      {nativeAuthCallbackError ? (
        <div className="fixed inset-x-4 top-4 z-[100] rounded-2xl border border-destructive/20 bg-background/95 p-4 shadow-lg backdrop-blur">
          <p className="text-sm font-semibold text-foreground">Sign-in callback failed</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{nativeAuthCallbackError}</p>
          <button className="mt-3 text-xs font-semibold text-primary" onClick={() => setNativeAuthCallbackError(null)}>Dismiss</button>
        </div>
      ) : null}
      <BrowserRouter>
        <React.Suspense fallback={<AppLoadingScreen />}>
          <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route path="/onboarding" element={<OnboardingRoute />} />
            <Route path="/transition" element={<TransitionGate><Navigate to="/physical" replace /></TransitionGate>} />
            <Route element={<RequireAuth><AppShell><Outlet /></AppShell></RequireAuth>}>
              <Route path="/overview" element={<Index />} />
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
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </React.Suspense>
      </BrowserRouter>
    </>
  );
}

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { Skeleton } from "@/components/ui/skeleton";
import AuthSyncBoundary from "./pages/auth/AuthSyncBoundary";
import CapacitorAuthHandler from "./components/CapacitorAuthHandler";
import { isCapacitorNative } from "./components/providers/auth";

// Route-level lazy loading — only the active route's code is parsed at startup.
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
const Sleep = React.lazy(() => import("./pages/Sleep"));
const Roadmap = React.lazy(() => import("./pages/Roadmap"));
const Pricing = React.lazy(() => import("./pages/Pricing"));

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

function AuthErrorScreen({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-5 px-8 text-center">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">WellMate</p>
      <p className="text-sm text-muted-foreground max-w-sm">We could not finish signing you in. Please try again.</p>
      <button className="rounded-xl bg-primary text-primary-foreground text-sm font-semibold px-6 py-3" onClick={onRetry}>
        Try again
      </button>
      <p className="text-[11px] text-muted-foreground/60 max-w-sm break-words">{error.message}</p>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, error, loginWithRedirect } = useAuth0();
  const loginStartedRef = React.useRef(false);

  React.useEffect(() => {
    if (isLoading || isAuthenticated || loginStartedRef.current) return;
    loginStartedRef.current = true;

    void loginWithRedirect({
      appState: {
        returnTo: window.location.pathname !== "/" ? window.location.pathname + window.location.search : "/",
      },
      ...(isCapacitorNative
        ? {
            openUrl: (url: string) => {
              void import("@capacitor/browser").then(({ Browser }) =>
                Browser.open({ url, presentationStyle: "popover" }),
              );
            },
          }
        : {}),
    }).catch((loginError) => {
      loginStartedRef.current = false;
      console.error("[Auth] loginWithRedirect failed", loginError);
    });
  }, [isLoading, isAuthenticated, loginWithRedirect]);

  if (isLoading) return <AppLoadingScreen />;
  if (error) {
    return (
      <AuthErrorScreen
        error={error}
        onRetry={() => {
          void loginWithRedirect({
            appState: { returnTo: window.location.pathname + window.location.search },
          }).catch((retryError) => console.error("[Auth] retry failed", retryError));
        }}
      />
    );
  }
  if (!isAuthenticated) return <AppLoadingScreen />;
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
          void loginWithRedirect({ appState: { returnTo: "/" } }).catch((retryError) =>
            console.error("[Auth] retry failed", retryError),
          );
        }}
      />
    );
  }

  const isOnboarded = localStorage.getItem("onboarded") === "true";
  const hasSeenWelcome = !!localStorage.getItem(WELCOME_SEEN_KEY);

  if (!isAuthenticated) {
    if (isOnboarded) return <Navigate to="/physical" replace />;
    if (!hasSeenWelcome) return <Navigate to="/welcome" replace />;
    return <Navigate to="/onboarding" replace />;
  }

  return <Navigate to="/physical" replace />;
}

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const isOnboarded = localStorage.getItem("onboarded") === "true";
  return isOnboarded ? <>{children}</> : <Navigate to="/onboarding" replace />;
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
  return isAuthenticated ? <Navigate to="/" replace /> : <AppLoadingScreen />;
}

export default function App() {
  return (
    <>
      <AuthSyncBoundary />
      <CapacitorAuthHandler />
      <React.Suspense fallback={<AppLoadingScreen />}>
        <Routes>
          <Route path="/" element={<RootEntry />} />
          <Route path="/callback" element={<AuthCallbackBridge />} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/overview" element={<RequireAuth><RequireOnboarding><Index /></RequireOnboarding></RequireAuth>} />
          <Route path="/physical" element={<RequireAuth><RequireOnboarding><TransitionGate><PhysicalDashboard /></TransitionGate></RequireOnboarding></RequireAuth>} />
          <Route path="/mental" element={<RequireAuth><RequireOnboarding><MentalOverview /></RequireOnboarding></RequireAuth>} />
          <Route path="/journal" element={<RequireAuth><RequireOnboarding><Journal /></RequireOnboarding></RequireAuth>} />
          <Route path="/mental/coach" element={<RequireAuth><RequireOnboarding><AiMentalCoach /></RequireOnboarding></RequireAuth>} />
          <Route path="/habits" element={<RequireAuth><RequireOnboarding><Habits /></RequireOnboarding></RequireAuth>} />
          <Route path="/tools" element={<RequireAuth><RequireOnboarding><Tools /></RequireOnboarding></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><RequireOnboarding><Profile /></RequireOnboarding></RequireAuth>} />
          <Route path="/chat" element={<RequireAuth><RequireOnboarding><Chat /></RequireOnboarding></RequireAuth>} />
          <Route path="/sleep" element={<RequireAuth><RequireOnboarding><Sleep /></RequireOnboarding></RequireAuth>} />
          <Route path="/roadmap" element={<RequireAuth><RequireOnboarding><Roadmap /></RequireOnboarding></RequireAuth>} />
          <Route path="/pricing" element={<RequireAuth><RequireOnboarding><Pricing /></RequireOnboarding></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </React.Suspense>
    </>
  );
}

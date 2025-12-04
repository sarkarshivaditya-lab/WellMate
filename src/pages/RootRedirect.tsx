import { Navigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

function AuthenticatedRedirect() {
  const user = useQuery(api.users.getCurrentUser);

  // If user data is still loading, show loading state
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-96 w-full max-w-4xl" />
      </div>
    );
  }

  // If no user or onboarding not completed → onboarding
  if (!user || !user.hasCompletedOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  // If user exists and onboarding completed → physical tab
  return <Navigate to="/physical" replace />;
}

export default function RootRedirect() {
  return (
    <>
      <Unauthenticated>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-6">
            <div className="text-6xl mb-4">🌱</div>
            <h1 className="text-4xl text-balance font-bold tracking-tight">
              Welcome to WellMate
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Your personal health and wellness companion
            </p>
            <SignInButton />
          </div>
        </div>
      </Unauthenticated>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-96 w-full max-w-4xl" />
        </div>
      </AuthLoading>
      <Authenticated>
        <AuthenticatedRedirect />
      </Authenticated>
    </>
  );
}

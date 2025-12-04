import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ActivityIcon, BrainIcon } from "lucide-react";
import Onboarding from "./Onboarding.tsx";
import FoodLog from "./physical/FoodLog.tsx";
import MentalOverview from "./mental/Overview.tsx";

function AppContent() {
  const user = useQuery(api.users.getCurrentUser);
  const [activeTab, setActiveTab] = useState<"physical" | "mental">("physical");

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-96 w-full max-w-4xl" />
      </div>
    );
  }

  if (!user?.hasCompletedOnboarding) {
    return <Onboarding />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            <h1 className="text-2xl font-bold text-primary">WellMate</h1>
            <p className="text-sm text-muted-foreground">Welcome, {user.name}</p>
          </div>
          <div className="flex space-x-1 -mb-px">
            <Button
              variant={activeTab === "physical" ? "default" : "ghost"}
              onClick={() => setActiveTab("physical")}
              className="rounded-b-none"
            >
              <ActivityIcon className="mr-2 h-4 w-4" />
              Physical
            </Button>
            <Button
              variant={activeTab === "mental" ? "default" : "ghost"}
              onClick={() => setActiveTab("mental")}
              className="rounded-b-none"
            >
              <BrainIcon className="mr-2 h-4 w-4" />
              Mental
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        {activeTab === "physical" && <FoodLog />}
        {activeTab === "mental" && <MentalOverview />}
      </main>
    </div>
  );
}

export default function Index() {
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
        <AppContent />
      </Authenticated>
    </>
  );
}

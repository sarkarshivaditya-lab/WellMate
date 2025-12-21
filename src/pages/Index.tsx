import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  ActivityIcon,
  BrainIcon,
  UtensilsIcon,
  DumbbellIcon,
  BarChart3Icon,
  CalendarHeartIcon,
  SparklesIcon,
  HomeIcon,
  BookOpenIcon,
  WrenchIcon,
  InfoIcon,
} from "lucide-react";
import FoodLog from "./physical/FoodLog.tsx";
import ExerciseLog from "./physical/ExerciseLog.tsx";
import Progress from "./physical/Progress.tsx";
import PeriodTracker from "./physical/PeriodTracker.tsx";
import AiCoach from "./physical/AiCoach.tsx";
import MentalOverview from "./mental/Overview.tsx";
import MentalJournal from "./mental/Journal.tsx";
import MentalTools from "./mental/Tools.tsx";
import MentalResources from "./mental/Resources.tsx";
import AiMentalCoach from "./mental/AiMentalCoach.tsx";
// using tailwind transitions for subtle motion to avoid import mismatch
import PageLayout from "@/components/layout/PageLayout";

type PhysicalScreen = "food" | "exercise" | "progress" | "period" | "coach";
type MentalScreen = "overview" | "journal" | "tools" | "resources" | "aicoach";

function AppContent() {
  const user = useQuery(api.users.getCurrentUser);
  const [activeTab, setActiveTab] = useState<"physical" | "mental">("physical");
  const [physicalScreen, setPhysicalScreen] = useState<PhysicalScreen>("coach");
  const [mentalScreen, setMentalScreen] = useState<MentalScreen>("aicoach");

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-96 w-full max-w-4xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-12 px-4">
      <header className="w-full max-w-4xl sticky top-4 z-10">
        <div className="bg-card border-b rounded-md">
          <div className="flex items-center justify-between py-4 px-4">
            <h1 className="text-3xl font-bold text-primary">WellMate</h1>
            <p className="text-sm text-muted-foreground">
              Welcome, {user?.name || "User"}
            </p>
          </div>
          <div className="flex space-x-1 -mb-px overflow-x-auto px-4 py-2">
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

      {activeTab === "physical" && (
        <div className="w-full max-w-4xl mx-auto mt-4">
          <div className="bg-card/50 rounded-t-md px-4">
            <div className="flex space-x-1 overflow-x-auto py-2">
              <Button
                variant={physicalScreen === "coach" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setPhysicalScreen("coach")}
              >
                <SparklesIcon className="mr-2 h-4 w-4" />
                AI Coach
              </Button>
              <Button
                variant={physicalScreen === "food" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setPhysicalScreen("food")}
              >
                <UtensilsIcon className="mr-2 h-4 w-4" />
                Food
              </Button>
              <Button
                variant={physicalScreen === "exercise" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setPhysicalScreen("exercise")}
              >
                <DumbbellIcon className="mr-2 h-4 w-4" />
                Exercise
              </Button>
              <Button
                variant={physicalScreen === "progress" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setPhysicalScreen("progress")}
              >
                <BarChart3Icon className="mr-2 h-4 w-4" />
                Progress
              </Button>
              {user?.periodTrackingEnabled && (
                <Button
                  variant={physicalScreen === "period" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setPhysicalScreen("period")}
                >
                  <CalendarHeartIcon className="mr-2 h-4 w-4" />
                  Period
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "mental" && (
        <div className="border-b bg-card/50">
          <div className="container mx-auto px-4">
            <div className="flex space-x-1 overflow-x-auto py-2">
              <Button
                variant={mentalScreen === "aicoach" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMentalScreen("aicoach")}
              >
                <SparklesIcon className="mr-2 h-4 w-4" />
                AI Coach
              </Button>
              <Button
                variant={mentalScreen === "overview" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMentalScreen("overview")}
              >
                <HomeIcon className="mr-2 h-4 w-4" />
                Overview
              </Button>
              <Button
                variant={mentalScreen === "journal" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMentalScreen("journal")}
              >
                <BookOpenIcon className="mr-2 h-4 w-4" />
                Journal
              </Button>
              <Button
                variant={mentalScreen === "tools" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMentalScreen("tools")}
              >
                <WrenchIcon className="mr-2 h-4 w-4" />
                Tools
              </Button>
              <Button
                variant={mentalScreen === "resources" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMentalScreen("resources")}
              >
                <InfoIcon className="mr-2 h-4 w-4" />
                Resources
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="w-full max-w-4xl mx-auto mt-8">
        {activeTab === "physical" && (
          <div className="transition-transform duration-200 ease-out opacity-100 translate-y-0">
            {physicalScreen === "coach" && <AiCoach />}
            {physicalScreen === "food" && <FoodLog />}
            {physicalScreen === "exercise" && <ExerciseLog />}
            {physicalScreen === "progress" && <Progress />}
            {physicalScreen === "period" && <PeriodTracker />}
          </div>
        )}
        {activeTab === "mental" && (
          <div className="transition-transform duration-200 ease-out opacity-100 translate-y-0">
            {mentalScreen === "aicoach" && <AiMentalCoach />}
            {mentalScreen === "overview" && <MentalOverview />}
            {mentalScreen === "journal" && <MentalJournal />}
            {mentalScreen === "tools" && <MentalTools />}
            {mentalScreen === "resources" && <MentalResources />}
          </div>
        )}
      </main>
    </div>
  );
}

export default function Index() {
  return (
    <>
      <Unauthenticated>
        <PageLayout>
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
        </PageLayout>
      </Unauthenticated>
      <AuthLoading>
        <PageLayout>
          <div className="flex items-center justify-center">
            <Skeleton className="h-96 w-full max-w-4xl" />
          </div>
        </PageLayout>
      </AuthLoading>
      <Authenticated>
        <PageLayout>
          <AppContent />
        </PageLayout>
      </Authenticated>
    </>
  );
}

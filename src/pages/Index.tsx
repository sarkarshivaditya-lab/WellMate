import React from "react";
import { Link } from "react-router-dom";
import PageLayout from "@/components/layout/PageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export default function Index() {
  return (
    <PageLayout
      title="Overview"
      subtitle="Your wellbeing at a glance and where to go next."
    >
      <section className="space-y-8">
        {/* =========================
            HOME
           ========================= */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Home className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Home</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your main dashboard for activity, workouts, and nutrition.
            </p>

            <div className="flex gap-3">
              <Button asChild variant="secondary">
                <Link to="/physical">Go Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* =========================
            HABITS & INSIGHTS
           ========================= */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Habits & Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Track consistency, build streaks, and understand patterns.
            </p>

            <div className="flex gap-3">
              <Button asChild variant="secondary">
                <Link to="/habits">View Habits</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* =========================
            WELLBEING
           ========================= */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Wellbeing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Practices to support your mental wellbeing.
            </p>

            <div className="flex gap-3">
              <Button asChild variant="secondary">
                <Link to="/tools">Open Wellbeing</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* =========================
            MENTAL
           ========================= */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mental</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Reflect, journal, or talk things through.
            </p>

            <div className="flex gap-3">
              <Button asChild variant="secondary">
                <Link to="/journal">Open Journal</Link>
              </Button>

              <Button asChild variant="secondary">
                <Link to="/mental/coach">Talk to WellMate</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </PageLayout>
  );
}

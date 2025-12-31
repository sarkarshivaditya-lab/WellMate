import React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import PageLayout from "@/components/layout/PageLayout";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/* ✅ ADDED — Slice A */
import CheckInFlow from "@/pages/mental/CheckInFlow";
import { hasBaseline } from "@/lib/mentalWellbeingStore";

export default function Index() {
  const user = useQuery(api.users.getCurrentUser);
  const [backendTimeout, setBackendTimeout] = React.useState(false);

  /* ✅ ADDED — Slice A */
  const [showCheckIn, setShowCheckIn] = React.useState(false);

  React.useEffect(() => {
    if (user !== undefined) return;
    const timer = setTimeout(() => setBackendTimeout(true), 3000);
    return () => clearTimeout(timer);
  }, [user]);

  if (user === undefined && backendTimeout) {
    return (
      <PageLayout title="Overview">
        <section className="py-24 flex flex-col items-center justify-center text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            The app is running, but the backend is unreachable.
          </p>
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            pnpm convex dev
          </code>
        </section>
      </PageLayout>
    );
  }

  if (user === undefined || user === null) {
    return (
      <PageLayout title="Overview">
        <section className="py-24 flex flex-col items-center justify-center text-center space-y-3">
          <Spinner />
          <p className="text-sm text-muted-foreground">
            Loading your overview…
          </p>
        </section>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Overview"
      subtitle="Your personal health dashboard and quick orientation."
    >
      <section className="space-y-6">

        {/* ✅ Mental Wellbeing Check-in (ONE-TIME BASELINE) */}
        {!hasBaseline() && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Mental Wellbeing Check-in
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                A short set of questions to help personalize your experience.
              </p>
              <Button onClick={() => setShowCheckIn(true)}>
                Start check-in
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="text-sm text-muted-foreground max-w-md">
          Welcome back{user.name ? `, ${user.name}` : ""}.  
          Visit the Physical tab for today’s insights and progress.
        </p>

        {/* ✅ Full-screen Check-in Flow */}
        {showCheckIn && (
          <CheckInFlow
            onComplete={() => {
              setShowCheckIn(false);
            }}
            onCancel={() => {
              setShowCheckIn(false);
            }}
          />
        )}

      </section>
    </PageLayout>
  );
}

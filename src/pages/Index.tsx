import React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import PageLayout from "@/components/layout/PageLayout";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Index() {
  const user = useQuery(api.users.getCurrentUser);
  const [backendTimeout, setBackendTimeout] = React.useState(false);

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

  if (user === undefined) {
    return (
      <PageLayout title="Overview">
        <section className="py-24 flex flex-col items-center justify-center text-center space-y-3">
          <Spinner />
          <p className="text-sm text-muted-foreground">Loading your overview</p>
        </section>
      </PageLayout>
    );
  }

  if (user === null) {
    return (
      <PageLayout
        title="Overview"
        subtitle="Your personal health dashboard and quick orientation."
      >
        <section className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Mental Wellbeing Check-in
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Sign in to see your personal overview and insights.
              </p>
              <Button disabled>Sign-in required</Button>
            </CardContent>
          </Card>

          <p className="text-sm text-muted-foreground max-w-md">
            Youre in preview modeonce auth is wired, your data will show here.
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Mental Wellbeing Check-in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Mental wellbeing check-ins are coming soon.
            </p>
            <Button disabled>Check-in coming soon</Button>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground max-w-md">
          Welcome back{user.name ? `, ${user.name}` : ""}. Visit the Physical
          tab for today’s insights and progress.
        </p>
      </section>
    </PageLayout>
  );
}

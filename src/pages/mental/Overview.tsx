import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";

export default function MentalOverview() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Mental Wellbeing</CardTitle>
          <CardDescription>Coming soon</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This section will include tools for mindfulness, journaling, and mental health resources.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

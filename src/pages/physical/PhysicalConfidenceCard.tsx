import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { calculateConfidenceScore } from "./_utils/confidenceScoring";

type DatedEntry = { dateIso?: string; startIso?: string };

export default function PhysicalConfidenceCard() {
  const today = new Date().toISOString().split("T")[0];

  const user = useQuery(api.users.getCurrentUser);
  const mealsToday = useQuery(api.meals.getMealsByDate, { dateIso: today });
  const exercisesToday = useQuery(api.exercises.getExercisesByDate, {
    dateIso: today,
  });
  const sleep7 = useQuery(api.sleep.getRecentSleep, { days: 7 });
  const meals7 = useQuery(api.meals.getRecentMeals, { days: 7 });
  const exercises7: DatedEntry[] = [];

  if (
    user === undefined ||
    mealsToday === undefined ||
    exercisesToday === undefined ||
    sleep7 === undefined ||
    meals7 === undefined
  ) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          Estimating today’s confidence…
        </CardContent>
      </Card>
    );
  }

  const result = calculateConfidenceScore({
    user,
    mealsLast7: meals7,
    exercisesLast7: exercises7,
    sleepLast7: sleep7,
    mealsToday,
    exercisesToday,
    sleepToday: sleep7.filter((s: DatedEntry) =>
      s.startIso?.startsWith(today),
    ),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Insight Confidence
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="text-xl font-medium">
          {result.confidenceScore}%
        </div>

        <div className="text-xs text-muted-foreground">
          An estimate based on your recent logs
        </div>

        <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground space-y-1">
          {result.explanations.map((e, i) => (
            <li key={i}>
              {e}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

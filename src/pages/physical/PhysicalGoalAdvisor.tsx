import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateGoalAdvice } from "./_utils/goalAdvisor";
import { useLocalProfile } from "@/hooks/useLocalProfile";

export default function PhysicalGoalAdvisor() {
  const meals = useQuery(api.meals.getRecentMeals, { days: 7 });
  const profile = useLocalProfile();

  // 1️⃣ Still loading meal history from Convex
  if (meals === undefined) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          Loading goal analysis…
        </CardContent>
      </Card>
    );
  }

  if (meals === null) return null;

  // 2️⃣ No goal set in local profile
  const goal = profile?.goal;
  if (!goal) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          Add a goal in onboarding to get goal alignment tips.
        </CardContent>
      </Card>
    );
  }

  const dayMap = new Map<string, number>();
  meals.forEach((m) => {
    dayMap.set(m.dateIso, (dayMap.get(m.dateIso) || 0) + m.totalCalories);
  });

  const advice = generateGoalAdvice({
    goal,
    surplusDays: 0,
    deficitDays: 0,
    avgProteinPct: null,
    mealDays: dayMap.size,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Goal Alignment</CardTitle>
          <Button size="sm">Improve</Button>
        </div>
      </CardHeader>

      <CardContent>
        <ul className="list-disc ml-4 text-sm space-y-1">
          {advice.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

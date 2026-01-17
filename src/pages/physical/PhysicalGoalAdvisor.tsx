import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateGoalAdvice } from "./_utils/goalAdvisor";

export default function PhysicalGoalAdvisor() {
  const meals = useQuery(api.meals.getRecentMeals, { days: 7 });
  const user = useQuery(api.users.getCurrentUser);

  // 1️⃣ Still loading Convex queries
  if (meals === undefined || user === undefined) {
    return (
      <Card>
        <CardContent className="text-sm text-muted-foreground">
          Loading goal analysis…
        </CardContent>
      </Card>
    );
  }

  // 2️⃣ Authenticated route, but Convex user not bootstrapped yet
  // Do NOT show auth CTA and do NOT spin forever
  if (user === null) {
    return null;
  }

  // 3️⃣ User exists but goal missing
  if (!user.goal) {
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
    goal: user.goal,
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

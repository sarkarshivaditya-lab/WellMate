import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { generateGoalAdvice } from "./_utils/goalAdvisor";
import { useLocalProfile } from "@/hooks/useLocalProfile";

export default function PhysicalGoalAdvisor() {
  const meals = useQuery(api.meals.getRecentMeals, { days: 7 });
  const profile = useLocalProfile();

  // 1️⃣ Still loading meal history from Convex
  if (meals === undefined) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-28 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-2.5">
          <Skeleton className="h-3 w-full rounded-md" />
          <Skeleton className="h-3 w-4/5 rounded-md" />
          <Skeleton className="h-3 w-2/3 rounded-md" />
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
        <ul className="space-y-2">
          {advice.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-primary/70 mt-0.5" />
              <span>{a}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

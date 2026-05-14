import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { calculateConfidenceScore } from "./_utils/confidenceScoring";
import { useAllExercises } from "@/hooks/useAllExercises";
import { useLocalProfile } from "@/hooks/useLocalProfile";
import { localDateIso } from "@/services/dateUtils";

type DatedEntry = { dateIso?: string; startIso?: string };

export default function PhysicalConfidenceCard() {
  const today = localDateIso();

  const profile = useLocalProfile();
  const mealsToday = useQuery(api.meals.getMealsByDate, { dateIso: today });
  const exercisesToday = useQuery(api.exercises.getExercisesByDate, {
    dateIso: today,
  });
  const sleep7 = useQuery(api.sleep.getRecentSleep, { days: 7 });
  const meals7 = useQuery(api.meals.getRecentMeals, { days: 7 });

  const allExercises = useAllExercises();
  const exercises7 = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffIso = localDateIso(cutoff);
    return allExercises.filter((e) => e.dateIso >= cutoffIso);
  }, [allExercises]);

  // Block only on data queries — profile is local/immediate
  if (
    mealsToday === undefined ||
    exercisesToday === undefined ||
    sleep7 === undefined ||
    meals7 === undefined
  ) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-36 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-7 w-16 rounded-md" />
          <Skeleton className="h-3 w-44 rounded-md" />
          <Skeleton className="h-3 w-52 rounded-md" />
        </CardContent>
      </Card>
    );
  }

  if (
    mealsToday === null ||
    exercisesToday === null ||
    sleep7 === null ||
    meals7 === null
  ) {
    return null;
  }

  const userForScoring = profile
    ? {
        dob: profile.dob,
        sex: profile.sex,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        activityLevel: profile.activityLevel ?? undefined,
        goal: profile.goal ?? undefined,
      }
    : null;

  const result = calculateConfidenceScore({
    user: userForScoring,
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
        <CardTitle className="text-base">Insight Confidence</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="text-2xl font-semibold tabular-nums">
          {result.confidenceScore}%
        </div>

        <div className="text-xs text-muted-foreground leading-relaxed">
          An estimate based on your recent logs
        </div>

        {result.explanations.length > 0 && (
          <ul className="space-y-1.5">
            {result.explanations.map((e, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                {e}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

import { useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { calculateConfidenceScore } from "./_utils/confidenceScoring";
import { useAllExercises } from "@/hooks/useAllExercises";
import { useAllMeals } from "@/hooks/useAllMeals";
import { useRecentSleepLogs } from "@/hooks/useSleepLogs";
import { useLocalProfile } from "@/hooks/useLocalProfile";
import { localDateIso } from "@/services/dateUtils";

export default function PhysicalConfidenceCard() {
  const today = localDateIso();

  const profile = useLocalProfile();
  const allMeals = useAllMeals();
  const allExercises = useAllExercises();
  const sleep7 = useRecentSleepLogs(7);

  const mealsToday = useMemo(
    () => allMeals.filter((m) => m.dateIso === today),
    [allMeals, today],
  );

  const meals7 = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffIso = localDateIso(cutoff);
    return allMeals.filter((m) => m.dateIso >= cutoffIso);
  }, [allMeals, today]);

  const exercises7 = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffIso = localDateIso(cutoff);
    return allExercises.filter((e) => e.dateIso >= cutoffIso);
  }, [allExercises]);

  const exercisesToday = useMemo(
    () => allExercises.filter((e) => e.dateIso === today),
    [allExercises, today],
  );

  const sleepToday = useMemo(
    () => sleep7.filter((s) => s.startIso?.startsWith(today)),
    [sleep7, today],
  );

  // No data logged yet — show intentional empty state, never a ghost card
  const hasAnyData =
    meals7.length > 0 || exercises7.length > 0 || sleep7.length > 0;

  if (!hasAnyData) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Insight Confidence</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Log meals, exercise, or sleep to see your insight confidence.
          </p>
        </CardContent>
      </Card>
    );
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
    sleepToday,
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
              <li
                key={i}
                className="flex items-start gap-1.5 text-xs text-muted-foreground"
              >
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

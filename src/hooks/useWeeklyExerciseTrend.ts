import { useEffect, useState } from "react";
import { getExercisesByDate } from "@/data/local/exercises";

type DayPoint = {
  dateIso: string;
  label: string;
  calories: number;
};

function getLast7Days(): { dateIso: string; label: string }[] {
  const days: { dateIso: string; label: string }[] = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);

    const dateIso = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString(undefined, {
      weekday: "short",
    });

    days.push({ dateIso, label });
  }

  return days;
}

export function useWeeklyExerciseTrend() {
  const [data, setData] = useState<DayPoint[]>([]);

  useEffect(() => {
    const days = getLast7Days();

    const points = days.map(({ dateIso, label }) => {
      const exercises = getExercisesByDate(dateIso);

      const calories = exercises.reduce(
        (sum, e) => sum + (e.caloriesBurnedEst || 0),
        0,
      );

      return {
        dateIso,
        label,
        calories,
      };
    });

    setData(points);
  }, []);

  return data;
}

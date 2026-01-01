import { useEffect, useState } from "react";
import type { LocalMeal } from "../local/mealsStore";

export function useMealsByDate(dateIso: string) {
  const [meals, setMeals] = useState<LocalMeal[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Stub: local store not wired yet
    setMeals([]);
    setLoading(false);
  }, [dateIso]);

  return { meals, loading };
}

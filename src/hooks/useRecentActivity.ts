// src/hooks/useRecentActivity.ts
// Reactive recent activity aggregated across all local wellness stores.
// Subscribes to all store mutations — updates automatically on any write.

import { useState, useEffect } from "react";
import { getRecentActivity } from "@/search/searchIndex";
import type { SearchResult } from "@/search/searchTypes";
import { subscribeToMeals } from "@/data/local/mealsStore";
import { subscribeToExercises } from "@/data/local/exercises";
import { subscribeToSleep } from "@/data/local/sleepStore";
import { subscribeToMoods } from "@/data/local/moodsStore";
import { subscribeToJournal } from "@/data/local/journalStore";

export function useRecentActivity(limit = 12): SearchResult[] {
  const [items, setItems] = useState<SearchResult[]>(() =>
    getRecentActivity(limit),
  );

  useEffect(() => {
    const refresh = () => setItems(getRecentActivity(limit));

    const unsubs = [
      subscribeToMeals(refresh),
      subscribeToExercises(refresh),
      subscribeToSleep(refresh),
      subscribeToMoods(refresh),
      subscribeToJournal(refresh),
    ];

    return () => unsubs.forEach((u) => u());
  }, [limit]);

  return items;
}

// src/sync/syncScheduler.ts

import type { ConvexReactClient } from "convex/react";
import { syncExercises } from "./exerciseSync";
// import { syncMeals } from "./mealSync";

export async function runOfflineSync(
  convex: ConvexReactClient | null | undefined,
) {
  console.log("[syncScheduler] CALLED");
  alert("runOfflineSync CALLED");

  if (!convex) {
    console.log("[syncScheduler] convex missing");
    return;
  }

  try {
    await syncExercises(convex);
  } catch (err) {
    console.log("[syncScheduler] exercise sync threw", err);
  }
}

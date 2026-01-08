import { api } from "@/convex/_generated/api";
import type { ConvexReactClient } from "convex/react";
import { listHabits, listEntriesByDate } from "@/data/local/habitsStore";

export async function syncHabits(convex: ConvexReactClient) {
  const habits = listHabits();

  for (const h of habits) {
    await convex.mutation(api.habits.addHabit, {
      title: h.title,
      description: h.description,
      cadence: h.cadence,
      remindersEnabled: h.remindersEnabled,
      reminderTime: h.reminderTime,
    });
  }

  const today = new Date().toISOString().split("T")[0];
  const entries = listEntriesByDate(today);

  for (const e of entries) {
    // best-effort mirror; server is idempotent by (habitId,date) semantics
    await convex.mutation(api.habits.addHabitEntry, {
      habitId: e.habitLocalId as never,
      dateIso: e.dateIso,
      completed: e.completed,
      note: e.note,
    });
  }
}

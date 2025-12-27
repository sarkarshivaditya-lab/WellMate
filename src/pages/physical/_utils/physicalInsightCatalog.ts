import type { PhysicalInsight } from "./types";

export const physicalInsights: PhysicalInsight[] = [
  {
    id: "calorie_balance",
    title: "Energy balance trend",
    body: "Your intake versus expenditure suggests a stable energy balance.",
    impact: 3,
    requires: { meals: true, exercise: true, profile: true },
  },
  {
    id: "protein_intake",
    title: "Protein intake",
    body: "Protein intake may be below target for your body weight.",
    impact: 2,
    requires: { meals: true, profile: true },
  },
  {
    id: "sleep_consistency",
    title: "Sleep consistency",
    body: "Your recent sleep timing varies significantly.",
    impact: 1,
    requires: { sleep: true },
  },
];

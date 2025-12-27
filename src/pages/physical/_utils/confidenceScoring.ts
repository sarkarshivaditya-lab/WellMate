type UserProfile = {
  dob?: string;
  sex?: string;
  heightCm?: number;
  weightKg?: number;
  activityLevel?: string;
  goal?: string;
};

type DatedEntry = { dateIso?: string; startIso?: string };

function daysAgo(dateIso: string): number {
  const d = new Date(dateIso);
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function freshnessScore(entries: DatedEntry[], maxDays: number): number {
  if (entries.length === 0) return 0;

  const scores = entries.map((e) => {
    const iso = e.dateIso ?? e.startIso;
    if (!iso) return 0;
    const age = daysAgo(iso.split("T")[0]);
    if (age >= maxDays) return 0;
    return 1 - age / maxDays;
  });

  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function calculateConfidenceScore(args: {
  user: UserProfile | null | undefined;
  mealsLast7: DatedEntry[];
  exercisesLast7: DatedEntry[];
  sleepLast7: DatedEntry[];
  mealsToday: DatedEntry[];
  exercisesToday: DatedEntry[];
  sleepToday: DatedEntry[];
}) {
  const explanations: string[] = [];
  let score = 0;

  // ---------- Profile completeness (40) ----------
  const requiredFields: (keyof UserProfile)[] = [
    "dob",
    "sex",
    "heightCm",
    "weightKg",
    "activityLevel",
    "goal",
  ];

  const present = requiredFields.filter(
    (f) => args.user && args.user[f],
  ).length;

  const profilePct = present / requiredFields.length;
  score += profilePct * 40;

  if (profilePct < 1) {
    explanations.push("Profile incomplete — some targets are estimated.");
  }

  // ---------- Freshness (40) ----------
  const mealFresh = freshnessScore(args.mealsLast7, 7);
  const exerciseFresh = freshnessScore(args.exercisesLast7, 7);
  const sleepFresh = freshnessScore(args.sleepLast7, 7);

  const freshnessAvg = (mealFresh + exerciseFresh + sleepFresh) / 3;
  score += freshnessAvg * 40;

  if (freshnessAvg < 0.5) {
    explanations.push("Recent logs are sparse — insights may be less precise.");
  }

  // ---------- Coverage bonus (20) ----------
  let coverage = 0;
  if (args.mealsToday.length > 0) coverage += 8;
  if (args.exercisesToday.length > 0) coverage += 6;
  if (args.sleepToday.length > 0) coverage += 6;

  score += coverage;

  if (coverage < 20) {
    explanations.push(
      "Log meals, exercise, and sleep today for best accuracy.",
    );
  }

  const finalScore = Math.round(Math.min(100, score));

  let level: "high" | "medium" | "low" = "low";
  if (finalScore >= 75) level = "high";
  else if (finalScore >= 45) level = "medium";

  return {
    confidenceScore: finalScore,
    confidenceLevel: level,
    explanations,
  };
}

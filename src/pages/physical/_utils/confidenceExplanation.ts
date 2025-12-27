export type ConfidenceLevel = "high" | "medium" | "low";

export function applyConfidenceToExplanation(
  base: string,
  level: ConfidenceLevel,
): string {
  if (level === "high") {
    return base;
  }

  if (level === "medium") {
    return `Your data suggests that ${base.charAt(0).toLowerCase()}${base.slice(
      1,
    )}`;
  }

  return `Based on limited data, it’s possible that ${base
    .charAt(0)
    .toLowerCase()}${base.slice(1)}`;
}

type ConfidenceLevel = "high" | "medium" | "low";

function toDirective(text: string): string {
  return text.replace(/^You may|You might|Consider/i, "").trim();
}

function toAdvisory(text: string): string {
  return `Consider ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

function toExploratory(text: string): string {
  return `It looks like ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

export function modulateInsightCopy<T extends { title: string; body: string }>(
  insight: T,
  confidenceLevel: ConfidenceLevel,
): T & { displayTitle: string; displayBody: string } {
  let displayTitle = insight.title;
  let displayBody = insight.body;

  if (confidenceLevel === "high") {
    displayBody = toDirective(insight.body);
  }

  if (confidenceLevel === "medium") {
    displayBody = toAdvisory(insight.body);
  }

  if (confidenceLevel === "low") {
    displayBody = toExploratory(insight.body);
  }

  return {
    ...insight,
    displayTitle,
    displayBody,
  };
}

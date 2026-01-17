// src/pages/physical/_utils/insightCopyModulation.ts

type ConfidenceLevel = "high" | "medium" | "low";

/* =========================
   COPY TRANSFORMS
   ========================= */

function normalize(text: string): string {
  return text.trim().replace(/\.$/, "");
}

function toDirective(text: string): string {
  const cleaned = normalize(
    text.replace(
      /^(It looks like|Consider|You may|You might)/i,
      "",
    ),
  );

  return cleaned;
}

function toAdvisory(text: string): string {
  const cleaned = normalize(
    text.replace(/^(It looks like|You may|You might)/i, ""),
  );

  return `Consider ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(
    1,
  )}.`;
}

function toExploratory(text: string): string {
  const cleaned = normalize(
    text.replace(/^(Consider|You may|You might)/i, ""),
  );

  return `It looks like ${cleaned.charAt(0).toLowerCase()}${cleaned.slice(
    1,
  )}.`;
}

/* =========================
   TITLE MODULATION
   ========================= */

function modulateTitle(
  baseTitle: string,
  confidenceLevel: ConfidenceLevel,
): string {
  if (confidenceLevel === "high") {
    return baseTitle;
  }

  if (confidenceLevel === "medium") {
    return `${baseTitle} (worth reviewing)`;
  }

  return `${baseTitle} (early signal)`;
}

/* =========================
   PUBLIC API
   ========================= */

export function modulateInsightCopy<
  T extends { title: string; body: string },
>(
  insight: T,
  confidenceLevel: ConfidenceLevel,
): T & { displayTitle: string; displayBody: string } {
  let displayBody: string;

  if (confidenceLevel === "high") {
    displayBody = toDirective(insight.body);
  } else if (confidenceLevel === "medium") {
    displayBody = toAdvisory(insight.body);
  } else {
    displayBody = toExploratory(insight.body);
  }

  const displayTitle = modulateTitle(
    insight.title,
    confidenceLevel,
  );

  return {
    ...insight,
    displayTitle,
    displayBody,
  };
}

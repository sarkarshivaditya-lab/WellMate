import type { AiMentalResponse } from "../../src/services/aiMentalTypes";
import practicesData from "../../src/data/practices.json";

/* ======================================================
   CRISIS KEYWORDS (SERVER-AUTHORITATIVE)
   ====================================================== */
export const CRISIS_PATTERNS = [
  /suicide/i,
  /kill myself/i,
  /self harm/i,
  /end my life/i,
  /want to die/i,
  /no reason to live/i,
  /hurt myself/i,
  /can't go on/i,
];

export function detectCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some((p) => p.test(text));
}

/* ===================== HELPERS ===================== */

interface MoodData {
  moodValue: number;
  note?: string;
  dateIso: string;
}

export function buildMoodHistory(
  moods: MoodData[],
  todayMood: MoodData | null,
): string {
  if (moods.length === 0 && !todayMood) return "No mood data available.";
  const avg =
    moods.length > 0
      ? (moods.reduce((s, m) => s + m.moodValue, 0) / moods.length).toFixed(1)
      : "N/A";
  return `Average mood: ${avg}/5.`;
}

interface JournalData {
  tags: string[];
  text: string;
  dateIso: string;
}

export function buildJournalSummary(journals: JournalData[]): string {
  if (journals.length === 0) return "No recent journal entries.";
  return `Recent journal entries: ${journals.length}.`;
}

export function buildPracticesList(): string {
  return JSON.stringify(
    practicesData.map((p) => ({ id: p.id, title: p.title, type: p.type })),
    null,
    2,
  );
}

export function validateMentalResponse(parsed: unknown): AiMentalResponse {
  if (!parsed || typeof parsed !== "object") {
    return createSafetyFallback("Invalid response format.", true);
  }

  const obj = parsed as Record<string, unknown>;

  return {
    summary:
      typeof obj.summary === "string" ? obj.summary : "I'm here with you.",
    emotion:
      typeof obj.emotion === "string"
        ? (obj.emotion as AiMentalResponse["emotion"])
        : "calm",
    suggestions: Array.isArray(obj.suggestions)
      ? obj.suggestions
          .filter((s): s is string => typeof s === "string")
          .slice(0, 3)
      : [],
    practice:
      obj.practice && typeof obj.practice === "object"
        ? (obj.practice as AiMentalResponse["practice"])
        : getDefaultPractice(),
    escalation: obj.escalation === true,
    confidence:
      typeof obj.confidence === "string"
        ? (obj.confidence as AiMentalResponse["confidence"])
        : "medium",
  };
}

export function getDefaultPractice() {
  const p = practicesData[0];
  return { id: p.id, title: p.title, steps: p.steps };
}

export function createSafetyFallback(
  message: string,
  escalate: boolean,
): AiMentalResponse {
  return {
    summary: message,
    emotion: "calm",
    suggestions: ["Please consider reaching out to someone you trust."],
    practice: getDefaultPractice(),
    escalation: escalate,
    confidence: "low",
  };
}

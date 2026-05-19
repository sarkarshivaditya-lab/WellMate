// AI output safety filter for wellness context.
// Pattern-based — catches common failure modes: diagnosis language, medical
// certainty, prescriptive commands, manipulative emotional framing.
// NOT adversarially robust; designed for a grounded wellness companion model.

export type SafetyFlag =
  | "medical_claim"
  | "diagnosis_language"
  | "unsafe_certainty"
  | "prescriptive_authority"
  | "emotional_manipulation";

export type SafetyResult = {
  safe: boolean;
  score: number;        // 0 = blocked, 1 = clean
  flags: SafetyFlag[];
  text: string;         // empty string when safe === false
};

// Hard blocks — immediate rejection regardless of surrounding context
const HARD_BLOCKS: RegExp[] = [
  /\b(diagnos[ei]s?|diagnosed)\b/i,
  /\byou (have|may have|likely have)\s+(a\s+)?(disorder|condition|syndrome|depression|anxiety|ptsd|adhd|bipolar|ocd)\b/i,
  /\b(symptoms?\s+of)\b/i,
  /\b(medically?\s+(treat|consult|advise|diagnos|prescribed?))\b/i,
  /\b(prescription|prescrib(e|ing|ed))\b/i,
  /\b(see\s+a?\s*(doctor|therapist|psychiatrist|psychologist|clinician|physician))\b/i,
  /\byou\s+(are|seem)\s+clinically\b/i,
];

// Soft flags — reduce score but don't hard-block
const SOFT_FLAGS: { pattern: RegExp; flag: SafetyFlag; weight: number }[] = [
  {
    pattern: /\b(definitely|certainly|clearly|obviously)\s+(indicates?|shows?|means?|suggests?|proves?)\b/i,
    flag: "unsafe_certainty",
    weight: 0.3,
  },
  {
    pattern: /\byou (must|need to immediately|have to|are required to)\b/i,
    flag: "prescriptive_authority",
    weight: 0.25,
  },
  {
    pattern: /\byou (are|seem to be) (severely |clinically )?(depressed|anxious|suffering|burned out)\b/i,
    flag: "diagnosis_language",
    weight: 0.4,
  },
  {
    pattern: /\b(this is a (sign|symptom|indicator) of)\b/i,
    flag: "medical_claim",
    weight: 0.35,
  },
  {
    pattern: /\b(everything will be (fine|okay|alright)|don't worry|you'll be okay)\b/i,
    flag: "emotional_manipulation",
    weight: 0.1,
  },
];

export function filterOutput(text: string): SafetyResult {
  if (!text || !text.trim()) {
    return { safe: false, score: 0, flags: [], text: "" };
  }

  // Hard block pass
  for (const pattern of HARD_BLOCKS) {
    if (pattern.test(text)) {
      return { safe: false, score: 0, flags: ["medical_claim"], text: "" };
    }
  }

  // Soft flag pass
  const flags: SafetyFlag[] = [];
  let score = 1.0;

  for (const { pattern, flag, weight } of SOFT_FLAGS) {
    if (pattern.test(text)) {
      if (!flags.includes(flag)) flags.push(flag);
      score = Math.max(0, score - weight);
    }
  }

  const safe = score > 0.4;
  return { safe, score, flags, text: safe ? text : "" };
}

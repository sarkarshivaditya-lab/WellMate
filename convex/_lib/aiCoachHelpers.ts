export function calculateAge(dobString: string): number {
  const dob = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: string,
): number {
  if (sex === "male") {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else {
    return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }
}

export function calculateTDEE(bmr: number, activityLevel: string): number {
  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    veryActive: 1.9,
  };
  return bmr * (multipliers[activityLevel] || 1.55);
}

export function calculateCalorieTarget(tdee: number, goal: string): number {
  switch (goal) {
    case "lose":
      return Math.round(tdee - 500);
    case "gain":
      return Math.round(tdee + 500);
    case "maintain":
    default:
      return Math.round(tdee);
  }
}

export function calculateMacroTargets(
  calories: number,
  weightKg: number,
  goal: string,
) {
  let proteinMultiplier = 1.8;
  if (goal === "gain") proteinMultiplier = 2.0;
  if (goal === "lose") proteinMultiplier = 2.2;

  const proteinG = Math.round(weightKg * proteinMultiplier);
  const proteinCals = proteinG * 4;

  const fatPercentage = 0.3;
  const fatCals = calories * fatPercentage;
  const fatG = Math.round(fatCals / 9);

  const remainingCals = calories - proteinCals - fatCals;
  const carbsG = Math.round(remainingCals / 4);

  return {
    protein_g: Math.max(0, proteinG),
    fat_g: Math.max(0, fatG),
    carbs_g: Math.max(0, carbsG),
  };
}

export function createFallbackResponse(
  calories: number,
  macros: { protein_g: number; fat_g: number; carbs_g: number },
) {
  return {
    advice_text:
      "I'm here to help with your fitness and nutrition goals. Could you please provide more details about what you'd like assistance with?",
    type: "mixed" as const,
    nutrition: {
      calories,
      protein_g: macros.protein_g,
      fat_g: macros.fat_g,
      carbs_g: macros.carbs_g,
      notes: "Based on your profile",
    },
    plan: [],
    exercises_database_ids: [],
    escalation: false,
    explainability:
      "Unable to generate a detailed plan at this time. Please try rephrasing your request.",
    confidence: "low" as const,
  };
}

export function getSystemPrompt(): string {
  return `You are WellMate, a friendly, factual, and safety-first personal fitness and wellbeing coach.
You MUST follow these rules exactly:
1. NEVER provide medical diagnoses or prescribe medication. If the user reports red-flag symptoms (chest pain, difficulty breathing, fainting, severe allergic reaction, suicidal ideation, pregnancy complications, or says they are under 16) respond with escalation=true and a short safety message telling them to seek professional help. Do NOT provide meal/exercise plans in that case.
2. Use ONLY the numeric calorie & macro targets provided in the "backend_calcs" object in the user input. Do NOT attempt to recompute BMR/TDEE or macros.
3. Output ONLY a single JSON object that strictly matches the JSON schema given to the model (the schema will be injected in the user prompt). No extra commentary, no markdown.
4. Keep language concise, friendly, and actionable. Include a "confidence" field: low|medium|high.
5. If you cannot produce a valid plan due to missing info, set escalation=true and explain required fields in the "advice_text" field.
6. If asked for recipes or meal ideas, produce brief suggestions only, and map foods to the macro targets.
7. Always include "explainability" with 1-3 bullet points explaining why the recommendation fits the user's goal.
8. If user requests weight loss or gain, recommend sensible rates (<=0.75 kg/week) and reflect that in notes.

Respond only in the JSON schema format provided.`;
}

export function getUserPrompt(
  profileJson: string,
  backendCalcsJson: string,
  userMessage: string,
  jsonSchema: string,
): string {
  return `You are given the following context objects. Output ONE JSON object that matches the provided JSON schema exactly.

Context:
1) profile: ${profileJson}
2) backend_calcs: ${backendCalcsJson}
3) user_request: "${userMessage}"

JSON_SCHEMA:
${jsonSchema}

Instructions:
- Use backend_calcs as the authoritative numeric source (calories, macros).
- Produce a short "advice_text" summary (1-2 sentences).
- Produce a "plan" array with up to 7 days; each day can have workouts and meal suggestions.
- Include "nutrition" block that repeats the backend_calcs numbers and maps them to grams for macros.
- If red flags are detected in user_request or profile, set escalation=true and put a short safety message in advice_text.
- Keep fields complete and typed. If you cannot fill a field, use null for numeric fields and empty array for lists.

User request: ${userMessage}`;
}

export function getAiSchema() {
  return {
    $id: "https://wellmate.app/schemas/aiResponse.json",
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    required: [
      "advice_text",
      "type",
      "nutrition",
      "plan",
      "escalation",
      "confidence",
      "explainability",
    ],
    properties: {
      advice_text: { type: "string" },
      type: { type: "string", enum: ["diet", "exercise", "mixed", "safety"] },
      nutrition: {
        type: "object",
        required: ["calories", "protein_g", "fat_g", "carbs_g"],
        properties: {
          calories: { type: "integer" },
          protein_g: { type: "integer" },
          fat_g: { type: "integer" },
          carbs_g: { type: "integer" },
          notes: { type: "string" },
        },
      },
      plan: {
        type: "array",
        items: {
          type: "object",
          required: ["day"],
          properties: {
            day: { type: "integer" },
            workout: {
              type: "array",
              items: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                  sets: { type: "integer" },
                  reps: { type: ["integer", "string"] },
                  duration_min: { type: "integer" },
                  notes: { type: "string" },
                  exercise_id: { type: "string" },
                },
              },
            },
            meals: {
              type: "array",
              items: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                  serving_text: { type: "string" },
                  calories: { type: "integer" },
                  protein_g: { type: "integer" },
                  fat_g: { type: "integer" },
                  carbs_g: { type: "integer" },
                  notes: { type: "string" },
                },
              },
            },
          },
        },
      },
      exercises_database_ids: { type: "array", items: { type: "string" } },
      escalation: { type: "boolean" },
      explainability: { type: "string" },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      metadata: { type: "object" },
    },
    additionalProperties: false,
  };
}

export function parseAndValidateAiCoachResponse(rawContent: string) {
  // Parse JSON response
  let parsed = null;
  try {
    parsed = JSON.parse(rawContent);
  } catch (error) {
    // Try to extract JSON from markdown code blocks
    const match = rawContent.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch (e) {
        return null;
      }
    } else {
      return null;
    }
  }

  // Basic validation
  if (!parsed || typeof parsed !== "object" || !(parsed as any).advice_text) {
    return null;
  }

  return parsed;
}

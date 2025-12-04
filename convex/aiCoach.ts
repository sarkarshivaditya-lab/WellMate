"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api.js";

export const chat = action({
  args: {
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    const user = await ctx.runQuery(api.users.getCurrentUser);
    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Calculate nutrition targets
    const age = user.dob ? calculateAge(user.dob) : 30;
    const weightKg = user.weightKg || 70;
    const heightCm = user.heightCm || 170;
    const sex = user.sex || "other";
    const activityLevel = user.activityLevel || "moderate";
    const goal = user.goal || "maintain";

    const bmr = calculateBMR(weightKg, heightCm, age, sex);
    const tdee = calculateTDEE(bmr, activityLevel);
    const calories = calculateCalorieTarget(tdee, goal);
    const macros = calculateMacroTargets(calories, weightKg, goal);

    const profile = {
      age,
      sex,
      height_cm: heightCm,
      weight_kg: weightKg,
      activity_level: activityLevel,
      goal,
    };

    const backendCalcs = {
      bmr,
      tdee,
      calories,
      macros,
    };

    // Call OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return createFallbackResponse(calories, macros);
    }

    try {
      const schema = getAiSchema();
      const systemPrompt = getSystemPrompt();
      const userPrompt = getUserPrompt(
        JSON.stringify(profile),
        JSON.stringify(backendCalcs),
        args.message,
        JSON.stringify(schema)
      );

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 1000,
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        console.error("OpenAI API error:", response.statusText);
        return createFallbackResponse(calories, macros);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content;

      if (!rawContent) {
        return createFallbackResponse(calories, macros);
      }

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
            return createFallbackResponse(calories, macros);
          }
        } else {
          return createFallbackResponse(calories, macros);
        }
      }

      // Basic validation
      if (!parsed || typeof parsed !== "object" || !parsed.advice_text) {
        return createFallbackResponse(calories, macros);
      }

      return parsed;
    } catch (error) {
      console.error("AI coach error:", error);
      return createFallbackResponse(calories, macros);
    }
  },
});

function calculateAge(dobString: string): number {
  const dob = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

function calculateBMR(weightKg: number, heightCm: number, age: number, sex: string): number {
  if (sex === "male") {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else {
    return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }
}

function calculateTDEE(bmr: number, activityLevel: string): number {
  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    veryActive: 1.9,
  };
  return bmr * (multipliers[activityLevel] || 1.55);
}

function calculateCalorieTarget(tdee: number, goal: string): number {
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

function calculateMacroTargets(calories: number, weightKg: number, goal: string) {
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

function createFallbackResponse(calories: number, macros: { protein_g: number; fat_g: number; carbs_g: number }) {
  return {
    advice_text: "I'm here to help with your fitness and nutrition goals. Could you please provide more details about what you'd like assistance with?",
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
    explainability: "Unable to generate a detailed plan at this time. Please try rephrasing your request.",
    confidence: "low" as const,
  };
}

function getSystemPrompt(): string {
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

function getUserPrompt(profileJson: string, backendCalcsJson: string, userMessage: string, jsonSchema: string): string {
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

function getAiSchema() {
  return {
    $id: "https://wellmate.app/schemas/aiResponse.json",
    $schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    required: ["advice_text", "type", "nutrition", "plan", "escalation", "confidence", "explainability"],
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

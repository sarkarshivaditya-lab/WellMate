"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { api } from "./_generated/api.js";
import {
  calculateAge,
  calculateBMR,
  calculateTDEE,
  calculateCalorieTarget,
  calculateMacroTargets,
  getAiSchema,
  getSystemPrompt,
  getUserPrompt,
  createFallbackResponse,
  parseAndValidateAiCoachResponse,
} from "./_lib/aiCoachHelpers";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS = [
  "openrouter/free",
  "openai/gpt-oss-20b:free",
  "google/gemma-4-26b-a4b-it:free",
];

const EXPERT_COACH_PROMPT = `
WELLMATE COACHING MODE:
You are expected to answer the user's actual question, not merely generate a workout plan.
Treat ordinary health, fitness, nutrition, recovery and lifestyle questions as answerable unless a safety rule requires escalation.

Be useful for questions about:
- training performance, plateaus, strength, endurance, sets, reps, progressive overload, exercise selection and technique
- soreness, recovery, rest days, fatigue, hydration, sleep and training readiness
- muscle gain, fat loss, weight management and sustainable habits
- calories, protein, carbohydrates, fats, fibre, meal timing, snacks, pre-workout and post-workout nutrition
- general healthy eating, meal ideas and practical substitutions
- walking, running, cardio, mobility, flexibility and conditioning
- common non-emergency wellness questions such as feeling weak, low energy, lightheadedness, headaches, digestive discomfort or poor recovery
- interpreting general wellness patterns and deciding what to monitor next

For symptom-style questions, do not diagnose. Explain common possibilities at a high level, identify what information would help distinguish them, give low-risk next steps, and clearly state when professional assessment is appropriate.
Never invent certainty. Use phrases such as "common possibilities include" when several explanations are plausible.

For performance questions, reason from the user's context and the exact question. Example: if someone says they have felt weak in the gym lately, discuss sleep, food/carbohydrate intake, hydration, recovery, recent training load, stress and illness as common contributors; distinguish a one-off bad session from a persistent decline; suggest practical checks before changing the entire program.

Do not force every answer into a seven-day plan. If the user asks "why", answer why. If they ask "what should I eat", give food options. If they ask "how do I train", give training guidance. Ask at most one useful follow-up question when personalization genuinely requires it.

Safety:
- Do not diagnose or prescribe medication.
- Escalate urgent red flags such as chest pain/pressure, severe breathing difficulty, fainting, new severe confusion, signs of stroke, uncontrolled bleeding, severe allergic reaction, severe dehydration, or an acute emergency.
- If a symptom is persistent, worsening, recurrent, or materially affecting normal activity, recommend appropriate medical evaluation.
- Never use the emergency pathway for ordinary tiredness, soreness, a normal bad workout, or routine fitness questions.

Response quality:
- Lead with the direct answer.
- Give 2-5 practical points only when they add value.
- Explain the reasoning briefly instead of dumping generic advice.
- Personalize using the supplied profile and backend calculations.
- Do not invent measurements, diagnoses, medications, lab results or wearable data.
- Use the backend calorie and macro values exactly when discussing those numbers.
- Return one valid JSON object matching the supplied schema and nothing else.
`;

function textResponse(content: string, calories: number, macros: { protein_g: number; fat_g: number; carbs_g: number }) {
  const advice = content.trim().replace(/^```(?:text|markdown)?/i, "").replace(/```$/i, "").trim();
  return {
    advice_text: advice || "I can help you work through that. Tell me a little more about what you have been noticing.",
    type: "mixed" as const,
    nutrition: {
      calories,
      protein_g: macros.protein_g,
      fat_g: macros.fat_g,
      carbs_g: macros.carbs_g,
      notes: "Profile-based targets; not a diagnosis",
    },
    plan: [],
    exercises_database_ids: [],
    escalation: false,
    explainability: "Answered the question directly using the available profile context and general wellbeing guidance.",
    confidence: "medium" as const,
  };
}

export const chat = action({
  args: { message: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    }

    const user = await ctx.runQuery(api.users.getCurrentUser);
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
    }

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
    const profile = { age, sex, height_cm: heightCm, weight_kg: weightKg, activity_level: activityLevel, goal };
    const backendCalcs = { bmr, tdee, calories, macros };

    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("WellMate Physical AI: OPENROUTER_API_KEY is not configured");
      return createFallbackResponse(calories, macros);
    }

    try {
      const schema = getAiSchema();
      const systemPrompt = `${getSystemPrompt()}\n${EXPERT_COACH_PROMPT}`;
      const userPrompt = `${getUserPrompt(JSON.stringify(profile), JSON.stringify(backendCalcs), args.message, JSON.stringify(schema))}\n\nRemember: answer the user's actual question directly. Do not return an empty plan merely because the request is informational.`;
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiKey,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://wellmate-website.vercel.app",
          "X-Title": "WellMate",
        },
        body: JSON.stringify({
          models: OPENROUTER_MODELS,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 900,
          temperature: 0.35,
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        console.error("WellMate Physical AI OpenRouter error:", response.status, detail.slice(0, 500));
        return createFallbackResponse(calories, macros);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content;
      if (!rawContent) {
        console.error("WellMate Physical AI OpenRouter returned no content");
        return createFallbackResponse(calories, macros);
      }

      const parsed = parseAndValidateAiCoachResponse(rawContent);
      return parsed ?? textResponse(rawContent, calories, macros);
    } catch (error) {
      console.error("WellMate Physical AI error:", error);
      return createFallbackResponse(calories, macros);
    }
  },
});

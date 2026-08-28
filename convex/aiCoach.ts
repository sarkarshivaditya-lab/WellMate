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
Answer the user's actual question, not merely generate a workout plan.
Ordinary health, fitness, nutrition, recovery and lifestyle questions are answerable unless a safety rule requires escalation.

Cover questions about training performance, plateaus, strength, endurance, sets, reps, progressive overload, exercise selection and technique; soreness, recovery, rest days, fatigue, hydration, sleep and training readiness; muscle gain, fat loss, weight management and sustainable habits; calories, protein, carbohydrates, fats, fibre, meal timing, snacks, pre-workout and post-workout nutrition; healthy eating and meal substitutions; walking, running, cardio, mobility and conditioning; and common non-emergency wellness questions such as weakness, low energy, lightheadedness, headaches, digestive discomfort or poor recovery.

For symptom-style questions, do not diagnose. Explain common possibilities at a high level, identify useful context, give low-risk next steps, and say when professional assessment is appropriate. Never invent certainty.

For performance questions, reason from the user's context and the exact question. For example, if someone says they have felt weak in the gym lately, discuss sleep, food/carbohydrate intake, hydration, recovery, recent training load, stress and illness as common contributors; distinguish a one-off bad session from a persistent decline; and suggest practical checks before changing the whole program.

Do not force every answer into a seven-day plan. If the user asks "why", answer why. If they ask "what should I eat", give food options. If they ask "how do I train", give training guidance. Ask at most one useful follow-up question when personalization genuinely requires it.

Safety:
- Never diagnose or prescribe medication.
- Escalate urgent red flags such as chest pain/pressure, severe breathing difficulty, fainting, new severe confusion, signs of stroke, uncontrolled bleeding, severe allergic reaction, severe dehydration, or an acute emergency.
- Persistent, worsening, recurrent, or function-limiting symptoms warrant professional evaluation.
- Do not use emergency escalation for ordinary tiredness, soreness, a normal bad workout, or routine fitness questions.

Quality:
- Lead with the direct answer.
- Give 2-5 practical points when useful.
- Explain reasoning briefly instead of dumping generic advice.
- Personalize using supplied profile and backend calculations.
- Never invent measurements, diagnoses, medications, lab results or wearable data.
- Use backend calorie and macro values exactly when discussing those numbers.
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

function resilientFallback(message: string, calories: number, macros: { protein_g: number; fat_g: number; carbs_g: number }) {
  const m = message.toLowerCase();
  let advice = "I can help with that. For a useful answer, focus on your goal, recent routine, sleep, food, hydration and how long the issue has been happening.";

  if (m.includes("weak") || m.includes("low energy") || m.includes("weakness")) {
    advice = "Feeling weaker in the gym can come from several ordinary factors: poor sleep, not eating enough before training, low carbohydrate intake, dehydration, accumulated training fatigue, stress, or an illness starting. First check sleep, fluids and your recent meals, and consider whether you have increased training volume or intensity recently. If the weakness is persistent, worsening, happens outside the gym, or comes with concerning symptoms such as fainting, chest pain or significant breathing trouble, seek medical assessment.";
  } else if (m.includes("protein")) {
    advice = `Protein supports muscle repair and growth, especially when you train regularly. Your current profile-based target is ${macros.protein_g} g/day; spread it across meals rather than trying to consume it all at once. Whole foods such as eggs, dairy, soy, pulses, fish or lean meats can all contribute.`;
  } else if (m.includes("weight loss") || m.includes("lose weight") || m.includes("fat loss")) {
    advice = `For fat loss, consistency matters more than aggressive restriction. Your current profile-based target is about ${calories} kcal/day; pair that with adequate protein, regular activity, resistance training and a sustainable calorie deficit. If energy, training performance or recovery deteriorates significantly, the deficit may be too aggressive.`;
  } else if (m.includes("muscle") || m.includes("gain weight")) {
    advice = `For muscle gain, combine progressive resistance training with enough food, protein and recovery. Your profile-based nutrition target is about ${calories} kcal/day, with ${macros.protein_g} g protein/day; a modest calorie surplus is generally easier to sustain than a very large one.`;
  } else if (m.includes("sore") || m.includes("recovery")) {
    advice = "Normal post-training soreness usually improves with time, light movement, adequate food and fluids, sleep, and sensible training progression. Avoid repeatedly training a very sore muscle hard just to push through it. Severe, unusual, persistent or worsening pain should be assessed professionally.";
  }

  return textResponse(advice, calories, macros);
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
      return resilientFallback(args.message, calories, macros);
    }

    try {
      const schema = getAiSchema();
      const systemPrompt = `${getSystemPrompt()}\n${EXPERT_COACH_PROMPT}`;
      const userPrompt = `${getUserPrompt(JSON.stringify(profile), JSON.stringify(backendCalcs), args.message, JSON.stringify(schema))}\n\nAnswer the user's actual question directly. Informational questions should receive a useful explanation even when no workout plan is requested.`;
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
        return resilientFallback(args.message, calories, macros);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content;
      if (!rawContent) {
        console.error("WellMate Physical AI OpenRouter returned no content");
        return resilientFallback(args.message, calories, macros);
      }

      const parsed = parseAndValidateAiCoachResponse(rawContent);
      return parsed ?? resilientFallback(args.message, calories, macros);
    } catch (error) {
      console.error("WellMate Physical AI error:", error);
      return resilientFallback(args.message, calories, macros);
    }
  },
});

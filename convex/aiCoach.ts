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
      const systemPrompt = getSystemPrompt();
      const userPrompt = getUserPrompt(JSON.stringify(profile), JSON.stringify(backendCalcs), args.message, JSON.stringify(schema));
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
          temperature: 0.2,
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
      return parsed ?? createFallbackResponse(calories, macros);
    } catch (error) {
      console.error("WellMate Physical AI error:", error);
      return createFallbackResponse(calories, macros);
    }
  },
});

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
        JSON.stringify(schema),
      );

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
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
        },
      );

      if (!response.ok) {
        console.error("OpenAI API error:", response.statusText);
        return createFallbackResponse(calories, macros);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content;

      if (!rawContent) {
        return createFallbackResponse(calories, macros);
      }

      const parsed = parseAndValidateAiCoachResponse(rawContent);
      if (!parsed) {
        return createFallbackResponse(calories, macros);
      }

      return parsed;
    } catch (error) {
      console.error("AI coach error:", error);
      return createFallbackResponse(calories, macros);
    }
  },
});

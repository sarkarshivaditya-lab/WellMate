"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import {
  SYSTEM_PROMPT_MENTAL,
  buildMentalUserPrompt,
} from "../src/services/aiMentalPrompts";
import type { AiMentalResponse } from "../src/services/aiMentalTypes";
import {
  detectCrisis,
  buildMoodHistory,
  buildJournalSummary,
  buildPracticesList,
  validateMentalResponse,
  createSafetyFallback,
} from "./_lib/aiMentalHelpers";

const BURST_WINDOW_MS = 60_000;
const BURST_LIMIT = 5;
const DAILY_LIMIT = 20;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS = [
  "openrouter/free",
  "openai/gpt-oss-20b:free",
  "google/gemma-4-26b-a4b-it:free",
];

export const askMentalCoach = action({
  args: { message: v.string() },
  handler: async (ctx, args): Promise<AiMentalResponse> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("UNAUTHENTICATED_MENTAL_AI_ACCESS");

    const user = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!user) throw new Error("USER_RECORD_NOT_FOUND");

    const userId = user._id;
    const today = new Date().toISOString().split("T")[0];
    const now = Date.now();
    const usage = await ctx.runQuery(api.mentalAiUsage.getByUserAndDate, {
      userId,
      dateIso: today,
    });

    if (usage) {
      if (usage.count >= DAILY_LIMIT) throw new Error("MENTAL_AI_DAILY_LIMIT_EXCEEDED");
      if (now - usage.lastCallTs < BURST_WINDOW_MS && usage.count % BURST_LIMIT === 0) {
        throw new Error("MENTAL_AI_RATE_LIMITED");
      }
      await ctx.runMutation(api.mentalAiUsage.increment, { id: usage._id, now });
    } else {
      await ctx.runMutation(api.mentalAiUsage.create, { userId, dateIso: today, now });
    }

    const crisisFromUser = detectCrisis(args.message);
    const moods = await ctx.runQuery(api.moods.listMoods, { limit: 7 });
    const journals = await ctx.runQuery(api.journal.listJournalEntries, { limit: 7 });
    const todayMood = await ctx.runQuery(api.moods.getMoodByDate, { dateIso: today });
    const userPrompt = buildMentalUserPrompt({
      userMessage: args.message,
      moodHistory: buildMoodHistory(moods, todayMood),
      journalSummary: buildJournalSummary(journals),
      practicesList: buildPracticesList(),
    });

    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("WellMate Mental AI: OPENROUTER_API_KEY is not configured");
      return createSafetyFallback("AI service is unavailable. Please reach out to local support resources.", true);
    }

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiKey,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://wellmate-website.vercel.app",
          "X-Title": "WellMate",
        },
        body: JSON.stringify({
          model: "openrouter/free",
          models: OPENROUTER_MODELS.slice(1),
          messages: [
            { role: "system", content: SYSTEM_PROMPT_MENTAL },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
          max_tokens: 900,
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        console.error("WellMate Mental AI OpenRouter error:", response.status, detail.slice(0, 500));
        return createSafetyFallback("The AI service is temporarily unavailable. Please try again shortly.", true);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
        model?: string;
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        console.error("WellMate Mental AI OpenRouter returned no content", data.model ?? "unknown-model");
        return createSafetyFallback("Unable to respond right now.", true);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        console.error("WellMate Mental AI invalid JSON:", parseError);
        return createSafetyFallback("I could not safely format that response. Please try again.", false);
      }
      const validated = validateMentalResponse(parsed);
      return {
        ...validated,
        escalation: validated.escalation || crisisFromUser,
        confidence: validated.escalation || crisisFromUser ? "low" : validated.confidence,
      };
    } catch (error) {
      console.error("WellMate Mental AI error:", error);
      return createSafetyFallback("Something went wrong. You’re not alone.", true);
    }
  },
});

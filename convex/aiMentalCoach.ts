"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import OpenAI from "openai";
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
const BURST_LIMIT = 3;
const DAILY_LIMIT = 20;

export const askMentalCoach = action({
  args: {
    message: v.string(),
  },
  handler: async (ctx, args): Promise<AiMentalResponse> => {
    /* ======================================================
       AUTH (Stage 14.3.2)
       ====================================================== */
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("UNAUTHENTICATED_MENTAL_AI_ACCESS");
    }

    /* ======================================================
       RESOLVE USER
       ====================================================== */
    const user = await ctx.runQuery(api.users.getCurrentUser, {});
    if (!user) {
      throw new Error("USER_RECORD_NOT_FOUND");
    }

    const userId = user._id;
    const today = new Date().toISOString().split("T")[0];
    const now = Date.now();

    /* ======================================================
       RATE LIMITING (Stage 14.3.3)
       ====================================================== */
    const usage = await ctx.runQuery(api.mentalAiUsage.getByUserAndDate, {
      userId,
      dateIso: today,
    });

    if (usage) {
      if (usage.count >= DAILY_LIMIT) {
        throw new Error("MENTAL_AI_DAILY_LIMIT_EXCEEDED");
      }
      if (
        now - usage.lastCallTs < BURST_WINDOW_MS &&
        usage.count % BURST_LIMIT === 0
      ) {
        throw new Error("MENTAL_AI_RATE_LIMITED");
      }
    }

    if (usage) {
      await ctx.runMutation(api.mentalAiUsage.increment, {
        id: usage._id,
        now,
      });
    } else {
      await ctx.runMutation(api.mentalAiUsage.create, {
        userId,
        dateIso: today,
        now,
      });
    }

    /* ======================================================
       CRISIS PRE-CHECK (FAIL-SAFE)
       ====================================================== */
    const crisisFromUser = detectCrisis(args.message);

    /* ======================================================
       CONTEXT BUILD
       ====================================================== */
    const moods = await ctx.runQuery(api.moods.listMoods, { limit: 7 });
    const journals = await ctx.runQuery(api.journal.listJournalEntries, {
      limit: 7,
    });
    const todayMood = await ctx.runQuery(api.moods.getMoodByDate, {
      dateIso: today,
    });

    const userPrompt = buildMentalUserPrompt({
      userMessage: args.message,
      moodHistory: buildMoodHistory(moods, todayMood),
      journalSummary: buildJournalSummary(journals),
      practicesList: buildPracticesList(),
    });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return createSafetyFallback(
        "AI service is unavailable. Please reach out to local support resources.",
        true,
      );
    }

    try {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT_MENTAL },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return createSafetyFallback("Unable to respond right now.", true);
      }

      const parsed = JSON.parse(content);
      const validated = validateMentalResponse(parsed);

      return {
        ...validated,
        escalation: validated.escalation || crisisFromUser,
        confidence:
          validated.escalation || crisisFromUser ? "low" : validated.confidence,
      };
    } catch (error) {
      console.error("AI Mental Coach error:", error);
      return createSafetyFallback(
        "Something went wrong. You’re not alone.",
        true,
      );
    }
  },
});

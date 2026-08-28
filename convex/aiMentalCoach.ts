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

function technicalFallback(message: string, crisisFromUser: boolean): AiMentalResponse {
  return createSafetyFallback(message, crisisFromUser);
}

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
    const crisisFromUser = detectCrisis(args.message);
    const usage = await ctx.runQuery(api.mentalAiUsage.getByUserAndDate, {
      userId,
      dateIso: today,
    });

    if (usage) {
      if (usage.count >= DAILY_LIMIT) {
        return technicalFallback("You’ve reached today’s AI limit. Please try again tomorrow.", crisisFromUser);
      }
      if (now - usage.lastCallTs < BURST_WINDOW_MS && usage.count % BURST_LIMIT === 0) {
        return technicalFallback("I’m taking a short pause. Please try again in a moment.", crisisFromUser);
      }
      await ctx.runMutation(api.mentalAiUsage.increment, { id: usage._id, now });
    } else {
      await ctx.runMutation(api.mentalAiUsage.create, { userId, dateIso: today, now });
    }

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
      return technicalFallback("AI service is unavailable right now. Please try again shortly.", crisisFromUser);
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
          messages: [
            { role: "system", content: SYSTEM_PROMPT_MENTAL },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 900,
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        console.error("WellMate Mental AI OpenRouter error:", response.status, detail.slice(0, 500));
        return technicalFallback("The AI service is temporarily unavailable. Please try again shortly.", crisisFromUser);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
        model?: string;
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        console.error("WellMate Mental AI OpenRouter returned no content", data.model ?? "unknown-model");
        return technicalFallback("I’m unable to answer right now. Please try again shortly.", crisisFromUser);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        console.error("WellMate Mental AI invalid JSON:", parseError);
        return technicalFallback("I couldn’t format that response safely. Please try again.", crisisFromUser);
      }

      const validated = validateMentalResponse(parsed);
      return {
        ...validated,
        escalation: validated.escalation || crisisFromUser,
        confidence: validated.escalation || crisisFromUser ? "low" : validated.confidence,
      };
    } catch (error) {
      console.error("WellMate Mental AI error:", error);
      return technicalFallback("Something went wrong while connecting to WellMate AI. Please try again.", crisisFromUser);
    }
  },
});

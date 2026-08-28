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
  getDefaultPractice,
} from "./_lib/aiMentalHelpers";

const BURST_WINDOW_MS = 60_000;
const BURST_LIMIT = 5;
const DAILY_LIMIT = 20;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS = [
  "openrouter/free",
  "google/gemma-4-26b-a4b-it:free",
  "openai/gpt-oss-20b:free",
];

function technicalFallback(message: string, crisisFromUser: boolean): AiMentalResponse {
  return createSafetyFallback(message, crisisFromUser);
}

function extractJsonObject(content: string): unknown | null {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as unknown;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    } catch {
      return null;
    }
  }
}

function plainTextResponse(content: string): AiMentalResponse {
  const summary = content
    .replace(/^```(?:text|markdown)?/i, "")
    .replace(/```$/i, "")
    .trim();

  return {
    summary: summary || "I'm here with you. Tell me a little more about what's going on.",
    emotion: "calm",
    suggestions: [],
    practice: getDefaultPractice(),
    escalation: false,
    confidence: "medium",
  };
}

async function requestOpenRouter(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  structured: boolean,
): Promise<{ content: string; model?: string } | null> {
  const body: Record<string, unknown> = {
    model: "openrouter/free",
    models: OPENROUTER_MODELS.slice(1),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: 900,
  };

  if (structured) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: "wellmate_mental_response",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            summary: { type: "string" },
            emotion: { type: "string", enum: ["calm", "stressed", "anxious", "sad", "content", "frustrated", "overwhelmed", "hopeful"] },
            suggestions: { type: "array", items: { type: "string" } },
            practice: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                steps: { type: "array", items: { type: "string" } },
              },
              required: ["id", "title", "steps"],
            },
            escalation: { type: "boolean" },
            confidence: { type: "string", enum: ["low", "medium", "high"] },
          },
          required: ["summary", "emotion", "suggestions", "practice", "escalation", "confidence"],
        },
      },
    };
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://wellmate-website.vercel.app",
      "X-Title": "WellMate",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("WellMate Mental AI OpenRouter error:", response.status, detail.slice(0, 800));
    return null;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    model?: string;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) return null;
  return { content, model: data.model };
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
    const usage = await ctx.runQuery(api.mentalAiUsage.getByUserAndDate, { userId, dateIso: today });

    if (usage) {
      if (usage.count >= DAILY_LIMIT) return technicalFallback("You've reached today's AI limit. Please try again tomorrow.", crisisFromUser);
      if (now - usage.lastCallTs < BURST_WINDOW_MS && usage.count % BURST_LIMIT === 0) return technicalFallback("I'm taking a short pause. Please try again in a moment.", crisisFromUser);
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
    if (!apiKey) return technicalFallback("AI service is unavailable right now. Please try again shortly.", crisisFromUser);

    try {
      let result = await requestOpenRouter(apiKey, SYSTEM_PROMPT_MENTAL, userPrompt, true);

      if (!result) {
        console.warn("WellMate Mental AI structured request failed; retrying with plain text output");
        result = await requestOpenRouter(apiKey, SYSTEM_PROMPT_MENTAL, userPrompt, false);
      }

      if (!result) return technicalFallback("The AI service is temporarily unavailable. Please try again shortly.", crisisFromUser);

      const parsed = extractJsonObject(result.content);
      const validated = parsed ? validateMentalResponse(parsed) : plainTextResponse(result.content);
      const escalation = crisisFromUser || validated.escalation;

      return {
        ...validated,
        escalation,
        confidence: escalation ? "low" : validated.confidence,
      };
    } catch (error) {
      console.error("WellMate Mental AI error:", error);
      return technicalFallback("Something went wrong while connecting to WellMate AI. Please try again.", crisisFromUser);
    }
  },
});

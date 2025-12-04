"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import OpenAI from "openai";
import { SYSTEM_PROMPT_MENTAL, buildMentalUserPrompt } from "../src/services/aiMentalPrompts";
import aiMentalSchema from "../src/services/aiMentalSchema.json";
import type { AiMentalResponse } from "../src/services/aiMentalTypes";
import practicesData from "../src/data/practices.json";

export const askMentalCoach = action({
  args: {
    message: v.string(),
  },
  handler: async (ctx, args): Promise<AiMentalResponse> => {
    // Get user identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return createSafetyFallback("Please sign in to use the AI Mental Coach.");
    }

    // Fetch recent mood and journal data
    const moods = await ctx.runQuery(api.moods.listMoods, { limit: 7 });
    const journals = await ctx.runQuery(api.journal.listJournalEntries, { limit: 7 });
    const today = new Date().toISOString().split("T")[0];
    const todayMood = await ctx.runQuery(api.moods.getMoodByDate, { dateIso: today });

    // Build mood history summary
    const moodHistory = buildMoodHistory(moods, todayMood);
    
    // Build journal summary
    const journalSummary = buildJournalSummary(journals);
    
    // Build practices list
    const practicesList = buildPracticesList();

    // Build user prompt
    const userPrompt = buildMentalUserPrompt({
      userMessage: args.message,
      moodHistory,
      journalSummary,
      practicesList,
    });

    // Call OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return createSafetyFallback("AI service not configured. Please contact support.");
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
        return createSafetyFallback("Unable to generate response. Please try again.");
      }

      // Parse and validate response
      const parsed = JSON.parse(content);
      const validated = validateMentalResponse(parsed);
      
      return validated;
    } catch (error) {
      console.error("AI Mental Coach error:", error);
      return createSafetyFallback("An error occurred. Please try again later.");
    }
  },
});

interface MoodData {
  moodValue: number;
  note?: string;
  dateIso: string;
}

function buildMoodHistory(moods: MoodData[], todayMood: MoodData | null): string {
  if (moods.length === 0 && !todayMood) {
    return "No mood data available yet.";
  }

  const moodLabels = ["very low", "low", "okay", "good", "excellent"];
  const moodValues = moods.map((m) => m.moodValue);
  const average = moodValues.length > 0 
    ? (moodValues.reduce((sum, val) => sum + val, 0) / moodValues.length).toFixed(1)
    : "N/A";

  let summary = `Average mood (last 7 days): ${average}/5. `;
  
  if (todayMood) {
    summary += `Today's mood: ${moodLabels[todayMood.moodValue - 1]}. `;
    if (todayMood.note) {
      summary += `Note: "${todayMood.note}". `;
    }
  }

  // Detect patterns
  if (moodValues.length >= 3) {
    const lowCount = moodValues.filter((v) => v <= 2).length;
    if (lowCount >= 2) {
      summary += "Pattern: Multiple low mood days detected. ";
    }
  }

  return summary;
}

interface JournalData {
  tags: string[];
  text: string;
  dateIso: string;
}

function buildJournalSummary(journals: JournalData[]): string {
  if (journals.length === 0) {
    return "No recent journal entries.";
  }

  const allTags = journals.flatMap((j) => j.tags);
  const tagCounts: Record<string, number> = {};
  allTags.forEach((tag) => {
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  });

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map((entry) => entry[0]);

  let summary = `Recent journal entries: ${journals.length}. `;
  if (topTags.length > 0) {
    summary += `Common themes: ${topTags.join(", ")}. `;
  }

  return summary;
}

function buildPracticesList(): string {
  const practices = practicesData.map((p) => ({
    id: p.id,
    title: p.title,
    type: p.type,
  }));

  return JSON.stringify(practices, null, 2);
}

function validateMentalResponse(parsed: unknown): AiMentalResponse {
  // Basic validation
  if (!parsed || typeof parsed !== "object") {
    return createSafetyFallback("Invalid response format.");
  }
  
  const obj = parsed as Record<string, unknown>;

  // Ensure required fields exist
  const validated: AiMentalResponse = {
    summary: typeof obj.summary === "string" ? obj.summary : "I'm here to support you.",
    emotion: (typeof obj.emotion === "string" && ["calm", "stressed", "anxious", "sad", "content", "frustrated", "overwhelmed", "hopeful"].includes(obj.emotion)) 
      ? obj.emotion as AiMentalResponse["emotion"]
      : "calm",
    suggestions: Array.isArray(obj.suggestions) 
      ? obj.suggestions.filter((s): s is string => typeof s === "string").slice(0, 3) 
      : ["Take a few deep breaths", "Be kind to yourself", "Consider journaling your thoughts"],
    practice: (obj.practice && typeof obj.practice === "object") ? obj.practice as AiMentalResponse["practice"] : getDefaultPractice(),
    escalation: obj.escalation === true,
    confidence: (typeof obj.confidence === "string" && ["low", "medium", "high"].includes(obj.confidence))
      ? obj.confidence as AiMentalResponse["confidence"]
      : "medium",
  };

  return validated;
}

function getDefaultPractice() {
  const defaultPractice = practicesData.find((p) => p.id === "p1") || practicesData[0];
  return {
    id: defaultPractice.id,
    title: defaultPractice.title,
    steps: defaultPractice.steps,
  };
}

function createSafetyFallback(message: string): AiMentalResponse {
  return {
    summary: message,
    emotion: "calm",
    suggestions: [
      "Take a moment to breathe deeply",
      "Consider reaching out to a trusted friend",
      "Remember to be kind to yourself",
    ],
    practice: getDefaultPractice(),
    escalation: false,
    confidence: "low",
  };
}

"use node";

import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api } from "./_generated/api";
import { detectCrisis } from "./_lib/aiMentalHelpers";

type WellMateChatResponse =
  | { domain: "mental"; payload: unknown }
  | { domain: "physical"; payload: unknown }
  | { domain: "clarify"; payload: { question: string; options?: string[] } };

function containsAny(message: string, terms: string[]): boolean {
  const m = message.toLowerCase();
  return terms.some((term) => m.includes(term));
}

function classifyIntent(message: string): "mental" | "physical" | "general" | "safety" {
  if (detectCrisis(message)) return "safety";

  const mental = containsAny(message, [
    "stress", "stressed", "anxiety", "anxious", "panic", "depressed",
    "depression", "sad", "overwhelmed", "burnout", "lonely", "hopeless",
    "emotionally", "mental health", "feel down", "feeling low", "motivation",
    "unmotivated", "frustrated", "angry", "upset", "worried", "worry",
    "can't cope", "cannot cope", "just want to talk", "long day", "tired",
    "fatigue", "exhausted", "low energy", "can't sleep", "cannot sleep",
  ]);

  const physical = containsAny(message, [
    "workout", "exercise", "gym", "diet", "calorie", "protein",
    "lose weight", "gain muscle", "fat loss", "training", "meal",
    "nutrition", "hydration", "water", "steps", "walking", "running",
    "strength", "cardio", "recipe", "breakfast", "lunch", "dinner",
    "sore", "recovery", "rest day", "sets", "reps", "lift", "lifting",
  ]);

  if (mental && !physical) return "mental";
  if (physical && !mental) return "physical";
  if (mental && physical) return "general";
  return "general";
}

export const chat = action({
  args: { message: v.string() },
  handler: async (ctx, { message }): Promise<WellMateChatResponse> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("UNAUTHENTICATED");

    const intent = classifyIntent(message);

    if (intent === "safety" || intent === "mental") {
      return {
        domain: "mental",
        payload: await ctx.runAction(api.aiMentalCoach.askMentalCoach, { message }),
      };
    }

    if (intent === "physical") {
      return {
        domain: "physical",
        payload: await ctx.runAction(api.aiCoach.chat, { message }),
      };
    }

    return {
      domain: "clarify",
      payload: {
        question: "I can help with wellbeing, sleep, fitness, nutrition, or just talking things through. What would be most useful right now?",
        options: ["Mental wellbeing", "Fitness & nutrition"],
      },
    };
  },
});

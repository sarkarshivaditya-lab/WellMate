"use node";

import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api } from "./_generated/api";
import { detectCrisis } from "./_lib/aiMentalHelpers";

type WellMateChatResponse =
  | { domain: "mental"; payload: unknown }
  | { domain: "physical"; payload: unknown }
  | { domain: "emergency"; payload: { title: string; message: string; emergencyNumber: string } }
  | { domain: "clarify"; payload: { question: string; options?: string[] } };

function containsAny(message: string, terms: string[]): boolean {
  const m = message.toLowerCase();
  return terms.some((term) => m.includes(term));
}

function detectEmergency(message: string): boolean {
  return containsAny(message, [
    "i had an accident",
    "i've had an accident",
    "i have had an accident",
    "there was an accident",
    "road accident",
    "car accident",
    "bike accident",
    "motorcycle accident",
    "i crashed",
    "we crashed",
    "car crash",
    "bike crash",
    "motorcycle crash",
    "collision",
    "i was hit",
    "got hit by a car",
    "got hit by a bike",
    "i am injured",
    "i'm injured",
    "seriously injured",
    "severely injured",
    "i am bleeding",
    "i'm bleeding",
    "bleeding heavily",
    "unconscious",
    "not breathing",
    "can't breathe",
    "cannot breathe",
    "choking",
    "severe injury",
    "badly hurt",
    "seriously hurt",
    "i fell badly",
    "trapped in",
    "trapped inside",
  ]);
}

function classifyIntent(message: string): "mental" | "physical" | "general" | "safety" | "emergency" {
  if (detectEmergency(message)) return "emergency";
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

    if (intent === "emergency") {
      return {
        domain: "emergency",
        payload: {
          title: "Golden Hour activated",
          message: "This sounds like an emergency. WellMate has switched this conversation into Golden Hour mode. Move to safety if you can, contact emergency services, and use the emergency actions below. Do not wait for an AI response if someone is seriously injured or in immediate danger.",
          emergencyNumber: "112",
        },
      };
    }

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

"use node";

import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api } from "./_generated/api";
import { detectCrisis } from "./_lib/aiMentalHelpers";

type WellMateChatResponse =
  | { domain: "mental"; payload: unknown }
  | { domain: "physical"; payload: unknown }
  | { domain: "clarify"; payload: { question: string; options?: string[] } };

function hasMentalSignals(message: string): boolean {
  const m = message.toLowerCase();
  return (
    detectCrisis(message) ||
    m.includes("stress") ||
    m.includes("anxiety") ||
    m.includes("panic") ||
    m.includes("depressed") ||
    m.includes("depression") ||
    m.includes("sad") ||
    m.includes("overwhelmed") ||
    m.includes("burnout") ||
    m.includes("lonely") ||
    m.includes("hopeless") ||
    m.includes("emotionally") ||
    m.includes("mental health")
  );
}

function hasPhysicalSignals(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("workout") ||
    m.includes("exercise") ||
    m.includes("gym") ||
    m.includes("diet") ||
    m.includes("calorie") ||
    m.includes("protein") ||
    m.includes("lose weight") ||
    m.includes("gain muscle") ||
    m.includes("fat loss") ||
    m.includes("training") ||
    m.includes("tired") ||
    m.includes("fatigue") ||
    m.includes("exhausted") ||
    m.includes("low energy") ||
    m.includes("sleep") ||
    m.includes("sleeping") ||
    m.includes("wake up") ||
    m.includes("waking up") ||
    m.includes("nutrition") ||
    m.includes("meal") ||
    m.includes("hydration") ||
    m.includes("water")
  );
}

export const chat = action({
  args: { message: v.string() },
  handler: async (ctx, { message }): Promise<WellMateChatResponse> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("UNAUTHENTICATED");

    const mental = hasMentalSignals(message);
    const physical = hasPhysicalSignals(message);

    if ((mental && physical) || (!mental && !physical)) {
      return {
        domain: "clarify",
        payload: {
          question: "I can help with both mental wellbeing and physical health. What would you like to focus on right now?",
          options: ["Mental wellbeing", "Fitness & nutrition"],
        },
      };
    }

    if (mental) {
      return {
        domain: "mental",
        payload: await ctx.runAction(api.aiMentalCoach.askMentalCoach, { message }),
      };
    }

    return {
      domain: "physical",
      payload: await ctx.runAction(api.aiCoach.chat, { message }),
    };
  },
});

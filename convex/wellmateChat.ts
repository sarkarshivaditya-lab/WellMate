"use node";

import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api } from "./_generated/api";
import { detectCrisis } from "./_lib/aiMentalHelpers";

/* ======================================================
   TYPES
   ====================================================== */

type WellMateChatResponse =
  | {
      domain: "mental";
      payload: unknown;
    }
  | {
      domain: "physical";
      payload: unknown;
    }
  | {
      domain: "clarify";
      payload: {
        question: string;
        options?: string[];
      };
    };

/* ======================================================
   INTENT HEURISTICS (STAGE 18B)
   ====================================================== */

function hasMentalSignals(message: string): boolean {
  const m = message.toLowerCase();

  return (
    detectCrisis(message) ||
    m.includes("stress") ||
    m.includes("anxiety") ||
    m.includes("panic") ||
    m.includes("depressed") ||
    m.includes("sad") ||
    m.includes("overwhelmed") ||
    m.includes("burnout") ||
    m.includes("lonely") ||
    m.includes("hopeless")
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
    m.includes("training")
  );
}

/* ======================================================
   ROUTER ACTION (STAGE 18B)
   ====================================================== */

export const chat = action({
  args: { message: v.string() },

  handler: async (
    ctx,
    { message },
  ): Promise<WellMateChatResponse> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("UNAUTHENTICATED");
    }

    const mental = hasMentalSignals(message);
    const physical = hasPhysicalSignals(message);

    /* ----------------------------------
       AMBIGUOUS / MIXED → CLARIFY
       ---------------------------------- */
    if (
      (mental && physical) ||
      (!mental && !physical)
    ) {
      return {
        domain: "clarify",
        payload: {
          question:
            "I can help with both mental wellbeing and physical health. What would you like to focus on right now?",
          options: ["Mental wellbeing", "Fitness & nutrition"],
        },
      };
    }

    /* ----------------------------------
       MENTAL
       ---------------------------------- */
    if (mental) {
      const mentalResponse = await ctx.runAction(
        api.aiMentalCoach.askMentalCoach,
        { message },
      );

      return {
        domain: "mental",
        payload: mentalResponse,
      };
    }

    /* ----------------------------------
       PHYSICAL
       ---------------------------------- */
    const physicalResponse = await ctx.runAction(
      api.aiCoach.chat,
      { message },
    );

    return {
      domain: "physical",
      payload: physicalResponse,
    };
  },
});

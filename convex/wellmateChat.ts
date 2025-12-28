import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";

export const chat = action({
  args: { message: v.string() },
  handler: async (ctx, { message }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("UNAUTHENTICATED");

    // 1. Lightweight intent classification (placeholder)
    // 2. If mental → mental path (to be implemented later)
    // 3. Else → physical path (to be implemented later)

    return {
      domain: "mental" as "mental" | "physical",
      payload: {},
    };
  },
});

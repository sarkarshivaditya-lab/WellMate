import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get Mental AI usage record for a user on a given date.
 */
export const getByUserAndDate = query({
  args: {
    userId: v.id("users"),
    dateIso: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mentalAiUsage")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", args.userId).eq("dateIso", args.dateIso),
      )
      .first();
  },
});

/**
 * Create a new Mental AI usage record for today.
 */
export const create = mutation({
  args: {
    userId: v.id("users"),
    dateIso: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("mentalAiUsage", {
      userId: args.userId,
      dateIso: args.dateIso,
      count: 1,
      lastCallTs: args.now,
    });
  },
});

/**
 * Increment usage count and update last call timestamp.
 */
export const increment = mutation({
  args: {
    id: v.id("mentalAiUsage"),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.id);
    if (!record) {
      throw new Error("MENTAL_AI_USAGE_RECORD_NOT_FOUND");
    }

    await ctx.db.patch(args.id, {
      count: record.count + 1,
      lastCallTs: args.now,
    });
  },
});

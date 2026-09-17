import { ConvexError, v } from "convex/values";
import { query, mutation } from "./_generated/server";

async function getCurrentUser(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "User not authenticated",
    });
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();

  if (!user) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "User not found",
    });
  }

  return user;
}

export const getByUserAndDate = query({
  args: {
    userId: v.id("users"),
    dateIso: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (user._id !== args.userId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot access another user's AI usage record",
      });
    }

    return await ctx.db
      .query("mentalAiUsage")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", user._id).eq("dateIso", args.dateIso),
      )
      .first();
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    dateIso: v.string(),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (user._id !== args.userId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot create another user's AI usage record",
      });
    }

    return await ctx.db.insert("mentalAiUsage", {
      userId: user._id,
      dateIso: args.dateIso,
      count: 1,
      lastCallTs: args.now,
    });
  },
});

export const increment = mutation({
  args: {
    id: v.id("mentalAiUsage"),
    now: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    const record = await ctx.db.get(args.id);
    if (!record) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Mental AI usage record not found",
      });
    }
    if (record.userId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot modify another user's AI usage record",
      });
    }

    await ctx.db.patch(args.id, {
      count: record.count + 1,
      lastCallTs: args.now,
    });
  },
});

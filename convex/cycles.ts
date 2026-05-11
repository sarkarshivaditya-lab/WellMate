import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const addCycle = mutation({
  args: {
    startDateIso: v.string(),
    lengthDays: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }
    const existing = await ctx.db
      .query("cycles")
      .withIndex("by_user_and_start", (q) =>
        q.eq("userId", user._id).eq("startDateIso", args.startDateIso),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lengthDays: args.lengthDays,
        notes: args.notes,
      });
      return existing._id;
    }

    return await ctx.db.insert("cycles", {
      userId: user._id,
      ...args,
    });
  },
});

export const getCycles = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }
    return await ctx.db
      .query("cycles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const deleteCycle = mutation({
  args: { cycleId: v.id("cycles") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }
    const cycle = await ctx.db.get(args.cycleId);
    if (!cycle) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Cycle not found",
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user || cycle.userId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot delete another user's cycle",
      });
    }
    await ctx.db.delete(args.cycleId);
  },
});

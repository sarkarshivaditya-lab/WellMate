import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

export const addSleepLog = mutation({
  args: {
    startIso: v.string(),
    endIso: v.string(),
    rating: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
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
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    const existing = await ctx.db
      .query("sleepLogs")
      .withIndex("by_user_and_start", (q) =>
        q.eq("userId", user._id).eq("startIso", args.startIso),
      )
      .first();

    const durationMin = Math.round(
      (new Date(args.endIso).getTime() - new Date(args.startIso).getTime()) /
        60000,
    );

    if (existing) {
      await ctx.db.patch(existing._id, {
        endIso: args.endIso,
        durationMin,
        rating: args.rating,
        notes: args.notes,
      });
      return existing._id;
    }

    const sleepId = await ctx.db.insert("sleepLogs", {
      userId: user._id,
      startIso: args.startIso,
      endIso: args.endIso,
      durationMin,
      rating: args.rating,
      notes: args.notes,
    });

    return sleepId;
  },
});

export const updateSleepLog = mutation({
  args: {
    sleepId: v.id("sleepLogs"),
    startIso: v.optional(v.string()),
    endIso: v.optional(v.string()),
    rating: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
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
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    const sleep = await ctx.db.get(args.sleepId);
    if (!sleep || sleep.userId !== user._id) {
      throw new ConvexError({
        message: "Sleep log not found or unauthorized",
        code: "FORBIDDEN",
      });
    }

    const updates: Record<string, unknown> = {};
    if (args.startIso !== undefined) updates.startIso = args.startIso;
    if (args.endIso !== undefined) updates.endIso = args.endIso;
    if (args.rating !== undefined) updates.rating = args.rating;
    if (args.notes !== undefined) updates.notes = args.notes;

    // Recalculate duration if times changed
    const newStart = args.startIso || sleep.startIso;
    const newEnd = args.endIso || sleep.endIso;
    const start = new Date(newStart);
    const end = new Date(newEnd);
    updates.durationMin = Math.round((end.getTime() - start.getTime()) / 60000);

    await ctx.db.patch(args.sleepId, updates);
  },
});

export const deleteSleepLog = mutation({
  args: { sleepId: v.id("sleepLogs") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
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
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    const sleep = await ctx.db.get(args.sleepId);
    if (!sleep || sleep.userId !== user._id) {
      throw new ConvexError({
        message: "Sleep log not found or unauthorized",
        code: "FORBIDDEN",
      });
    }

    await ctx.db.delete(args.sleepId);
  },
});

export const listSleepByRange = query({
  args: {
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
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
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    const allSleep = await ctx.db
      .query("sleepLogs")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Filter by date range
    const filtered = allSleep.filter((sleep) => {
      const sleepDate = sleep.startIso.split("T")[0];
      return sleepDate >= args.startDate && sleepDate <= args.endDate;
    });

    return filtered.sort((a, b) => b.startIso.localeCompare(a.startIso));
  },
});

export const getRecentSleep = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
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
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    const days = args.days || 7;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffIso = cutoff.toISOString().split("T")[0];

    const allSleep = await ctx.db
      .query("sleepLogs")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const recent = allSleep.filter((sleep) => {
      const sleepDate = sleep.startIso.split("T")[0];
      return sleepDate >= cutoffIso;
    });

    return recent.sort((a, b) => b.startIso.localeCompare(a.startIso));
  },
});

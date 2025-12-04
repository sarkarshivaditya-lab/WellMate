import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

export const addMood = mutation({
  args: {
    dateIso: v.string(),
    moodValue: v.number(),
    note: v.optional(v.string()),
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
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    // Check if mood already exists for this date
    const existing = await ctx.db
      .query("moods")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", user._id).eq("dateIso", args.dateIso)
      )
      .first();

    if (existing) {
      // Update existing mood
      await ctx.db.patch(existing._id, {
        moodValue: args.moodValue,
        note: args.note,
      });
      return existing._id;
    }

    // Create new mood
    const moodId = await ctx.db.insert("moods", {
      userId: user._id,
      dateIso: args.dateIso,
      moodValue: args.moodValue,
      note: args.note,
    });

    return moodId;
  },
});

export const getMoodByDate = query({
  args: { dateIso: v.string() },
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
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    const mood = await ctx.db
      .query("moods")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", user._id).eq("dateIso", args.dateIso)
      )
      .first();

    return mood;
  },
});

export const listMoods = query({
  args: { limit: v.optional(v.number()) },
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
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    const moods = await ctx.db
      .query("moods")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(args.limit || 30);

    return moods;
  },
});

export const deleteMood = mutation({
  args: { moodId: v.id("moods") },
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
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      throw new ConvexError({
        message: "User not found",
        code: "NOT_FOUND",
      });
    }

    const mood = await ctx.db.get(args.moodId);
    if (!mood || mood.userId !== user._id) {
      throw new ConvexError({
        message: "Mood not found or unauthorized",
        code: "FORBIDDEN",
      });
    }

    await ctx.db.delete(args.moodId);
  },
});

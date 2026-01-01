import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const addExercise = mutation({
  args: {
    dateIso: v.string(),
    type: v.string(),
    name: v.string(),
    setsJson: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    caloriesBurnedEst: v.optional(v.number()),
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
    return await ctx.db.insert("exercises", {
      userId: user._id,
      ...args,
    });
  },
});

export const getExercisesByDate = query({
  args: { dateIso: v.string() },
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
        code: "NOT_FOUND",
        message: "User not found",
      });
    }
    return await ctx.db
      .query("exercises")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", user._id).eq("dateIso", args.dateIso),
      )
      .collect();
  },
});

export const deleteExercise = mutation({
  args: { exerciseId: v.id("exercises") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }
    const exercise = await ctx.db.get(args.exerciseId);
    if (!exercise) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Exercise not found",
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user || exercise.userId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot delete another user's exercise",
      });
    }
    await ctx.db.delete(args.exerciseId);
  },
});

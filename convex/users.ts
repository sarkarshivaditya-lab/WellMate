import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

/* =========================
   UPDATE / CREATE USER
   ========================= */

export const updateCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not authenticated",
      });
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (user !== null) {
      return user._id;
    }

    return await ctx.db.insert("users", {
      name: identity.name,
      email: identity.email,
      tokenIdentifier: identity.tokenIdentifier,
      hasCompletedOnboarding: false,
    });
  },
});

/* =========================
   GET CURRENT USER
   ========================= */

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    return user;
  },
});

/* =========================
   COMPLETE ONBOARDING
   ========================= */

export const completeOnboarding = mutation({
  args: {
    dob: v.optional(v.string()),
    sex: v.optional(
      v.union(v.literal("male"), v.literal("female"), v.literal("other")),
    ),
    heightCm: v.optional(v.number()),
    weightKg: v.optional(v.number()),
    activityLevel: v.optional(
      v.union(
        v.literal("sedentary"),
        v.literal("light"),
        v.literal("moderate"),
        v.literal("active"),
        v.literal("veryActive"),
      ),
    ),
    goal: v.optional(
      v.union(v.literal("lose"), v.literal("maintain"), v.literal("gain")),
    ),
    dietaryPreference: v.optional(v.string()),
    allergies: v.optional(v.array(v.string())),
    periodTrackingEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not authenticated",
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
        message: "User record not found",
      });
    }

    // 🔒 Idempotency: onboarding is write-once
    if (user.hasCompletedOnboarding === true) {
      return user._id;
    }

    // Apply only defined fields (schema-safe)
    const patch: Record<string, unknown> = {
      hasCompletedOnboarding: true,
    };

    if (args.dob !== undefined) patch.dob = args.dob;
    if (args.sex !== undefined) patch.sex = args.sex;
    if (args.heightCm !== undefined) patch.heightCm = args.heightCm;
    if (args.weightKg !== undefined) patch.weightKg = args.weightKg;
    if (args.activityLevel !== undefined)
      patch.activityLevel = args.activityLevel;
    if (args.goal !== undefined) patch.goal = args.goal;
    if (args.dietaryPreference !== undefined)
      patch.dietaryPreference = args.dietaryPreference;
    if (args.allergies !== undefined) patch.allergies = args.allergies;
    if (args.periodTrackingEnabled !== undefined)
      patch.periodTrackingEnabled = args.periodTrackingEnabled;

    await ctx.db.patch(user._id, patch);

    return user._id;
  },
});

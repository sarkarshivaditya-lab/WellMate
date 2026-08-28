import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";

const sexValidator = v.optional(
  v.union(v.literal("male"), v.literal("female"), v.literal("other")),
);

const activityValidator = v.optional(
  v.union(
    v.literal("sedentary"),
    v.literal("light"),
    v.literal("moderate"),
    v.literal("active"),
    v.literal("veryActive"),
  ),
);

const goalValidator = v.optional(
  v.union(
    v.literal("lose"),
    v.literal("maintain"),
    v.literal("gain"),
  ),
);

const trackingValidator = v.optional(
  v.union(v.literal("automatic"), v.literal("manual")),
);

const profileArgs = {
  dob: v.optional(v.string()),
  sex: sexValidator,
  heightCm: v.optional(v.number()),
  weightKg: v.optional(v.number()),
  activityLevel: activityValidator,
  goal: goalValidator,
  dietaryPreference: v.optional(v.string()),
  allergies: v.optional(v.array(v.string())),
  periodTrackingEnabled: v.optional(v.boolean()),
  dailySteps: v.optional(v.string()),
  weightGoal: v.optional(v.string()),
  muscleGoal: v.optional(v.string()),
  cycleLength: v.optional(v.number()),
  lastPeriod: v.optional(v.string()),
  additionalHealthNotes: v.optional(v.string()),
  bloodType: v.optional(v.string()),
  emergencyContactName: v.optional(v.string()),
  emergencyContactPhone: v.optional(v.string()),
  localAmbulanceNumber: v.optional(v.string()),
  trackingMode: trackingValidator,
};

async function getIdentity(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "User not authenticated",
    });
  }

  return identity;
}

async function getCurrentUserDoc(ctx: any, identity: any) {
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q: any) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
}

export const updateCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await getIdentity(ctx);
    const user = await getCurrentUserDoc(ctx, identity);

    if (user) {
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

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return null;
    }

    return await getCurrentUserDoc(ctx, identity);
  },
});

export const completeOnboarding = mutation({
  args: profileArgs,
  handler: async (ctx, args) => {
    const identity = await getIdentity(ctx);
    let user = await getCurrentUserDoc(ctx, identity);

    if (!user) {
      const userId = await ctx.db.insert("users", {
        name: identity.name,
        email: identity.email,
        tokenIdentifier: identity.tokenIdentifier,
        hasCompletedOnboarding: false,
      });

      user = await ctx.db.get(userId);
    }

    if (!user) {
      throw new ConvexError({
        code: "INTERNAL_ERROR",
        message: "Unable to initialize user record",
      });
    }

    const patch: Record<string, unknown> = {
      hasCompletedOnboarding: true,
    };

    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    await ctx.db.patch(user._id, patch);

    return user._id;
  },
});

export const updateUserProfile = mutation({
  args: profileArgs,
  handler: async (ctx, args) => {
    const identity = await getIdentity(ctx);
    const user = await getCurrentUserDoc(ctx, identity);

    if (!user) {
      return;
    }

    const patch: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(args)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(user._id, patch);
    }
  },
});

export const setPeriodTracking = mutation({
  args: {
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await getIdentity(ctx);
    const user = await getCurrentUserDoc(ctx, identity);

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    await ctx.db.patch(user._id, {
      periodTrackingEnabled: args.enabled,
    });
  },
});

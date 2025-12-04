import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

export const getSubscription = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();

    if (!user) {
      return null;
    }

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // If no subscription exists, return free tier
    if (!subscription) {
      return {
        tier: "free" as const,
        status: "active" as const,
        provider: "mock" as const,
        expiresAt: null,
      };
    }

    return subscription;
  },
});

export const setSubscriptionStub = mutation({
  args: {
    tier: v.union(v.literal("free"), v.literal("pro")),
    status: v.optional(v.union(v.literal("active"), v.literal("past_due"), v.literal("inactive"))),
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

    // Check for existing subscription
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const status = args.status || "active";
    const expiresAt = args.tier === "pro" 
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() 
      : undefined;

    if (existing) {
      await ctx.db.patch(existing._id, {
        tier: args.tier,
        status,
        expiresAt,
      });
      return existing._id;
    }

    const subId = await ctx.db.insert("subscriptions", {
      userId: user._id,
      provider: "mock",
      status,
      tier: args.tier,
      expiresAt,
      metadata: JSON.stringify({ dev: true }),
    });

    return subId;
  },
});

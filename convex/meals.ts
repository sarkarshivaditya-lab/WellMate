import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const addMeal = mutation({
  args: {
    dateIso: v.string(),
    name: v.string(),
    inputMode: v.union(v.literal("detailed"), v.literal("quick")),
    totalCalories: v.number(),
    totalProteinG: v.number(),
    totalFatG: v.number(),
    totalCarbsG: v.number(),
    micronutrientsJson: v.optional(v.string()),
    sourceAdapter: v.optional(v.string()),
    items: v.array(
      v.object({
        name: v.string(),
        calories: v.number(),
        proteinG: v.number(),
        fatG: v.number(),
        carbsG: v.number(),
        micronutrientsJson: v.optional(v.string()),
        quantity: v.number(),
        unit: v.string(),
      }),
    ),
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
    const mealId = await ctx.db.insert("meals", {
      userId: user._id,
      dateIso: args.dateIso,
      name: args.name,
      inputMode: args.inputMode,
      totalCalories: args.totalCalories,
      totalProteinG: args.totalProteinG,
      totalFatG: args.totalFatG,
      totalCarbsG: args.totalCarbsG,
      micronutrientsJson: args.micronutrientsJson,
      sourceAdapter: args.sourceAdapter,
    });
    for (const item of args.items) {
      await ctx.db.insert("mealItems", {
        mealId,
        ...item,
      });
    }
    return mealId;
  },
});

export const getMealsByDate = query({
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
    const meals = await ctx.db
      .query("meals")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", user._id).eq("dateIso", args.dateIso),
      )
      .collect();
    const mealsWithItems = await Promise.all(
      meals.map(async (meal) => {
        const items = await ctx.db
          .query("mealItems")
          .withIndex("by_meal", (q) => q.eq("mealId", meal._id))
          .collect();
        return { ...meal, items };
      }),
    );
    return mealsWithItems;
  },
});

export const getRecentMeals = query({
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
        code: "NOT_FOUND",
        message: "User not found",
      });
    }
    const meals = await ctx.db
      .query("meals")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take((args.days || 7) * 10);
    return meals;
  },
});

export const deleteMeal = mutation({
  args: { mealId: v.id("meals") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }
    const meal = await ctx.db.get(args.mealId);
    if (!meal) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Meal not found",
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user || meal.userId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot delete another user's meal",
      });
    }
    const items = await ctx.db
      .query("mealItems")
      .withIndex("by_meal", (q) => q.eq("mealId", args.mealId))
      .collect();
    for (const item of items) {
      await ctx.db.delete(item._id);
    }
    await ctx.db.delete(args.mealId);
  },
});

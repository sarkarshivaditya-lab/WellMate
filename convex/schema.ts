import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    dob: v.optional(v.string()),
    sex: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("other"))),
    heightCm: v.optional(v.number()),
    weightKg: v.optional(v.number()),
    activityLevel: v.optional(v.union(
      v.literal("sedentary"),
      v.literal("light"),
      v.literal("moderate"),
      v.literal("active"),
      v.literal("veryActive")
    )),
    goal: v.optional(v.union(v.literal("lose"), v.literal("maintain"), v.literal("gain"))),
    dietaryPreference: v.optional(v.string()),
    allergies: v.optional(v.array(v.string())),
    periodTrackingEnabled: v.optional(v.boolean()),
    hasCompletedOnboarding: v.optional(v.boolean()),
  }).index("by_token", ["tokenIdentifier"]),
  
  meals: defineTable({
    userId: v.id("users"),
    dateIso: v.string(),
    name: v.string(),
    inputMode: v.union(v.literal("detailed"), v.literal("quick")),
    totalCalories: v.number(),
    totalProteinG: v.number(),
    totalFatG: v.number(),
    totalCarbsG: v.number(),
    micronutrientsJson: v.optional(v.string()),
    sourceAdapter: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "dateIso"]),
  
  mealItems: defineTable({
    mealId: v.id("meals"),
    name: v.string(),
    calories: v.number(),
    proteinG: v.number(),
    fatG: v.number(),
    carbsG: v.number(),
    micronutrientsJson: v.optional(v.string()),
    quantity: v.number(),
    unit: v.string(),
  }).index("by_meal", ["mealId"]),
  
  exercises: defineTable({
    userId: v.id("users"),
    dateIso: v.string(),
    type: v.string(),
    name: v.string(),
    setsJson: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    caloriesBurnedEst: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_date", ["userId", "dateIso"]),
  
  cycles: defineTable({
    userId: v.id("users"),
    startDateIso: v.string(),
    lengthDays: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_start", ["userId", "startDateIso"]),
});

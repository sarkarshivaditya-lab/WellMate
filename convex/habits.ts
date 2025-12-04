import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { ConvexError } from "convex/values";

export const addHabit = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    cadence: v.union(v.literal("daily"), v.literal("weekly"), v.literal("custom")),
    remindersEnabled: v.boolean(),
    reminderTime: v.optional(v.string()),
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

    const habitId = await ctx.db.insert("habits", {
      userId: user._id,
      title: args.title,
      description: args.description,
      cadence: args.cadence,
      remindersEnabled: args.remindersEnabled,
      reminderTime: args.reminderTime,
      archived: false,
    });

    return habitId;
  },
});

export const updateHabit = mutation({
  args: {
    habitId: v.id("habits"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    cadence: v.optional(v.union(v.literal("daily"), v.literal("weekly"), v.literal("custom"))),
    remindersEnabled: v.optional(v.boolean()),
    reminderTime: v.optional(v.string()),
    archived: v.optional(v.boolean()),
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

    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== user._id) {
      throw new ConvexError({
        message: "Habit not found or unauthorized",
        code: "FORBIDDEN",
      });
    }

    const updates: Record<string, unknown> = {};
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.cadence !== undefined) updates.cadence = args.cadence;
    if (args.remindersEnabled !== undefined) updates.remindersEnabled = args.remindersEnabled;
    if (args.reminderTime !== undefined) updates.reminderTime = args.reminderTime;
    if (args.archived !== undefined) updates.archived = args.archived;

    await ctx.db.patch(args.habitId, updates);
  },
});

export const deleteHabit = mutation({
  args: { habitId: v.id("habits") },
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

    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== user._id) {
      throw new ConvexError({
        message: "Habit not found or unauthorized",
        code: "FORBIDDEN",
      });
    }

    await ctx.db.delete(args.habitId);
  },
});

export const listHabits = query({
  args: { includeArchived: v.optional(v.boolean()) },
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

    let habits = await ctx.db
      .query("habits")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    if (!args.includeArchived) {
      habits = habits.filter((h) => !h.archived);
    }

    return habits;
  },
});

export const addHabitEntry = mutation({
  args: {
    habitId: v.id("habits"),
    dateIso: v.string(),
    completed: v.boolean(),
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

    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== user._id) {
      throw new ConvexError({
        message: "Habit not found or unauthorized",
        code: "FORBIDDEN",
      });
    }

    // Check if entry already exists for this date
    const existing = await ctx.db
      .query("habitEntries")
      .withIndex("by_habit_and_date", (q) =>
        q.eq("habitId", args.habitId).eq("dateIso", args.dateIso)
      )
      .first();

    if (existing) {
      // Update existing entry
      await ctx.db.patch(existing._id, {
        completed: args.completed,
        note: args.note,
      });
      return existing._id;
    }

    // Create new entry
    const entryId = await ctx.db.insert("habitEntries", {
      habitId: args.habitId,
      userId: user._id,
      dateIso: args.dateIso,
      completed: args.completed,
      note: args.note,
    });

    return entryId;
  },
});

export const listHabitEntriesByDate = query({
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

    const entries = await ctx.db
      .query("habitEntries")
      .withIndex("by_user_and_date", (q) =>
        q.eq("userId", user._id).eq("dateIso", args.dateIso)
      )
      .collect();

    return entries;
  },
});

export const toggleHabitCompletion = mutation({
  args: {
    habitId: v.id("habits"),
    dateIso: v.string(),
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

    const habit = await ctx.db.get(args.habitId);
    if (!habit || habit.userId !== user._id) {
      throw new ConvexError({
        message: "Habit not found or unauthorized",
        code: "FORBIDDEN",
      });
    }

    // Check if entry exists
    const existing = await ctx.db
      .query("habitEntries")
      .withIndex("by_habit_and_date", (q) =>
        q.eq("habitId", args.habitId).eq("dateIso", args.dateIso)
      )
      .first();

    if (existing) {
      // Toggle existing
      await ctx.db.patch(existing._id, {
        completed: !existing.completed,
      });
      return !existing.completed;
    }

    // Create new completed entry
    await ctx.db.insert("habitEntries", {
      habitId: args.habitId,
      userId: user._id,
      dateIso: args.dateIso,
      completed: true,
      note: undefined,
    });

    return true;
  },
});

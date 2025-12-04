"use node";

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel.d.ts";

interface InsightsResult {
  moodAverage: number;
  stressIndicators: string[];
  notes: string;
}

export const generateWeeklyInsights = action({
  args: {},
  handler: async (ctx): Promise<InsightsResult | null> => {
    // Get user identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // Fetch moods from last 7 days
    const moods: Doc<"moods">[] = await ctx.runQuery(api.moods.listMoods, { limit: 7 });
    
    if (moods.length === 0) {
      return {
        moodAverage: 0,
        stressIndicators: ["Not enough data to generate insights yet"],
        notes: "Start tracking your mood daily to unlock personalized insights.",
      };
    }

    // Calculate mood average
    const moodSum: number = moods.reduce((sum: number, m: Doc<"moods">) => sum + m.moodValue, 0);
    const moodAverage: number = moodSum / moods.length;

    // Detect stress indicators
    const stressIndicators: string[] = [];
    
    // Check for consistently low moods
    const lowMoodCount = moods.filter((m: Doc<"moods">) => m.moodValue <= 2).length;
    if (lowMoodCount >= 3) {
      stressIndicators.push("Multiple low mood days detected");
    }

    // Check for mood volatility
    const moodValues = moods.map((m: Doc<"moods">) => m.moodValue);
    const maxMood = Math.max(...moodValues);
    const minMood = Math.min(...moodValues);
    if (maxMood - minMood >= 3) {
      stressIndicators.push("High mood variability this week");
    }

    // Check for declining trend
    const firstHalf = moods.slice(Math.floor(moods.length / 2));
    const secondHalf = moods.slice(0, Math.floor(moods.length / 2));
    const firstAvg = firstHalf.reduce((sum: number, m: Doc<"moods">) => sum + m.moodValue, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum: number, m: Doc<"moods">) => sum + m.moodValue, 0) / secondHalf.length;
    
    if (firstAvg - secondAvg >= 1) {
      stressIndicators.push("Mood appears to be declining");
    }

    // Check for positive trend
    if (secondAvg - firstAvg >= 1) {
      stressIndicators.push("Mood is trending upward - great progress!");
    }

    // Generate notes based on average mood
    let notes = "";
    if (moodAverage >= 4) {
      notes = "You're experiencing great emotional wellbeing this week. Keep up the positive habits that are working for you.";
    } else if (moodAverage >= 3) {
      notes = "Your mood is steady. Consider incorporating more wellbeing practices or connecting with supportive people.";
    } else {
      notes = "This week has been challenging. Remember to be kind to yourself and reach out for support if needed.";
    }

    // Note: Exercise correlation would require fetching recent exercises
    // but we'll keep the insights simple for now

    return {
      moodAverage: Math.round(moodAverage * 10) / 10,
      stressIndicators: stressIndicators.length > 0 ? stressIndicators : ["No significant patterns detected"],
      notes,
    };
  },
});

export const getWeeklyInsights = action({
  args: { weekStart: v.string() },
  handler: async (ctx, args): Promise<InsightsResult | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    // In a real implementation, this would check the cache first
    // For now, we'll just generate fresh insights
    return await ctx.runAction(api.insights.generateWeeklyInsights, {});
  },
});

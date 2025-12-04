/**
 * Server Adapter Interface
 * 
 * Defines the contract for all backend communication in WellMate.
 * Implementations: mockServerAdapter (dev) and httpServerAdapter (prod).
 */

import type { AiResponse } from "@/services/aiTypes";
import type { AiMentalResponse } from "@/services/aiMentalTypes";

export interface UserProfile {
  age: number;
  biologicalSex: "male" | "female";
  activityLevel: "sedentary" | "light" | "moderate" | "active" | "very_active";
  primaryGoal: "lose_weight" | "maintain" | "gain_weight" | "build_muscle";
  height: number;
  weight: number;
  nutritionTargets: {
    bmr: number;
    tdee: number;
    targetCalories: number;
    macros: {
      protein: number;
      carbs: number;
      fat: number;
    };
  };
}

export interface AiContext {
  recentMeals?: Array<{
    type: string;
    totalCalories: number;
  }>;
  recentExercises?: Array<{
    type: string;
    caloriesBurned: number;
  }>;
}

export interface MoodHistoryItem {
  mood: string;
  tags?: string[];
  timestamp?: string;
}

export interface CheckoutSession {
  sessionId: string;
  checkoutUrl: string;
  tier: string;
}

export interface SubscriptionStatus {
  tier: "free" | "pro";
  status: "active" | "inactive" | "canceled";
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface VerifySessionResponse {
  success: boolean;
  subscription: SubscriptionStatus;
}

/**
 * Server Adapter Interface
 */
export interface IServerAdapter {
  /**
   * Call the AI Physical Coach
   */
  postAiPhysical(
    userProfile: UserProfile,
    message: string,
    context?: AiContext
  ): Promise<AiResponse>;

  /**
   * Call the AI Mental Coach
   */
  postAiMental(
    moodHistory: MoodHistoryItem[],
    journalSummary: string | null,
    message: string
  ): Promise<AiMentalResponse>;

  /**
   * Create a Stripe checkout session
   */
  createCheckoutSession(
    tier: "pro",
    userId: string
  ): Promise<CheckoutSession>;

  /**
   * Verify a payment session and retrieve subscription
   */
  verifySession(
    sessionId: string,
    userId: string
  ): Promise<VerifySessionResponse>;

  /**
   * Fetch user profile from backend
   */
  fetchUserProfile(userId: string): Promise<UserProfile | null>;
}

/**
 * Mock Server Adapter
 * 
 * Implements IServerAdapter with static mock responses.
 * Used in DEV_MODE for local development without backend.
 */

import type {
  IServerAdapter,
  UserProfile,
  AiContext,
  MoodHistoryItem,
  CheckoutSession,
  VerifySessionResponse,
} from "./serverAdapter.interface";
import type { AiResponse } from "@/services/aiTypes";
import type { AiMentalResponse } from "@/services/aiMentalTypes";

export class MockServerAdapter implements IServerAdapter {
  async postAiPhysical(
    userProfile: UserProfile,
    message: string,
    context?: AiContext
  ): Promise<AiResponse> {
    // Simulate network delay
    await this.delay(800);

    const mockResponse: AiResponse = {
      advice_text: `I understand you want guidance on: "${message}". Based on your profile (${userProfile.primaryGoal}, ${userProfile.activityLevel} activity), here's my advice...`,
      type: "mixed" as const,
      nutrition: {
        calories: userProfile.nutritionTargets.targetCalories,
        protein_g: userProfile.nutritionTargets.macros.protein,
        carbs_g: userProfile.nutritionTargets.macros.carbs,
        fat_g: userProfile.nutritionTargets.macros.fat,
      },
      plan: [
        {
          day: 1,
          meals: [
            {
              name: "Greek yogurt with berries",
              calories: 250,
              protein_g: 20,
              carbs_g: 30,
              fat_g: 5,
            },
            {
              name: "Grilled chicken salad",
              calories: 400,
              protein_g: 35,
              carbs_g: 25,
              fat_g: 15,
            },
          ],
        },
      ],
      explainability:
        "This is a mock response from the development adapter. In production, this will be powered by OpenAI.",
      confidence: "medium" as const,
      escalation: false,
    };

    return mockResponse;
  }

  async postAiMental(
    moodHistory: MoodHistoryItem[],
    journalSummary: string | null,
    message: string
  ): Promise<AiMentalResponse> {
    await this.delay(800);

    const mockResponse: AiMentalResponse = {
      summary: `Thank you for sharing: "${message}". I'm here to support you. Let's explore some helpful techniques.`,
      emotion: "calm" as const,
      suggestions: [
        "Try the 4-7-8 breathing technique",
        "Take a short walk outside",
        "Practice gratitude journaling",
      ],
      practice: {
        id: "box-breathing",
        title: "Box Breathing",
        steps: [
          "Inhale slowly for 4 counts",
          "Hold your breath for 4 counts",
          "Exhale slowly for 4 counts",
          "Hold for 4 counts",
          "Repeat 3-4 times",
        ],
      },
      confidence: "medium" as const,
      escalation: false,
    };

    return mockResponse;
  }

  async createCheckoutSession(
    tier: "pro",
    userId: string
  ): Promise<CheckoutSession> {
    await this.delay(500);

    return {
      sessionId: `cs_mock_${Date.now()}_${userId}`,
      checkoutUrl: `https://checkout.stripe.com/pay/cs_mock_${Date.now()}`,
      tier,
    };
  }

  async verifySession(
    sessionId: string,
    userId: string
  ): Promise<VerifySessionResponse> {
    await this.delay(500);

    return {
      success: true,
      subscription: {
        tier: "pro",
        status: "active",
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
        cancelAtPeriodEnd: false,
      },
    };
  }

  async fetchUserProfile(userId: string): Promise<UserProfile | null> {
    await this.delay(300);

    // Return null - profile should be managed locally in Convex
    return null;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

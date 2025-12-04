/**
 * HTTP Server Adapter
 * 
 * Implements IServerAdapter with real HTTP calls to backend.
 * Used in production when DEV_MODE=false.
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

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
const TIMEOUT_MS = 30000; // 30 seconds

export class HttpServerAdapter implements IServerAdapter {
  async postAiPhysical(
    userProfile: UserProfile,
    message: string,
    context?: AiContext
  ): Promise<AiResponse> {
    const response = await this.fetchWithTimeout(
      `${BACKEND_URL}/api/ai/physical-coach`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userProfile, message, context }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.error || `AI Physical Coach error: ${response.status}`
      );
    }

    return response.json();
  }

  async postAiMental(
    moodHistory: MoodHistoryItem[],
    journalSummary: string | null,
    message: string
  ): Promise<AiMentalResponse> {
    const response = await this.fetchWithTimeout(
      `${BACKEND_URL}/api/ai/mental-coach`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moodHistory, journalSummary, message }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.error || `AI Mental Coach error: ${response.status}`
      );
    }

    return response.json();
  }

  async createCheckoutSession(
    tier: "pro",
    userId: string
  ): Promise<CheckoutSession> {
    const response = await this.fetchWithTimeout(
      `${BACKEND_URL}/api/payments/create-checkout-session`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, userId }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.error || `Payment creation error: ${response.status}`
      );
    }

    return response.json();
  }

  async verifySession(
    sessionId: string,
    userId: string
  ): Promise<VerifySessionResponse> {
    const response = await this.fetchWithTimeout(
      `${BACKEND_URL}/api/payments/verify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userId }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.error || `Payment verification error: ${response.status}`
      );
    }

    return response.json();
  }

  async fetchUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const response = await this.fetchWithTimeout(
        `${BACKEND_URL}/api/profile/${userId}`,
        { method: "GET" }
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Profile fetch error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
      return null;
    }
  }

  /**
   * Fetch with timeout and error handling
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request timed out");
      }
      throw error;
    }
  }
}

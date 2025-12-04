// Payment service for WellMate
// Supports DEV_MODE (mocked) and PROD_MODE (real backend)

const DEV_MODE = import.meta.env.VITE_DEV_MODE !== "false";
const PAYMENT_BACKEND_URL = import.meta.env.VITE_PAYMENT_BACKEND_URL || "";

export interface CheckoutSessionResult {
  success: boolean;
  sessionId?: string;
  checkoutUrl?: string;
  error?: string;
}

export interface VerifySessionResult {
  success: boolean;
  tier?: "free" | "pro";
  error?: string;
}

export async function createCheckoutSession(
  productId: string
): Promise<CheckoutSessionResult> {
  if (DEV_MODE) {
    // Mock successful checkout
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      success: true,
      sessionId: `mock_session_${Date.now()}`,
      checkoutUrl: "https://mock-checkout.example.com",
    };
  }

  // Production mode - call real backend
  try {
    const response = await fetch(`${PAYMENT_BACKEND_URL}/create-checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ productId }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: "Failed to create checkout session",
      };
    }

    const data = await response.json();
    return {
      success: true,
      sessionId: data.sessionId,
      checkoutUrl: data.checkoutUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: "Network error creating checkout session",
    };
  }
}

export async function verifySubscription(
  sessionId: string
): Promise<VerifySessionResult> {
  if (DEV_MODE) {
    // Mock verification
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      success: true,
      tier: "pro",
    };
  }

  // Production mode - verify with backend
  try {
    const response = await fetch(`${PAYMENT_BACKEND_URL}/verify-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: "Failed to verify subscription",
      };
    }

    const data = await response.json();
    return {
      success: true,
      tier: data.tier,
    };
  } catch (error) {
    return {
      success: false,
      error: "Network error verifying subscription",
    };
  }
}

export function getPaymentBackendStatus(): {
  mode: "dev" | "prod";
  configured: boolean;
} {
  return {
    mode: DEV_MODE ? "dev" : "prod",
    configured: !DEV_MODE && PAYMENT_BACKEND_URL.length > 0,
  };
}

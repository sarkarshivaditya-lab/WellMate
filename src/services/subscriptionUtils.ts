export interface Subscription {
  tier: "free" | "pro";
  status: "active" | "past_due" | "inactive";
  provider: "stripe" | "mock";
  expiresAt?: string | null;
}

export interface FeatureGate {
  available: boolean;
  reason?: string;
}

export function checkFeatureAccess(
  feature: string,
  subscription: Subscription | null
): FeatureGate {
  // Default to free tier if no subscription
  const tier = subscription?.tier || "free";
  const status = subscription?.status || "active";

  // Inactive subscriptions are treated as free
  if (status === "inactive") {
    return checkFreeFeatureAccess(feature);
  }

  // Pro tier gets everything
  if (tier === "pro" && status === "active") {
    return { available: true };
  }

  // Free tier feature gates
  return checkFreeFeatureAccess(feature);
}

function checkFreeFeatureAccess(feature: string): FeatureGate {
  const freeFeatures = [
    "mood-tracking",
    "journal-basic",
    "habits-basic",
    "sleep-basic",
    "ai-limited", // 3 queries per day
    "practices",
    "resources",
  ];

  if (freeFeatures.includes(feature)) {
    return { available: true };
  }

  return {
    available: false,
    reason: "Upgrade to Pro to unlock this feature",
  };
}

export function getFeatureLimit(
  feature: string,
  subscription: Subscription | null
): number | null {
  const tier = subscription?.tier || "free";
  const status = subscription?.status || "active";

  if (status === "inactive" || tier === "free") {
    // Free tier limits
    if (feature === "ai-queries-daily") return 3;
    if (feature === "habits-max") return 5;
    if (feature === "journal-history-days") return 30;
    if (feature === "sleep-history-days") return 30;
  }

  // Pro tier - unlimited
  return null;
}

export interface TierFeatures {
  name: string;
  price: string;
  features: string[];
  limits: Record<string, string>;
}

export const TIER_FEATURES: Record<"free" | "pro", TierFeatures> = {
  free: {
    name: "Free",
    price: "$0",
    features: [
      "Basic mood tracking",
      "Journal entries (30 days)",
      "Up to 5 habits",
      "Sleep logging (30 days)",
      "AI Coach (3 queries/day)",
      "Wellbeing practices",
      "Community resources",
    ],
    limits: {
      habits: "5 habits max",
      ai: "3 AI queries per day",
      history: "30 days of history",
    },
  },
  pro: {
    name: "Pro",
    price: "$9.99/month",
    features: [
      "Everything in Free, plus:",
      "Unlimited habits",
      "Unlimited AI Coach queries",
      "Full history access",
      "CSV data export",
      "Weekly summary emails",
      "Priority support",
      "Early access to new features",
    ],
    limits: {},
  },
};

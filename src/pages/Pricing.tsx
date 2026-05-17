import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import SubscriptionCard from "@/components/SubscriptionCard";
import GatedFeatureBanner from "@/components/GatedFeatureBanner";
import { Skeleton } from "@/components/ui/skeleton";
import { TIER_FEATURES } from "@/services/subscriptionUtils";
import {
  createCheckoutSession,
  getPaymentBackendStatus,
} from "@/services/payments";
import { toast } from "sonner";
import PageLayout from "@/components/layout/PageLayout";

export default function Pricing() {
  const [loading, setLoading] = useState(false);
  const subscription = useQuery(api.subscriptions.getSubscription, {});
  const setSubscriptionStub = useMutation(
    api.subscriptions.setSubscriptionStub,
  );

  const paymentStatus = getPaymentBackendStatus();
  const currentTier = subscription?.tier || "free";

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      if (paymentStatus.mode === "dev") {
        // Dev mode - use mock subscription
        await setSubscriptionStub({ tier: "pro" });
        toast.success("Subscription upgraded! (DEV MODE)");
      } else {
        // Production mode - create checkout session
        const result = await createCheckoutSession("pro-monthly");
        if (result.success && result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
        } else {
          toast.error("Failed to create checkout session");
        }
      }
    } catch (error) {
      toast.error("Failed to upgrade");
    } finally {
      setLoading(false);
    }
  };

  if (subscription === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-4xl">
          <Skeleton className="h-12 w-full mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const planExpired =
    subscription?.tier === "pro" && subscription?.status !== "active";

  return (
    <PageLayout>
      <div className="w-full space-y-8">
        {/* Expired plan notice — shown when pro has lapsed */}
        {planExpired && (
          <GatedFeatureBanner
            feature="Your Pro plan has ended"
            description={
              subscription?.status === "past_due"
                ? "Your last payment didn't go through. Update your billing to restore access — your data is always safe."
                : "Your Pro plan has ended. Renew anytime to restore full access — your data is always safe."
            }
            onUpgrade={handleUpgrade}
            variant="expired"
          />
        )}

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Choose Your Plan</h1>
          <p className="text-lg text-muted-foreground">
            Unlock your full wellness potential with Pro
          </p>
        </div>

        {/* Dev Mode Notice removed for production cleanliness */}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          <SubscriptionCard
            tier={TIER_FEATURES.free}
            isCurrentPlan={currentTier === "free"}
            onSelect={() => toast.info("You're on the free plan")}
          />
          <SubscriptionCard
            tier={TIER_FEATURES.pro}
            isCurrentPlan={currentTier === "pro"}
            onSelect={handleUpgrade}
            loading={loading}
          />
        </div>

        {/* FAQ */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-xl font-semibold">
              Frequently Asked Questions
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="font-medium">Can I cancel anytime?</p>
                <p className="text-muted-foreground">
                  Yes, you can cancel your subscription at any time. You'll keep
                  Pro access until the end of your billing period.
                </p>
              </div>
              <div>
                <p className="font-medium">
                  What happens to my data if I downgrade?
                </p>
                <p className="text-muted-foreground">
                  All your data is preserved. You'll just lose access to Pro
                  features and hit the free plan limits.
                </p>
              </div>
              <div>
                <p className="font-medium">Do you offer refunds?</p>
                <p className="text-muted-foreground">
                  We offer refunds within 14 days of purchase if you're not
                  satisfied.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}

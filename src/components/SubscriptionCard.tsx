import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckIcon } from "lucide-react";
import type { TierFeatures } from "@/services/subscriptionUtils";

interface SubscriptionCardProps {
  tier: TierFeatures;
  isCurrentPlan?: boolean;
  onSelect: () => void;
  loading?: boolean;
}

export default function SubscriptionCard({
  tier,
  isCurrentPlan = false,
  onSelect,
  loading = false,
}: SubscriptionCardProps) {
  return (
    <Card className={isCurrentPlan ? "border-primary" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{tier.name}</CardTitle>
            <CardDescription className="text-2xl font-bold mt-2">
              {tier.price}
            </CardDescription>
          </div>
          {isCurrentPlan && (
            <Badge>Current Plan</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {tier.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <CheckIcon className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        
        {Object.keys(tier.limits).length > 0 && (
          <div className="pt-3 border-t">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Limits:</p>
            {Object.entries(tier.limits).map(([key, value]) => (
              <p key={key} className="text-xs text-muted-foreground">
                • {value}
              </p>
            ))}
          </div>
        )}
        
        <Button
          className="w-full"
          onClick={onSelect}
          disabled={isCurrentPlan || loading}
          variant={isCurrentPlan ? "secondary" : "default"}
        >
          {isCurrentPlan ? "Current Plan" : tier.name === "Free" ? "Current Plan" : "Upgrade"}
        </Button>
      </CardContent>
    </Card>
  );
}

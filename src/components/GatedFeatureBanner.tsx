import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles, RefreshCw } from "lucide-react";

type Variant = "limit" | "expired";

interface GatedFeatureBannerProps {
  feature: string;
  description?: string;
  onUpgrade: () => void;
  variant?: Variant;
}

const VARIANT_CONFIG: Record<
  Variant,
  {
    cardClass: string;
    iconClass: string;
    iconBgClass: string;
    Icon: React.ElementType;
    ctaLabel: string;
    CtaIcon: React.ElementType;
  }
> = {
  limit: {
    cardClass: "border-primary/50 bg-primary/5",
    iconClass: "text-primary",
    iconBgClass: "bg-primary/10",
    Icon: Lock,
    ctaLabel: "Upgrade to Pro",
    CtaIcon: Sparkles,
  },
  expired: {
    cardClass: "border-amber-400/50 bg-amber-500/5",
    iconClass: "text-amber-600 dark:text-amber-400",
    iconBgClass: "bg-amber-500/10",
    Icon: RefreshCw,
    ctaLabel: "Renew plan",
    CtaIcon: RefreshCw,
  },
};

export default function GatedFeatureBanner({
  feature,
  description,
  onUpgrade,
  variant = "limit",
}: GatedFeatureBannerProps) {
  const cfg = VARIANT_CONFIG[variant];

  const defaultDescription =
    variant === "expired"
      ? "Your Pro plan has ended — renew to restore full access. Your data is safe."
      : "Upgrade to Pro to unlock this feature";

  return (
    <Card className={cfg.cardClass}>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div
            className={`w-10 h-10 rounded-full ${cfg.iconBgClass} flex items-center justify-center flex-shrink-0`}
          >
            <cfg.Icon className={`w-5 h-5 ${cfg.iconClass}`} />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">{feature}</h3>
            <p className="text-sm text-muted-foreground mb-3">
              {description ?? defaultDescription}
            </p>
            <Button
              size="sm"
              onClick={onUpgrade}
              className="gap-2"
              variant={variant === "expired" ? "outline" : "default"}
            >
              <cfg.CtaIcon className="w-4 h-4" />
              {cfg.ctaLabel}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

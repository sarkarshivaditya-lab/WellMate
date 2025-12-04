import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";

interface GatedFeatureBannerProps {
  feature: string;
  description?: string;
  onUpgrade: () => void;
}

export default function GatedFeatureBanner({
  feature,
  description,
  onUpgrade,
}: GatedFeatureBannerProps) {
  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">{feature}</h3>
            <p className="text-sm text-muted-foreground mb-3">
              {description || "Upgrade to Pro to unlock this feature"}
            </p>
            <Button size="sm" onClick={onUpgrade} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Upgrade to Pro
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

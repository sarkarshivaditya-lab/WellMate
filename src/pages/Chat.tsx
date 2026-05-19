import { Brain, Heart, MessageCircle, Salad } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import PageLayout from "@/components/layout/PageLayout";
import { cn } from "@/lib/utils";

const SUPPORT_TYPES = [
  {
    icon: Brain,
    title: "Mental Health",
    description: "Therapists and counsellors for emotional wellbeing and resilience.",
    color: "text-violet-500",
    bg: "bg-violet-500/8",
  },
  {
    icon: Salad,
    title: "Nutrition",
    description: "Registered dietitians and nutritionists for personalised food guidance.",
    color: "text-emerald-600",
    bg: "bg-emerald-500/8",
  },
  {
    icon: Heart,
    title: "Wellness Coaching",
    description: "Holistic coaches for movement, sleep, stress, and lifestyle balance.",
    color: "text-rose-500",
    bg: "bg-rose-500/8",
  },
  {
    icon: MessageCircle,
    title: "AI Wellness Guide",
    description: "24/7 intelligent support drawing on your complete wellness history.",
    color: "text-primary",
    bg: "bg-primary/8",
  },
] as const;

export default function Chat() {
  return (
    <PageLayout title="Support" subtitle="Wellness guidance and care">
      <div className="space-y-8">

        {/* Hero */}
        <div className="text-center pt-4 pb-2 space-y-4">
          <div className="flex justify-center">
            <div
              className={cn(
                "h-[72px] w-[72px] rounded-[22px] flex items-center justify-center",
                "bg-primary/8 ring-1 ring-primary/12",
              )}
            >
              <MessageCircle className="h-9 w-9 text-primary/65" strokeWidth={1.6} />
            </div>
          </div>
          <div className="space-y-2 px-4">
            <h2 className="text-[22px] font-semibold tracking-tight text-foreground">
              Your care team, in one place
            </h2>
            <p className="text-[14px] text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
              Real specialists and intelligent support — informed by your wellness
              data, available when you need them.
            </p>
          </div>
        </div>

        {/* Support type cards */}
        <div className="space-y-3">
          {SUPPORT_TYPES.map(({ icon: Icon, title, description, color, bg }) => (
            <Card
              key={title}
              className="border-border/40 opacity-80"
            >
              <CardContent className="py-4 px-4 flex items-start gap-3.5">
                <div className={cn("mt-0.5 h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0", bg)}>
                  <Icon className={cn("h-[18px] w-[18px]", color)} strokeWidth={1.8} />
                </div>
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-medium text-foreground leading-snug">
                      {title}
                    </p>
                    <span
                      className={cn(
                        "text-[10px] font-semibold tracking-[0.06em] uppercase",
                        "px-1.5 py-0.5 rounded-md",
                        "bg-muted/60 text-muted-foreground/60",
                      )}
                    >
                      Soon
                    </span>
                  </div>
                  <p className="text-[12.5px] text-muted-foreground/70 leading-relaxed">
                    {description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Grounding note */}
        <p className="text-center text-[11.5px] text-muted-foreground/45 leading-relaxed px-6 pb-4">
          WellMate connects you with verified professionals. Your wellness data
          stays private and is only shared with your explicit permission.
        </p>

      </div>
    </PageLayout>
  );
}

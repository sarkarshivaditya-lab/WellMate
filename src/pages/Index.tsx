import { Link } from "react-router-dom";
import PageLayout from "@/components/layout/PageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, Activity, Brain, Repeat, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

type QuickLinkProps = {
  to: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  accent?: boolean;
};

function QuickLink({ to, icon, label, description, accent }: QuickLinkProps) {
  return (
    <Link to={to} className="block">
      <Card
        className={cn(
          "transition-premium hover:bg-accent/20",
          accent && "border-primary/20 hover:border-primary/40",
        )}
      >
        <CardContent className="px-4 py-3.5 flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0",
              accent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">{label}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">{description}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}

export default function Overview() {
  return (
    <PageLayout
      title="Overview"
      subtitle="Everything in one place."
    >
      <div className="space-y-3">
        <QuickLink
          to="/physical"
          icon={<Activity className="h-4 w-4" />}
          label="Physical Health"
          description="Activity, nutrition, and body metrics"
          accent
        />
        <QuickLink
          to="/mental"
          icon={<Brain className="h-4 w-4" />}
          label="Mental Wellbeing"
          description="Mood, journal, and mindfulness"
        />
        <QuickLink
          to="/habits"
          icon={<Repeat className="h-4 w-4" />}
          label="Habits"
          description="Build consistency through daily actions"
        />
        <QuickLink
          to="/sleep"
          icon={<Moon className="h-4 w-4" />}
          label="Sleep"
          description="Track rest quality and patterns"
        />
      </div>
    </PageLayout>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  WindIcon, 
  HeartIcon, 
  BrainIcon, 
  SparklesIcon 
} from "lucide-react";

export interface Practice {
  id: string;
  title: string;
  type: "breathing" | "gratitude" | "reflection" | "grounding";
  steps: string[];
}

interface PracticeCardProps {
  practice: Practice;
  onClick?: () => void;
}

const typeConfig = {
  breathing: { icon: WindIcon, label: "Breathing", color: "text-blue-600" },
  gratitude: { icon: HeartIcon, label: "Gratitude", color: "text-pink-600" },
  reflection: { icon: BrainIcon, label: "Reflection", color: "text-purple-600" },
  grounding: { icon: SparklesIcon, label: "Grounding", color: "text-green-600" },
};

export default function PracticeCard({ practice, onClick }: PracticeCardProps) {
  const config = typeConfig[practice.type];
  const Icon = config.icon;

  return (
    <Card
      className={`${onClick ? "cursor-pointer hover:bg-accent" : ""}`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{practice.title}</CardTitle>
          <Icon className={`h-5 w-5 ${config.color} flex-shrink-0`} />
        </div>
      </CardHeader>
      <CardContent>
        <Badge variant="secondary" className="text-xs">
          {config.label}
        </Badge>
        <p className="text-sm text-muted-foreground mt-2">
          {practice.steps.length} steps • {Math.ceil(practice.steps.length * 0.5)} min
        </p>
      </CardContent>
    </Card>
  );
}

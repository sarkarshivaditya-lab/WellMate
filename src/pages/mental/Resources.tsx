import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  HeartIcon,
  BrainIcon,
  ActivityIcon,
  UsersIcon,
  SunIcon,
  MoonIcon,
} from "lucide-react";

export default function Resources() {
  const resources = [
    {
      icon: HeartIcon,
      title: "Self-Care Basics",
      tips: [
        "Get 7-9 hours of quality sleep each night",
        "Eat regular, balanced meals throughout the day",
        "Stay hydrated - aim for 8 glasses of water daily",
        "Take breaks during work to rest your mind",
        "Set boundaries and learn to say no when needed",
      ],
    },
    {
      icon: BrainIcon,
      title: "Mental Clarity",
      tips: [
        "Practice mindfulness or meditation for 5-10 minutes daily",
        "Limit screen time before bed",
        "Write down worries to clear your mind",
        "Break large tasks into smaller, manageable steps",
        "Schedule regular 'mental health days'",
      ],
    },
    {
      icon: ActivityIcon,
      title: "Physical Wellbeing",
      tips: [
        "Move your body for at least 30 minutes daily",
        "Spend time outdoors in natural light",
        "Practice deep breathing exercises",
        "Stretch regularly to release tension",
        "Notice how different activities affect your mood",
      ],
    },
    {
      icon: UsersIcon,
      title: "Social Connection",
      tips: [
        "Reach out to a friend or family member regularly",
        "Join groups or communities with shared interests",
        "Volunteer or help others when you can",
        "Share your feelings with people you trust",
        "Quality matters more than quantity in relationships",
      ],
    },
    {
      icon: SunIcon,
      title: "Stress Management",
      tips: [
        "Identify your stress triggers and patterns",
        "Practice the 4-7-8 breathing technique when anxious",
        "Use the 5-4-3-2-1 grounding method",
        "Keep a gratitude journal",
        "Engage in hobbies that bring you joy",
      ],
    },
    {
      icon: MoonIcon,
      title: "Sleep Hygiene",
      tips: [
        "Keep a consistent sleep schedule, even on weekends",
        "Create a calming bedtime routine",
        "Keep your bedroom cool, dark, and quiet",
        "Avoid caffeine after 2pm",
        "Wind down with reading or gentle stretching",
      ],
    },
  ];

  return (
    <div className="space-y-4 p-4 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-2">Wellbeing Resources</h1>
        <p className="text-sm text-muted-foreground">
          Tips and guidance for maintaining mental and emotional health
        </p>
      </div>

      {/* Important Notice */}
      <Card className="border-amber-500/50 bg-amber-500/5">
        <CardContent className="pt-6">
          <p className="text-sm">
            <strong>Note:</strong> These resources are for general wellbeing and are not a
            substitute for professional medical advice. If you're experiencing a mental health
            crisis, please contact a healthcare provider or crisis hotline immediately.
          </p>
        </CardContent>
      </Card>

      {/* Resource Cards */}
      <div className="space-y-4">
        {resources.map((resource) => {
          const Icon = resource.icon;
          return (
            <Card key={resource.title}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  {resource.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {resource.tips.map((tip, index) => (
                    <li key={index} className="text-sm flex items-start">
                      <span className="text-primary mr-2">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Additional Help */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">When to Seek Professional Help</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Consider reaching out to a mental health professional if you experience:</p>
          <ul className="space-y-1 ml-4">
            <li>• Persistent feelings of sadness or hopelessness</li>
            <li>• Difficulty functioning in daily life</li>
            <li>• Thoughts of self-harm</li>
            <li>• Substance abuse issues</li>
            <li>• Prolonged anxiety or panic attacks</li>
            <li>• Significant changes in sleep or appetite</li>
          </ul>
          <p className="pt-2 font-medium">
            Remember: Seeking help is a sign of strength, not weakness.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

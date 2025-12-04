import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { toast } from "sonner";

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [consent, setConsent] = useState(false);
  const [formData, setFormData] = useState({
    dob: "",
    sex: "other" as "male" | "female" | "other",
    heightCm: "",
    weightKg: "",
    activityLevel: "moderate" as "sedentary" | "light" | "moderate" | "active" | "veryActive",
    goal: "maintain" as "lose" | "maintain" | "gain",
    dietaryPreference: "",
    allergies: "",
    periodTrackingEnabled: false,
  });
  const completeOnboarding = useMutation(api.users.completeOnboarding);

  const handleSubmit = async () => {
    if (!consent) {
      toast.error("Please accept the consent agreement to continue");
      return;
    }
    try {
      await completeOnboarding({
        dob: formData.dob,
        sex: formData.sex,
        heightCm: parseFloat(formData.heightCm),
        weightKg: parseFloat(formData.weightKg),
        activityLevel: formData.activityLevel,
        goal: formData.goal,
        dietaryPreference: formData.dietaryPreference || undefined,
        allergies: formData.allergies ? formData.allergies.split(",").map(a => a.trim()) : undefined,
        periodTrackingEnabled: formData.periodTrackingEnabled,
      });
      window.location.reload();
    } catch (error) {
      toast.error("Failed to complete onboarding. Please try again.");
    }
  };

  const steps = [
    {
      title: "Welcome to WellMate",
      description: "Your personal health and wellness companion",
      content: (
        <div className="space-y-6 text-center">
          <div className="text-6xl">🌱</div>
          <p className="text-balance text-muted-foreground">
            Track your physical and mental wellbeing in one place. Log meals, exercise, and mindfulness practices.
          </p>
          <div className="space-y-4 text-left">
            <div className="flex items-start space-x-3">
              <Checkbox id="consent" checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} />
              <Label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
                I accept that WellMate is not a medical service and I consent to local storage of my health data. This app is for informational purposes only and should not replace professional medical advice.
              </Label>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Basic Information",
      description: "Tell us about yourself",
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dob">Date of Birth</Label>
            <Input
              id="dob"
              type="date"
              value={formData.dob}
              onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sex">Sex</Label>
            <Select value={formData.sex} onValueChange={(value) => setFormData({ ...formData, sex: value as typeof formData.sex })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other/Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="height">Height (cm)</Label>
              <Input
                id="height"
                type="number"
                placeholder="170"
                value={formData.heightCm}
                onChange={(e) => setFormData({ ...formData, heightCm: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                placeholder="70"
                value={formData.weightKg}
                onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })}
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Activity & Goals",
      description: "Help us personalize your experience",
      content: (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="activity">Activity Level</Label>
            <Select value={formData.activityLevel} onValueChange={(value) => setFormData({ ...formData, activityLevel: value as typeof formData.activityLevel })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sedentary">Sedentary (little or no exercise)</SelectItem>
                <SelectItem value="light">Light (1-3 days/week)</SelectItem>
                <SelectItem value="moderate">Moderate (3-5 days/week)</SelectItem>
                <SelectItem value="active">Active (6-7 days/week)</SelectItem>
                <SelectItem value="veryActive">Very Active (intense daily)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal">Primary Goal</Label>
            <Select value={formData.goal} onValueChange={(value) => setFormData({ ...formData, goal: value as typeof formData.goal })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lose">Lose Weight</SelectItem>
                <SelectItem value="maintain">Maintain Weight</SelectItem>
                <SelectItem value="gain">Gain Weight</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dietary">Dietary Preference (optional)</Label>
            <Input
              id="dietary"
              placeholder="e.g., Vegetarian, Vegan, Keto"
              value={formData.dietaryPreference}
              onChange={(e) => setFormData({ ...formData, dietaryPreference: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="allergies">Allergies (optional, comma-separated)</Label>
            <Input
              id="allergies"
              placeholder="e.g., Peanuts, Shellfish"
              value={formData.allergies}
              onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
            />
          </div>
        </div>
      ),
    },
    {
      title: "Additional Features",
      description: "Customize your tracking",
      content: (
        <div className="space-y-4">
          {formData.sex === "female" && (
            <div className="flex items-start space-x-3">
              <Checkbox
                id="period"
                checked={formData.periodTrackingEnabled}
                onCheckedChange={(checked) => setFormData({ ...formData, periodTrackingEnabled: checked === true })}
              />
              <div className="space-y-1">
                <Label htmlFor="period" className="cursor-pointer">Enable Period Tracking</Label>
                <p className="text-sm text-muted-foreground">
                  Track your menstrual cycle and get predictions
                </p>
              </div>
            </div>
          )}
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <h4 className="font-medium">You're all set!</h4>
            <p className="text-sm text-muted-foreground">
              Click "Complete" to start using WellMate. You can always update these settings later.
            </p>
          </div>
        </div>
      ),
    },
  ];

  const currentStep = steps[step];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-muted-foreground">Step {step + 1} of {steps.length}</span>
            <div className="flex space-x-1">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-2 w-8 rounded-full transition-colors ${
                    i <= step ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>
          <CardTitle className="text-2xl">{currentStep.title}</CardTitle>
          <CardDescription>{currentStep.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {currentStep.content}
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={step === 0}
            >
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep(step + 1)} disabled={step === 0 && !consent}>
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!consent}>
                Complete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { useNavigate } from "react-router-dom";
import { calculateBMR, calculateTDEE, calculateCalorieTarget, calculateMacroTargets } from "@/services/nutritionEngine";

export default function Onboarding() {
  const navigate = useNavigate();
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    dob: "",
    sex: "male" as "male" | "female" | "other",
    heightCm: "",
    weightKg: "",
    activityLevel: "moderate" as "sedentary" | "light" | "moderate" | "active" | "veryActive",
    goal: "maintain" as "lose" | "maintain" | "gain",
    periodTrackingEnabled: false,
  });

  const handleSubmit = async () => {
    try {
      await completeOnboarding({
        ...formData,
        heightCm: Number(formData.heightCm),
        weightKg: Number(formData.weightKg),
      });
      navigate("/physical");
    } catch (error) {
      console.error("Onboarding error:", error);
    }
  };

  const age = formData.dob ? new Date().getFullYear() - new Date(formData.dob).getFullYear() : 0;
  const bmr = calculateBMR(Number(formData.weightKg), Number(formData.heightCm), age, formData.sex);
  const tdee = calculateTDEE(bmr, formData.activityLevel);
  const targetCalories = calculateCalorieTarget(tdee, formData.goal);
  const macros = calculateMacroTargets(targetCalories, Number(formData.weightKg), formData.goal);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Welcome to WellMate</CardTitle>
          <CardDescription>Let's personalize your experience (Step {step} of 4)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="sex">Biological Sex</Label>
                <Select value={formData.sex} onValueChange={(value) => setFormData({ ...formData, sex: value as typeof formData.sex })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="activity">Activity Level</Label>
                <Select value={formData.activityLevel} onValueChange={(value) => setFormData({ ...formData, activityLevel: value as typeof formData.activityLevel })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sedentary">Sedentary</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="veryActive">Very Active</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  value={formData.heightCm}
                  onChange={(e) => setFormData({ ...formData, heightCm: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  value={formData.weightKg}
                  onChange={(e) => setFormData({ ...formData, weightKg: e.target.value })}
                />
              </div>
              <div>
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
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="period">Enable Period Tracking</Label>
                  <p className="text-sm text-muted-foreground">Track menstrual cycles and symptoms</p>
                </div>
                <Switch
                  id="period"
                  checked={formData.periodTrackingEnabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, periodTrackingEnabled: checked })}
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Your Personalized Targets</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">BMR</p>
                  <p className="text-2xl font-bold">{Math.round(bmr)} cal/day</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">TDEE</p>
                  <p className="text-2xl font-bold">{Math.round(tdee)} cal/day</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Target Calories</p>
                  <p className="text-2xl font-bold">{Math.round(targetCalories)} cal/day</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Protein</p>
                  <p className="text-2xl font-bold">{Math.round(macros.proteinG)}g</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Carbs</p>
                  <p className="text-2xl font-bold">{Math.round(macros.carbsG)}g</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fat</p>
                  <p className="text-2xl font-bold">{Math.round(macros.fatG)}g</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            {step < 4 ? (
              <Button onClick={() => setStep(step + 1)} className="ml-auto">
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="ml-auto">
                Complete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "veryActive";
export type Goal = "lose" | "maintain" | "gain";
export type Sex = "male" | "female" | "other";

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

export function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  sex: Sex
): number {
  // Mifflin-St Jeor Equation
  if (sex === "male") {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else {
    // Female or other defaults to female formula
    return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }
}

export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_MULTIPLIERS[activityLevel];
}

export function calculateCalorieTarget(tdee: number, goal: Goal): number {
  switch (goal) {
    case "lose":
      return Math.round(tdee - 500); // 500 cal deficit
    case "gain":
      return Math.round(tdee + 500); // 500 cal surplus
    case "maintain":
    default:
      return Math.round(tdee);
  }
}

export interface MacroTargets {
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export function calculateMacroTargets(
  calorieTarget: number,
  weightKg: number,
  goal: Goal
): MacroTargets {
  // Protein: 1.6-2.2g per kg body weight depending on goal
  let proteinMultiplier = 1.8;
  if (goal === "gain") proteinMultiplier = 2.0;
  if (goal === "lose") proteinMultiplier = 2.2;
  
  const proteinG = Math.round(weightKg * proteinMultiplier);
  const proteinCals = proteinG * 4;
  
  // Fat: 25-35% of total calories
  const fatPercentage = 0.30;
  const fatCals = calorieTarget * fatPercentage;
  const fatG = Math.round(fatCals / 9);
  
  // Carbs: remaining calories
  const remainingCals = calorieTarget - proteinCals - fatCals;
  const carbsG = Math.round(remainingCals / 4);
  
  return {
    proteinG: Math.max(0, proteinG),
    fatG: Math.max(0, fatG),
    carbsG: Math.max(0, carbsG),
  };
}

export function calculateAge(dobString: string): number {
  const dob = new Date(dobString);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function estimateCaloriesFromExercise(
  type: string,
  durationMinutes: number,
  weightKg: number
): number {
  // MET (Metabolic Equivalent of Task) values
  const metValues: Record<string, number> = {
    walking: 3.5,
    running: 8.0,
    cycling: 6.0,
    swimming: 7.0,
    weightlifting: 3.0,
    yoga: 2.5,
    hiit: 8.0,
    cardio: 7.0,
  };
  
  const met = metValues[type.toLowerCase()] || 5.0;
  // Calories = MET * weight(kg) * duration(hours)
  return Math.round(met * weightKg * (durationMinutes / 60));
}

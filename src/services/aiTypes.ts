export type AiResponse = {
  advice_text: string;
  type: "diet" | "exercise" | "mixed" | "safety";
  nutrition: {
    calories: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    notes?: string;
  };
  plan: Array<{
    day: number;
    workout?: Array<{
      name: string;
      sets?: number;
      reps?: number | string;
      duration_min?: number;
      notes?: string;
      exercise_id?: string;
    }>;
    meals?: Array<{
      name: string;
      serving_text?: string;
      calories?: number;
      protein_g?: number;
      fat_g?: number;
      carbs_g?: number;
      notes?: string;
    }>;
  }>;
  exercises_database_ids?: string[];
  escalation: boolean;
  explainability: string;
  confidence: "low" | "medium" | "high";
  metadata?: Record<string, unknown>;
};

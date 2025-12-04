export interface AiMentalResponse {
  summary: string;
  emotion: "calm" | "stressed" | "anxious" | "sad" | "content" | "frustrated" | "overwhelmed" | "hopeful";
  suggestions: string[];
  practice: {
    id: string;
    title: string;
    steps: string[];
  };
  escalation: boolean;
  confidence: "low" | "medium" | "high";
}

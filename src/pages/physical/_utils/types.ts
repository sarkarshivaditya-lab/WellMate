// src/pages/physical/_utils/types.ts

export type PhysicalInsight = {
  id: string;
  title: string;
  body: string;
  impact: 1 | 2 | 3; // 1 = low, 3 = high
  requires: {
    meals?: boolean;
    exercise?: boolean;
    sleep?: boolean;
    profile?: boolean;
  };

  // Phase 3: Action bridge (optional)
  action?: {
    label: string;
    intent: "log" | "review" | "adjust";
  };
};

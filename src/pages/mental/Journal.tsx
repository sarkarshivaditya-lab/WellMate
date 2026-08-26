import React from "react";
import AiMentalCoach from "./AiMentalCoach";

export default function Journal() {
  return (
    <div className="p-6 space-y-8 max-w-2xl mx-auto">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Mental</h1>
        <p className="text-sm text-muted-foreground">
          A space for reflection, clarity, and emotional wellbeing.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        You don’t need to have the right words here.
        <br />
        This space exists to support you — quietly, safely, and without judgment.
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">WellMate</h2>
          <p className="text-sm text-muted-foreground">
            Your mental wellbeing companion.  
            Talk things through, find grounding, or just check in.
          </p>
        </div>

        <div className="rounded-xl border bg-background p-4">
          <AiMentalCoach />
        </div>
      </div>
    </div>
  );
}

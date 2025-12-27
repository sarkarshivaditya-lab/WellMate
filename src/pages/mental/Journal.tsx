import React from "react";
import AiMentalCoach from "./AiMentalCoach";

export default function Journal() {
  return (
    <div className="p-6 space-y-8 max-w-2xl">
      {/* ======================================================
         Mental Header
         ====================================================== */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Mental</h1>
        <p className="text-sm text-muted-foreground">
          A space for reflection, clarity, and emotional wellbeing.
        </p>
      </div>

      {/* ======================================================
         Gentle Orientation
         ====================================================== */}
      <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        You don’t need to have the right words here.
        <br />
        This space exists to support you — quietly, safely, and without judgment.
      </div>

      {/* ======================================================
         WellMate – Mental AI Companion
         ====================================================== */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">WellMate</h2>
          <p className="text-sm text-muted-foreground">
            Your mental wellbeing companion.  
            Talk things through, find grounding, or just check in.
          </p>
        </div>

        {/* AI Mental Coach */}
        <div className="rounded-xl border bg-background p-4">
          <AiMentalCoach />
        </div>
      </div>

      {/* ======================================================
         Future Journal Section (Placeholder)
         ====================================================== */}
      <div className="pt-6 border-t space-y-2 text-sm text-muted-foreground">
        <p>
          Journaling and reflections will live here soon.
        </p>
        <p>
          For now, you can talk to WellMate above whenever you need support.
        </p>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import PracticeCard from "@/components/PracticeCard";
import practicesData from "@/data/practices.json";
import { CheckCircle2Icon } from "lucide-react";

interface Practice {
  id: string;
  title: string;
  type: "breathing" | "gratitude" | "reflection" | "grounding";
  steps: string[];
}

const FILTERS = [
  { value: null, label: "All" },
  { value: "breathing", label: "Breathing" },
  { value: "gratitude", label: "Gratitude" },
  { value: "reflection", label: "Reflection" },
  { value: "grounding", label: "Grounding" },
] as const;

/* ======================================================
   TOOLS CONTENT — embeddable inside a tab or full page
   ====================================================== */

export function ToolsTabContent() {
  const [selectedPractice, setSelectedPractice] = useState<Practice | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [filter, setFilter] = useState<string | null>(null);

  const practices = practicesData as Practice[];
  const filteredPractices = filter
    ? practices.filter((p) => p.type === filter)
    : practices;

  const handleStart = (practice: Practice) => {
    setSelectedPractice(practice);
    setCurrentStep(0);
  };

  const handleClose = () => {
    setSelectedPractice(null);
    setCurrentStep(0);
  };

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(f.value)}
            className={cn(
              "flex-shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium min-h-[36px]",
              "transition-premium",
              filter === f.value
                ? "bg-primary text-primary-foreground border-transparent"
                : "border-border text-muted-foreground hover:text-foreground hover:border-border/80",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Practice grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {filteredPractices.map((practice) => (
          <PracticeCard
            key={practice.id}
            practice={practice}
            onClick={() => handleStart(practice)}
          />
        ))}
      </div>

      {/* Active practice dialog */}
      <Dialog open={selectedPractice !== null} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {selectedPractice && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedPractice.title}</DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Step {currentStep + 1} of {selectedPractice.steps.length}
                    </span>
                    <span className="text-muted-foreground">
                      {Math.round(((currentStep + 1) / selectedPractice.steps.length) * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${((currentStep + 1) / selectedPractice.steps.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Current step */}
                <div className="py-8 text-center">
                  <p className="text-lg leading-relaxed">
                    {selectedPractice.steps[currentStep]}
                  </p>
                </div>

                {/* All steps */}
                <div className="space-y-2 pt-4 border-t border-border/40">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    All steps
                  </p>
                  {selectedPractice.steps.map((step, index) => (
                    <div
                      key={index}
                      className={cn(
                        "flex items-start gap-2 rounded-xl p-2 transition-premium",
                        index === currentStep && "bg-primary/8",
                      )}
                    >
                      {index <= currentStep ? (
                        <CheckCircle2Icon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted mt-0.5 flex-shrink-0" />
                      )}
                      <p className="text-sm">{step}</p>
                    </div>
                  ))}
                </div>

                {/* Navigation */}
                <div className="flex gap-2">
                  <Button
                    onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
                    disabled={currentStep === 0}
                    variant="outline"
                    className="flex-1"
                  >
                    Previous
                  </Button>
                  {currentStep < selectedPractice.steps.length - 1 ? (
                    <Button
                      onClick={() => setCurrentStep((s) => s + 1)}
                      className="flex-1"
                    >
                      Next
                    </Button>
                  ) : (
                    <Button onClick={handleClose} className="flex-1">
                      Complete
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ======================================================
   STANDALONE PAGE — routed directly
   ====================================================== */

export default function Tools() {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Wellbeing Tools</h1>
        <p className="text-sm text-muted-foreground">
          A collection of guided practices you can use anytime.
        </p>
      </div>
      <ToolsTabContent />
    </div>
  );
}

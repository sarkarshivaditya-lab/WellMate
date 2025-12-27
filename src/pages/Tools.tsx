import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import PracticeCard from "@/components/PracticeCard";
import practicesData from "@/data/practices.json";
import { CheckCircle2Icon } from "lucide-react";

interface Practice {
  id: string;
  title: string;
  type: "breathing" | "gratitude" | "reflection" | "grounding";
  steps: string[];
}

export default function Tools() {
  const [selectedPractice, setSelectedPractice] = useState<Practice | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [filter, setFilter] = useState<string | null>(null);

  const practices = practicesData as Practice[];
  const filteredPractices = filter
    ? practices.filter((p) => p.type === filter)
    : practices;

  const filters = [
    { value: null, label: "All" },
    { value: "breathing", label: "Breathing" },
    { value: "gratitude", label: "Gratitude" },
    { value: "reflection", label: "Reflection" },
    { value: "grounding", label: "Grounding" },
  ];

  return (
    <div className="space-y-6 p-6 pb-24 max-w-5xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Wellbeing Tools</h1>
        <p className="text-sm text-muted-foreground">
          Choose a practice to support your mental wellbeing.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto">
        {filters.map((f) => (
          <Badge
            key={f.label}
            variant={filter === f.value ? "default" : "outline"}
            className="cursor-pointer whitespace-nowrap"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Badge>
        ))}
      </div>

      {/* Practice cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPractices.map((practice) => (
          <PracticeCard
            key={practice.id}
            practice={practice}
            onClick={() => {
              setSelectedPractice(practice);
              setCurrentStep(0);
            }}
          />
        ))}
      </div>

      {/* Practice dialog */}
      <Dialog
        open={selectedPractice !== null}
        onOpenChange={(open) => !open && setSelectedPractice(null)}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          {selectedPractice && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedPractice.title}</DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>
                      Step {currentStep + 1} of{" "}
                      {selectedPractice.steps.length}
                    </span>
                    <span>
                      {Math.round(
                        ((currentStep + 1) /
                          selectedPractice.steps.length) *
                          100,
                      )}
                      %
                    </span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${
                          ((currentStep + 1) /
                            selectedPractice.steps.length) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Current step */}
                <div className="py-6 text-center">
                  <p className="text-lg leading-relaxed">
                    {selectedPractice.steps[currentStep]}
                  </p>
                </div>

                {/* All steps */}
                <div className="space-y-2 border-t pt-4">
                  {selectedPractice.steps.map((step, index) => (
                    <div
                      key={index}
                      className={`flex gap-2 p-2 rounded ${
                        index === currentStep ? "bg-primary/10" : ""
                      }`}
                    >
                      {index <= currentStep ? (
                        <CheckCircle2Icon className="h-5 w-5 text-primary mt-0.5" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border border-muted mt-0.5" />
                      )}
                      <p className="text-sm">{step}</p>
                    </div>
                  ))}
                </div>

                {/* Controls */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={currentStep === 0}
                    onClick={() =>
                      setCurrentStep((s) => Math.max(0, s - 1))
                    }
                    className="flex-1"
                  >
                    Previous
                  </Button>
                  {currentStep <
                  selectedPractice.steps.length - 1 ? (
                    <Button
                      onClick={() =>
                        setCurrentStep((s) => s + 1)
                      }
                      className="flex-1"
                    >
                      Next
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setSelectedPractice(null)}
                      className="flex-1"
                    >
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

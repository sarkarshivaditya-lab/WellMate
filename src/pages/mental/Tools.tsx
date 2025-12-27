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

  const handleStartPractice = (practice: Practice) => {
    setSelectedPractice(practice);
    setCurrentStep(0);
  };

  const handleNextStep = () => {
    if (selectedPractice && currentStep < selectedPractice.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    setSelectedPractice(null);
    setCurrentStep(0);
  };

  const filters = [
    { value: null, label: "All" },
    { value: "breathing", label: "Breathing" },
    { value: "gratitude", label: "Gratitude" },
    { value: "reflection", label: "Reflection" },
    { value: "grounding", label: "Grounding" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Wellbeing Tools</h1>
        <p className="text-sm text-muted-foreground">
          A collection of guided practices you can use anytime.
        </p>
      </div>

      {/* Filters (secondary) */}
      <div className="flex gap-2 overflow-x-auto pb-1">
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

      {/* Practices */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {filteredPractices.map((practice) => (
          <PracticeCard
            key={practice.id}
            practice={practice}
            onClick={() => handleStartPractice(practice)}
          />
        ))}
      </div>

      {/* Practice Dialog */}
      <Dialog
        open={selectedPractice !== null}
        onOpenChange={(open) => !open && handleClose()}
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
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Step {currentStep + 1} of{" "}
                      {selectedPractice.steps.length}
                    </span>
                    <span className="text-muted-foreground">
                      {Math.round(
                        ((currentStep + 1) /
                          selectedPractice.steps.length) *
                          100,
                      )}
                      %
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
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

                {/* Current Step */}
                <div className="py-8 text-center">
                  <p className="text-lg leading-relaxed">
                    {selectedPractice.steps[currentStep]}
                  </p>
                </div>

                {/* All Steps */}
                <div className="space-y-2 pt-4 border-t">
                  <p className="text-sm font-medium text-muted-foreground">
                    All steps
                  </p>
                  {selectedPractice.steps.map((step, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-2 rounded p-2 ${
                        index === currentStep ? "bg-primary/10" : ""
                      }`}
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
                    onClick={handlePrevStep}
                    disabled={currentStep === 0}
                    variant="outline"
                    className="flex-1"
                  >
                    Previous
                  </Button>
                  {currentStep <
                  selectedPractice.steps.length - 1 ? (
                    <Button onClick={handleNextStep} className="flex-1">
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

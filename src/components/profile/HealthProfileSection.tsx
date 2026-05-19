import React from "react";
import {
  User,
  Activity,
  Heart,
  Shield,
  ChevronRight,
  X,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useEditableProfile } from "@/hooks/useEditableProfile";
import { OnboardingPayload } from "@/data/local/onboardingPayload";
import { HealthExtras } from "@/data/local/healthExtras";

// ── Utilities ─────────────────────────────────────────────────────────────────

function ageFromDob(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function cmToFtIn(cm: number): string {
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn % 12);
  return `${ft}′${inches}″`;
}

function ftInToCm(ft: string, inch: string): number {
  return parseFloat(ft || "0") * 30.48 + parseFloat(inch || "0") * 2.54;
}

function cmFromString(s: string): number {
  return parseFloat(s) || 0;
}

function kgToLbs(kg: number): number {
  return Math.round(kg * 2.205 * 10) / 10;
}

function lbsToKg(lbs: string): number {
  return parseFloat(lbs) / 2.205;
}

function stepsDisplay(steps: string): string {
  const n = parseInt(steps);
  if (isNaN(n)) return steps;
  return n.toLocaleString() + " steps/day";
}

function extrasPreview(items: string[]): string | null {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]}, ${items[1]}`;
  return `${items[0]} and ${items.length - 1} more`;
}

function extrasCount(items: string[], text?: string): string | null {
  const count =
    items.reduce((n) => n + 1, 0) + (text && text.trim() ? 1 : 0);
  if (count === 0) return null;
  return `${count} item${count !== 1 ? "s" : ""}`;
}

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sedentary",
  light: "Lightly Active",
  moderate: "Moderately Active",
  active: "Active",
  veryActive: "Very Active",
};

const GOAL_LABELS: Record<string, string> = {
  lose: "Lose weight",
  maintain: "Maintain",
  gain: "Gain weight",
};

const MUSCLE_LABELS: Record<string, string> = {
  build: "Build muscle",
  maintain: "Maintain",
  cut: "Cut",
};

const SEX_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
};

const STEPS_OPTIONS = [
  { value: "2500", label: "2,500" },
  { value: "5000", label: "5,000" },
  { value: "7500", label: "7,500" },
  { value: "10000", label: "10,000" },
  { value: "12500", label: "12,500+" },
];

const DIET_PRESETS = [
  "Vegetarian",
  "Vegan",
  "Gluten-Free",
  "Dairy-Free",
  "Nut-Free",
  "Halal",
  "Kosher",
  "Low-Carb",
  "Keto",
  "Paleo",
];

const ALLERGY_PRESETS = [
  "Peanuts",
  "Tree Nuts",
  "Milk",
  "Eggs",
  "Fish",
  "Shellfish",
  "Wheat",
  "Soy",
  "Sesame",
];

const LIMITATION_PRESETS = [
  "Low impact only",
  "No jumping",
  "Seated exercises",
  "Upper body only",
  "Lower body only",
  "Light stretching only",
];

const ACCESSIBILITY_PRESETS = [
  "Wheelchair accessible",
  "No stairs",
  "Seating required",
  "Vision impairment",
  "Hearing impairment",
];

// ── Small shared primitives ────────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  placeholder = "Not set",
  onEdit,
}: {
  label: string;
  value?: string | null;
  placeholder?: string;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        "w-full flex items-center justify-between gap-3 px-4 py-3.5",
        "text-left transition-colors hover:bg-muted/30 active:bg-muted/50",
      )}
    >
      <span className="text-[14px] text-foreground/80 shrink-0">{label}</span>
      <span
        className={cn(
          "text-[14px] truncate text-right",
          value ? "text-foreground font-medium" : "text-muted-foreground/50",
        )}
      >
        {value ?? placeholder}
      </span>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 flex-shrink-0" />
    </button>
  );
}

function AddRow({
  label,
  onEdit,
}: {
  label: string;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        "w-full flex items-center gap-2 px-4 py-3.5",
        "text-left transition-colors hover:bg-muted/30 active:bg-muted/50",
      )}
    >
      <Plus className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
      <span className="text-[14px] text-primary/70">{label}</span>
    </button>
  );
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden card-shadow-rest">
      <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2.5">
        <span className="text-primary/60">{icon}</span>
        <span className="text-[12px] font-semibold tracking-wide text-muted-foreground uppercase">
          {title}
        </span>
      </div>
      <div className="divide-y divide-border/25">{children}</div>
    </div>
  );
}

function OptionButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 py-2.5 text-[13px] font-medium rounded-xl border transition-premium",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-foreground/70 border-border/50 hover:border-primary/40",
      )}
    >
      {label}
    </button>
  );
}

function TagInput({
  tags,
  onChange,
  placeholder,
  presets,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  presets?: string[];
}) {
  const [input, setInput] = React.useState("");

  function add(value: string) {
    const t = value.trim();
    if (!t || tags.includes(t)) return;
    onChange([...tags, t]);
    setInput("");
  }

  function remove(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  const unusedPresets = presets?.filter((p) => !tags.includes(p)) ?? [];

  return (
    <div className="space-y-3">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[12px] font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                aria-label={`Remove ${tag}`}
                className="ml-0.5 hover:opacity-70 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {unusedPresets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unusedPresets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => add(preset)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-medium",
                "border border-border/50 text-muted-foreground",
                "hover:border-primary/40 hover:text-primary transition-premium",
              )}
            >
              + {preset}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder ?? "Type and add..."}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(input);
            }
          }}
          className="flex-1 h-10 text-[14px]"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => add(input)}
          disabled={!input.trim()}
          className="h-10 px-3"
        >
          Add
        </Button>
      </div>
    </div>
  );
}

function SheetSaveBar({
  onCancel,
  onSave,
  disabled?: boolean,
}: {
  onCancel: () => void;
  onSave: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-3 pt-4 border-t border-border/30 mt-auto flex-shrink-0">
      <Button
        variant="outline"
        className="flex-1"
        onClick={onCancel}
      >
        Cancel
      </Button>
      <Button
        className="flex-1"
        onClick={onSave}
        disabled={disabled}
      >
        Save
      </Button>
    </div>
  );
}

function FormField({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[13px] font-medium text-foreground/80">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function HealthProfileSection() {
  const { profile, extras, updateProfile, updateExtras } =
    useEditableProfile();

  // Sheet open state
  const [bodyOpen, setBodyOpen] = React.useState(false);
  const [activityOpen, setActivityOpen] = React.useState(false);
  const [cycleOpen, setCycleOpen] = React.useState(false);
  const [dietOpen, setDietOpen] = React.useState(false);
  const [healthOpen, setHealthOpen] = React.useState(false);
  const [recoveryOpen, setRecoveryOpen] = React.useState(false);

  // ── Body metrics form state ──────────────────────────────────────────────────
  const [dob, setDob] = React.useState("");
  const [sex, setSex] = React.useState<"male" | "female" | "other" | "">("");
  const [heightUnit, setHeightUnit] = React.useState<"cm" | "ftin">("cm");
  const [heightCmStr, setHeightCmStr] = React.useState("");
  const [heightFt, setHeightFt] = React.useState("");
  const [heightIn, setHeightIn] = React.useState("");
  const [weightUnit, setWeightUnit] = React.useState<"kg" | "lbs">("kg");
  const [weightStr, setWeightStr] = React.useState("");

  React.useEffect(() => {
    if (!bodyOpen) return;
    setDob(profile?.dob ?? "");
    setSex(profile?.sex ?? "");
    setHeightUnit("cm");
    setHeightCmStr(profile?.heightCm ? String(Math.round(profile.heightCm)) : "");
    setHeightFt("");
    setHeightIn("");
    setWeightUnit("kg");
    setWeightStr(profile?.weightKg ? String(profile.weightKg) : "");
  }, [bodyOpen, profile]);

  function resolvedHeightCm(): number {
    if (heightUnit === "cm") return cmFromString(heightCmStr);
    return ftInToCm(heightFt, heightIn);
  }

  function saveBody() {
    const h = resolvedHeightCm();
    const w =
      weightUnit === "kg"
        ? parseFloat(weightStr) || 0
        : lbsToKg(weightStr);
    const patch: Partial<Omit<OnboardingPayload, "createdAt">> = {
      dob,
      sex,
    };
    if (h > 0) patch.heightCm = h;
    if (w > 0) patch.weightKg = w;
    updateProfile(patch);
    setBodyOpen(false);
  }

  // ── Activity & goals form state ──────────────────────────────────────────────
  const [activityLevel, setActivityLevel] = React.useState<
    OnboardingPayload["activityLevel"]
  >(null);
  const [dailySteps, setDailySteps] = React.useState("7500");
  const [weightGoal, setWeightGoal] = React.useState("");
  const [muscleGoal, setMuscleGoal] = React.useState("");

  React.useEffect(() => {
    if (!activityOpen) return;
    setActivityLevel(profile?.activityLevel ?? null);
    setDailySteps(profile?.dailySteps ?? "7500");
    setWeightGoal(profile?.weightGoal ?? "");
    setMuscleGoal(profile?.muscleGoal ?? "");
  }, [activityOpen, profile]);

  function saveActivity() {
    updateProfile({ activityLevel, dailySteps, weightGoal, muscleGoal });
    setActivityOpen(false);
  }

  // ── Cycle form state ─────────────────────────────────────────────────────────
  const [cycleLength, setCycleLength] = React.useState("");
  const [lastPeriod, setLastPeriod] = React.useState("");

  React.useEffect(() => {
    if (!cycleOpen) return;
    setCycleLength(profile?.cycleLength ? String(profile.cycleLength) : "");
    setLastPeriod(profile?.lastPeriod ?? "");
  }, [cycleOpen, profile]);

  function saveCycle() {
    const len = parseInt(cycleLength);
    updateProfile({
      cycleLength: isNaN(len) ? undefined : len,
      lastPeriod: lastPeriod || undefined,
    });
    setCycleOpen(false);
  }

  // ── Diet & allergies form state ──────────────────────────────────────────────
  const [dietRestrictions, setDietRestrictions] = React.useState<string[]>([]);
  const [allergies, setAllergies] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!dietOpen) return;
    setDietRestrictions([...extras.dietaryRestrictions]);
    setAllergies([...extras.allergies]);
  }, [dietOpen, extras]);

  function saveDiet() {
    updateExtras({ dietaryRestrictions: dietRestrictions, allergies });
    setDietOpen(false);
  }

  // ── Health conditions form state ─────────────────────────────────────────────
  const [conditions, setConditions] = React.useState<string[]>([]);
  const [injuries, setInjuries] = React.useState<string[]>([]);
  const [medications, setMedications] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!healthOpen) return;
    setConditions([...extras.medicalConditions]);
    setInjuries([...extras.injuries]);
    setMedications([...extras.medications]);
  }, [healthOpen, extras]);

  function saveHealth() {
    updateExtras({
      medicalConditions: conditions,
      injuries,
      medications,
    });
    setHealthOpen(false);
  }

  // ── Recovery & limitations form state ───────────────────────────────────────
  const [limitations, setLimitations] = React.useState<string[]>([]);
  const [accessibilityNeeds, setAccessibilityNeeds] = React.useState<string[]>([]);
  const [recoveryNotes, setRecoveryNotes] = React.useState("");
  const [mentalNotes, setMentalNotes] = React.useState("");

  React.useEffect(() => {
    if (!recoveryOpen) return;
    setLimitations([...extras.exerciseLimitations]);
    setAccessibilityNeeds([...extras.accessibilityNeeds]);
    setRecoveryNotes(extras.recoveryNotes);
    setMentalNotes(extras.mentalWellnessNotes);
  }, [recoveryOpen, extras]);

  function saveRecovery() {
    updateExtras({
      exerciseLimitations: limitations,
      accessibilityNeeds,
      recoveryNotes,
      mentalWellnessNotes: mentalNotes,
    });
    setRecoveryOpen(false);
  }

  // ── Display helpers ──────────────────────────────────────────────────────────

  const age = profile?.dob ? ageFromDob(profile.dob) : null;

  const heightDisplay = profile?.heightCm
    ? `${Math.round(profile.heightCm)} cm · ${cmToFtIn(profile.heightCm)}`
    : null;

  const weightDisplay = profile?.weightKg
    ? `${profile.weightKg} kg · ${kgToLbs(profile.weightKg)} lbs`
    : null;

  const dietPreview = (() => {
    const all = [...extras.dietaryRestrictions, ...extras.allergies];
    return extrasPreview(all);
  })();

  const healthPreview = (() => {
    const all = [
      ...extras.medicalConditions,
      ...extras.injuries,
      ...extras.medications,
    ];
    return extrasCount(all) ?? null;
  })();

  const recoveryPreview = (() => {
    const all = [...extras.exerciseLimitations, ...extras.accessibilityNeeds];
    const hasNotes =
      extras.recoveryNotes.trim() || extras.mentalWellnessNotes.trim();
    return extrasCount(all, hasNotes ? "x" : "") ?? null;
  })();

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-1 mb-2">
        <h2 className="text-[18px] font-semibold tracking-tight">
          Health Profile
        </h2>
        <p className="text-[13px] text-muted-foreground">
          Your personal health baseline. Edit anytime as things change.
        </p>
      </div>

      <div className="space-y-3">
        {/* Body Metrics */}
        <SectionCard icon={<User className="h-4 w-4" />} title="Body Metrics">
          <MetricRow
            label="Age"
            value={age !== null ? `${age} years` : null}
            placeholder="Set date of birth"
            onEdit={() => setBodyOpen(true)}
          />
          <MetricRow
            label="Sex"
            value={profile?.sex ? SEX_LABELS[profile.sex] : null}
            placeholder="Not set"
            onEdit={() => setBodyOpen(true)}
          />
          <MetricRow
            label="Height"
            value={heightDisplay}
            placeholder="Set height"
            onEdit={() => setBodyOpen(true)}
          />
          <MetricRow
            label="Weight"
            value={weightDisplay}
            placeholder="Set weight"
            onEdit={() => setBodyOpen(true)}
          />
        </SectionCard>

        {/* Activity & Goals */}
        <SectionCard
          icon={<Activity className="h-4 w-4" />}
          title="Activity & Goals"
        >
          <MetricRow
            label="Activity Level"
            value={
              profile?.activityLevel
                ? ACTIVITY_LABELS[profile.activityLevel]
                : null
            }
            placeholder="Set activity level"
            onEdit={() => setActivityOpen(true)}
          />
          <MetricRow
            label="Daily Steps"
            value={profile?.dailySteps ? stepsDisplay(profile.dailySteps) : null}
            placeholder="Set step goal"
            onEdit={() => setActivityOpen(true)}
          />
          <MetricRow
            label="Weight Goal"
            value={
              profile?.weightGoal ? GOAL_LABELS[profile.weightGoal] : null
            }
            placeholder="Set weight goal"
            onEdit={() => setActivityOpen(true)}
          />
          <MetricRow
            label="Muscle Goal"
            value={
              profile?.muscleGoal ? MUSCLE_LABELS[profile.muscleGoal] : null
            }
            placeholder="Set muscle goal"
            onEdit={() => setActivityOpen(true)}
          />
        </SectionCard>

        {/* Cycle Health — females only */}
        {(profile?.sex === "female" || profile?.cycleLength || profile?.lastPeriod) && (
          <SectionCard
            icon={<Heart className="h-4 w-4" />}
            title="Cycle Health"
          >
            <MetricRow
              label="Average Cycle Length"
              value={
                profile?.cycleLength
                  ? `${profile.cycleLength} days`
                  : null
              }
              placeholder="Set cycle length"
              onEdit={() => setCycleOpen(true)}
            />
            <MetricRow
              label="Last Period"
              value={
                profile?.lastPeriod
                  ? new Date(profile.lastPeriod).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : null
              }
              placeholder="Set last period date"
              onEdit={() => setCycleOpen(true)}
            />
          </SectionCard>
        )}

        {/* Additional Health */}
        <SectionCard
          icon={<Shield className="h-4 w-4" />}
          title="Additional Health"
        >
          {dietPreview ? (
            <MetricRow
              label="Diet & Allergies"
              value={dietPreview}
              onEdit={() => setDietOpen(true)}
            />
          ) : (
            <AddRow label="Add dietary preferences" onEdit={() => setDietOpen(true)} />
          )}

          {healthPreview ? (
            <MetricRow
              label="Health Conditions"
              value={healthPreview}
              onEdit={() => setHealthOpen(true)}
            />
          ) : (
            <AddRow
              label="Add health conditions or medications"
              onEdit={() => setHealthOpen(true)}
            />
          )}

          {recoveryPreview ? (
            <MetricRow
              label="Activity Limitations"
              value={recoveryPreview}
              onEdit={() => setRecoveryOpen(true)}
            />
          ) : (
            <AddRow
              label="Add activity and recovery notes"
              onEdit={() => setRecoveryOpen(true)}
            />
          )}
        </SectionCard>
      </div>

      {/* ── Body Metrics Sheet ─────────────────────────────────────────────── */}
      <Sheet open={bodyOpen} onOpenChange={setBodyOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] flex flex-col rounded-t-2xl"
        >
          <SheetHeader className="flex-shrink-0 pb-3">
            <SheetTitle>Body Metrics</SheetTitle>
            <SheetDescription>
              Used to personalise nutrition targets and wellness insights.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-5 py-2 pr-0.5">
            <FormField label="Date of Birth">
              <Input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="h-11 text-[14px]"
              />
            </FormField>

            <FormField label="Biological Sex">
              <div className="flex gap-2">
                {(["male", "female", "other"] as const).map((s) => (
                  <OptionButton
                    key={s}
                    label={SEX_LABELS[s]}
                    active={sex === s}
                    onClick={() => setSex(s)}
                  />
                ))}
              </div>
            </FormField>

            <FormField label="Height">
              <div className="flex gap-2 mb-2">
                <OptionButton
                  label="cm"
                  active={heightUnit === "cm"}
                  onClick={() => setHeightUnit("cm")}
                />
                <OptionButton
                  label="ft / in"
                  active={heightUnit === "ftin"}
                  onClick={() => setHeightUnit("ftin")}
                />
              </div>
              {heightUnit === "cm" ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={heightCmStr}
                    onChange={(e) => setHeightCmStr(e.target.value)}
                    placeholder="178"
                    min={50}
                    max={300}
                    className="h-11 text-[14px]"
                  />
                  <span className="text-[14px] text-muted-foreground w-8">cm</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={heightFt}
                    onChange={(e) => setHeightFt(e.target.value)}
                    placeholder="5"
                    min={1}
                    max={9}
                    className="h-11 text-[14px]"
                  />
                  <span className="text-[14px] text-muted-foreground">ft</span>
                  <Input
                    type="number"
                    value={heightIn}
                    onChange={(e) => setHeightIn(e.target.value)}
                    placeholder="10"
                    min={0}
                    max={11}
                    className="h-11 text-[14px]"
                  />
                  <span className="text-[14px] text-muted-foreground">in</span>
                </div>
              )}
            </FormField>

            <FormField label="Weight">
              <div className="flex gap-2 mb-2">
                <OptionButton
                  label="kg"
                  active={weightUnit === "kg"}
                  onClick={() => {
                    if (weightUnit === "lbs" && weightStr) {
                      setWeightStr(
                        String(Math.round(lbsToKg(weightStr) * 10) / 10),
                      );
                    }
                    setWeightUnit("kg");
                  }}
                />
                <OptionButton
                  label="lbs"
                  active={weightUnit === "lbs"}
                  onClick={() => {
                    if (weightUnit === "kg" && weightStr) {
                      setWeightStr(
                        String(kgToLbs(parseFloat(weightStr))),
                      );
                    }
                    setWeightUnit("lbs");
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={weightStr}
                  onChange={(e) => setWeightStr(e.target.value)}
                  placeholder={weightUnit === "kg" ? "75" : "165"}
                  min={20}
                  max={weightUnit === "kg" ? 500 : 1100}
                  step={0.1}
                  className="h-11 text-[14px]"
                />
                <span className="text-[14px] text-muted-foreground w-8">
                  {weightUnit}
                </span>
              </div>
            </FormField>
          </div>

          <SheetSaveBar onCancel={() => setBodyOpen(false)} onSave={saveBody} />
        </SheetContent>
      </Sheet>

      {/* ── Activity & Goals Sheet ─────────────────────────────────────────── */}
      <Sheet open={activityOpen} onOpenChange={setActivityOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] flex flex-col rounded-t-2xl"
        >
          <SheetHeader className="flex-shrink-0 pb-3">
            <SheetTitle>Activity &amp; Goals</SheetTitle>
            <SheetDescription>
              Calibrates your calorie targets and personalised insights.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-5 py-2 pr-0.5">
            <FormField label="Activity Level">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(
                  [
                    "sedentary",
                    "light",
                    "moderate",
                    "active",
                    "veryActive",
                  ] as const
                ).map((level) => (
                  <OptionButton
                    key={level}
                    label={ACTIVITY_LABELS[level]}
                    active={activityLevel === level}
                    onClick={() => setActivityLevel(level)}
                  />
                ))}
              </div>
            </FormField>

            <FormField
              label="Daily Step Goal"
              hint="Used for activity scoring and recommendations."
            >
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {STEPS_OPTIONS.map((opt) => (
                  <OptionButton
                    key={opt.value}
                    label={opt.label}
                    active={dailySteps === opt.value}
                    onClick={() => setDailySteps(opt.value)}
                  />
                ))}
              </div>
            </FormField>

            <FormField label="Weight Goal">
              <div className="flex gap-2">
                {(["lose", "maintain", "gain"] as const).map((g) => (
                  <OptionButton
                    key={g}
                    label={GOAL_LABELS[g]}
                    active={weightGoal === g}
                    onClick={() => setWeightGoal(g)}
                  />
                ))}
              </div>
            </FormField>

            <FormField label="Muscle Goal">
              <div className="flex gap-2">
                {(["build", "maintain", "cut"] as const).map((g) => (
                  <OptionButton
                    key={g}
                    label={MUSCLE_LABELS[g]}
                    active={muscleGoal === g}
                    onClick={() => setMuscleGoal(g)}
                  />
                ))}
              </div>
            </FormField>
          </div>

          <SheetSaveBar
            onCancel={() => setActivityOpen(false)}
            onSave={saveActivity}
          />
        </SheetContent>
      </Sheet>

      {/* ── Cycle Health Sheet ─────────────────────────────────────────────── */}
      <Sheet open={cycleOpen} onOpenChange={setCycleOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] flex flex-col rounded-t-2xl"
        >
          <SheetHeader className="flex-shrink-0 pb-3">
            <SheetTitle>Cycle Health</SheetTitle>
            <SheetDescription>
              Optional context for cycle-aware wellness insights.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-5 py-2 pr-0.5">
            <FormField label="Average Cycle Length" hint="Typically 21–35 days.">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={cycleLength}
                  onChange={(e) => setCycleLength(e.target.value)}
                  placeholder="28"
                  min={15}
                  max={60}
                  className="h-11 text-[14px]"
                />
                <span className="text-[14px] text-muted-foreground">days</span>
              </div>
            </FormField>

            <FormField label="Last Period Start Date">
              <Input
                type="date"
                value={lastPeriod}
                onChange={(e) => setLastPeriod(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="h-11 text-[14px]"
              />
            </FormField>
          </div>

          <SheetSaveBar
            onCancel={() => setCycleOpen(false)}
            onSave={saveCycle}
          />
        </SheetContent>
      </Sheet>

      {/* ── Diet & Allergies Sheet ─────────────────────────────────────────── */}
      <Sheet open={dietOpen} onOpenChange={setDietOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] flex flex-col rounded-t-2xl"
        >
          <SheetHeader className="flex-shrink-0 pb-3">
            <SheetTitle>Diet &amp; Allergies</SheetTitle>
            <SheetDescription>
              Helps personalise nutrition advice and food recommendations.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-6 py-2 pr-0.5">
            <FormField label="Dietary Preferences">
              <TagInput
                tags={dietRestrictions}
                onChange={setDietRestrictions}
                placeholder="e.g. Low sugar..."
                presets={DIET_PRESETS}
              />
            </FormField>

            <FormField label="Allergies &amp; Food Intolerances">
              <TagInput
                tags={allergies}
                onChange={setAllergies}
                placeholder="e.g. Sesame..."
                presets={ALLERGY_PRESETS}
              />
            </FormField>
          </div>

          <SheetSaveBar
            onCancel={() => setDietOpen(false)}
            onSave={saveDiet}
          />
        </SheetContent>
      </Sheet>

      {/* ── Health Conditions Sheet ────────────────────────────────────────── */}
      <Sheet open={healthOpen} onOpenChange={setHealthOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] flex flex-col rounded-t-2xl"
        >
          <SheetHeader className="flex-shrink-0 pb-3">
            <SheetTitle>Health Conditions</SheetTitle>
            <SheetDescription>
              Optional context — helps WellMate give more relevant suggestions.
              Not shared or stored on external servers.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-6 py-2 pr-0.5">
            <FormField label="Medical Conditions">
              <TagInput
                tags={conditions}
                onChange={setConditions}
                placeholder="e.g. Type 2 diabetes..."
              />
            </FormField>

            <FormField label="Injuries or Physical Limitations">
              <TagInput
                tags={injuries}
                onChange={setInjuries}
                placeholder="e.g. Knee injury..."
              />
            </FormField>

            <FormField label="Medications">
              <TagInput
                tags={medications}
                onChange={setMedications}
                placeholder="e.g. Metformin..."
              />
            </FormField>
          </div>

          <SheetSaveBar
            onCancel={() => setHealthOpen(false)}
            onSave={saveHealth}
          />
        </SheetContent>
      </Sheet>

      {/* ── Activity Limitations & Recovery Sheet ─────────────────────────── */}
      <Sheet open={recoveryOpen} onOpenChange={setRecoveryOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[90dvh] flex flex-col rounded-t-2xl"
        >
          <SheetHeader className="flex-shrink-0 pb-3">
            <SheetTitle>Activity &amp; Recovery</SheetTitle>
            <SheetDescription>
              Helps WellMate suggest appropriate exercises and recovery strategies.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-6 py-2 pr-0.5">
            <FormField label="Exercise Limitations">
              <TagInput
                tags={limitations}
                onChange={setLimitations}
                placeholder="e.g. No high impact..."
                presets={LIMITATION_PRESETS}
              />
            </FormField>

            <FormField label="Accessibility Needs">
              <TagInput
                tags={accessibilityNeeds}
                onChange={setAccessibilityNeeds}
                placeholder="e.g. Wheelchair accessible..."
                presets={ACCESSIBILITY_PRESETS}
              />
            </FormField>

            <FormField
              label="Recovery Notes"
              hint="Optional. How you prefer to recover or any considerations."
            >
              <Textarea
                value={recoveryNotes}
                onChange={(e) => setRecoveryNotes(e.target.value)}
                placeholder="e.g. I need rest days after intense sessions..."
                rows={3}
                className="text-[14px] resize-none"
              />
            </FormField>

            <FormField
              label="Mental Wellness Considerations"
              hint="Optional. Helps tailor mood and stress recommendations."
            >
              <Textarea
                value={mentalNotes}
                onChange={(e) => setMentalNotes(e.target.value)}
                placeholder="e.g. Managing anxiety, prefer calm activities..."
                rows={3}
                className="text-[14px] resize-none"
              />
            </FormField>
          </div>

          <SheetSaveBar
            onCancel={() => setRecoveryOpen(false)}
            onSave={saveRecovery}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

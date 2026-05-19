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
import { Button } from "@/components/ui/button";
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

// ── Utilities (unchanged) ──────────────────────────────────────────────────────

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
  const count = items.length + (text && text.trim() ? 1 : 0);
  if (count === 0) return null;
  return `${count} item${count !== 1 ? "s" : ""}`;
}

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sedentary",
  light: "Light",
  moderate: "Moderate",
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
  { value: "2500",  label: "2,500"   },
  { value: "5000",  label: "5,000"   },
  { value: "7500",  label: "7,500"   },
  { value: "10000", label: "10,000"  },
  { value: "12500", label: "12,500+" },
];

const DIET_PRESETS = [
  "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free",
  "Nut-Free", "Halal", "Kosher", "Low-Carb", "Keto", "Paleo",
];

const ALLERGY_PRESETS = [
  "Peanuts", "Tree Nuts", "Milk", "Eggs",
  "Fish", "Shellfish", "Wheat", "Soy", "Sesame",
];

const LIMITATION_PRESETS = [
  "Low impact only", "No jumping", "Seated exercises",
  "Upper body only", "Lower body only", "Light stretching only",
];

const ACCESSIBILITY_PRESETS = [
  "Wheelchair accessible", "No stairs", "Seating required",
  "Vision impairment", "Hearing impairment",
];

// ── Shared input style ────────────────────────────────────────────────────────
// Native inputs styled as wellness surfaces: soft fill, ambient focus glow.

const inputCls = cn(
  "w-full h-12 px-4 text-[15px] font-normal rounded-xl",
  "bg-muted/30 border border-border/30",
  "text-foreground placeholder:text-muted-foreground/35",
  "focus:outline-none focus:ring-1 focus:ring-primary/25 focus:border-primary/35",
  "transition-premium",
);

const textareaCls = cn(
  "w-full px-4 py-3 text-[14px] font-normal rounded-xl resize-none",
  "bg-muted/30 border border-border/30",
  "text-foreground placeholder:text-muted-foreground/35",
  "focus:outline-none focus:ring-1 focus:ring-primary/25 focus:border-primary/35",
  "transition-premium",
);

// ── Design primitives ─────────────────────────────────────────────────────────

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
        "w-full flex items-center justify-between gap-3 px-5 py-[15px]",
        "text-left transition-premium active:scale-[0.99]",
        "hover:bg-muted/20 active:bg-muted/30",
      )}
    >
      <span className="text-[14px] text-foreground/65 font-normal shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={cn(
            "text-[14px] truncate text-right",
            value
              ? "text-foreground font-medium"
              : "text-muted-foreground/30 font-normal",
          )}
        >
          {value ?? placeholder}
        </span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/20 flex-shrink-0" />
      </div>
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
        "w-full flex items-center justify-between gap-2 px-5 py-[15px]",
        "text-left transition-premium hover:bg-muted/20 active:bg-muted/30 active:scale-[0.99]",
      )}
    >
      <span className="text-[14px] text-muted-foreground/45 font-normal">
        {label}
      </span>
      <Plus className="h-3.5 w-3.5 text-muted-foreground/25 flex-shrink-0" />
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
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden card-shadow-rest">
      <div className="px-5 py-3.5 border-b border-border/25 flex items-center gap-3">
        <div className="w-6 h-6 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
          <span className="text-primary/55">{icon}</span>
        </div>
        <span className="text-[11px] font-semibold tracking-[0.07em] text-muted-foreground/55 uppercase">
          {title}
        </span>
      </div>
      <div className="divide-y divide-border/20">{children}</div>
    </div>
  );
}

// Chip selector — soft tinted fill instead of solid primary.
// Selected: gentle primary glow. Unselected: neutral muted surface.
function OptionChip({
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
        "flex-1 py-[11px] px-2 text-[13px] rounded-2xl border transition-premium active:scale-[0.97]",
        active
          ? "bg-primary/10 text-primary font-semibold border-primary/20"
          : "bg-muted/50 text-foreground/50 font-medium border-transparent hover:bg-muted/80 hover:text-foreground/70",
      )}
    >
      {label}
    </button>
  );
}

// Tag system — applied items use the secondary palette (soft teal).
// Presets are ghost pills that invite one-tap addition.
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
    <div className="space-y-4">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-[12px] font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                aria-label={`Remove ${tag}`}
                className="hover:opacity-60 transition-opacity flex-shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {unusedPresets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {unusedPresets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => add(preset)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[12px] font-medium",
                "bg-muted/50 text-foreground/55 border border-transparent",
                "hover:bg-secondary hover:text-secondary-foreground",
                "transition-premium active:scale-[0.97]",
              )}
            >
              {preset}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder ?? "Type to add…"}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(input);
            }
          }}
          className={cn(inputCls, "flex-1 h-11")}
        />
        <button
          type="button"
          onClick={() => add(input)}
          disabled={!input.trim()}
          className={cn(
            "h-11 px-4 rounded-xl text-[13px] font-medium",
            "bg-muted/60 text-foreground/60 border border-border/20",
            "disabled:opacity-25 transition-premium hover:bg-muted/80",
          )}
        >
          Add
        </button>
      </div>
    </div>
  );
}

// Premium sticky action footer — stacked layout, full-width primary.
// Cancel recedes visually; Save is authoritative.
function SheetSaveBar({
  onCancel,
  onSave,
  disabled,
}: {
  onCancel: () => void;
  onSave: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex-shrink-0 px-6 pt-3",
        "pb-[max(1.5rem,env(safe-area-inset-bottom))]",
        "border-t border-border/15",
        "bg-gradient-to-t from-card via-card/95 to-card/0",
      )}
    >
      <Button
        className="w-full h-12 rounded-2xl text-[15px] font-semibold shadow-none"
        onClick={onSave}
        disabled={disabled}
      >
        Save
      </Button>
      <button
        type="button"
        onClick={onCancel}
        className="w-full pt-3 pb-0.5 text-[13px] text-muted-foreground/45 font-medium transition-opacity hover:opacity-70"
      >
        Cancel
      </button>
    </div>
  );
}

// Form field — uppercase label system creates medical-adjacent structure.
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
    <div className="space-y-2.5">
      <div className="text-[11px] font-semibold tracking-[0.07em] uppercase text-muted-foreground/55">
        {label}
      </div>
      {children}
      {hint && (
        <p className="text-[12px] text-muted-foreground/45 leading-relaxed">
          {hint}
        </p>
      )}
    </div>
  );
}

// Drag handle — standard iOS bottom sheet affordance.
function DragHandle() {
  return (
    <div className="w-10 h-[3px] rounded-full bg-border/50 mx-auto mb-5 flex-shrink-0" />
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function HealthProfileSection() {
  const { profile, extras, updateProfile, updateExtras } =
    useEditableProfile();

  const [bodyOpen,     setBodyOpen]     = React.useState(false);
  const [activityOpen, setActivityOpen] = React.useState(false);
  const [cycleOpen,    setCycleOpen]    = React.useState(false);
  const [dietOpen,     setDietOpen]     = React.useState(false);
  const [healthOpen,   setHealthOpen]   = React.useState(false);
  const [recoveryOpen, setRecoveryOpen] = React.useState(false);

  // ── Body form ────────────────────────────────────────────────────────────────
  const [dob,        setDob]        = React.useState("");
  const [sex,        setSex]        = React.useState<"male" | "female" | "other" | "">("");
  const [heightUnit, setHeightUnit] = React.useState<"cm" | "ftin">("cm");
  const [heightCmStr,setHeightCmStr]= React.useState("");
  const [heightFt,   setHeightFt]   = React.useState("");
  const [heightIn,   setHeightIn]   = React.useState("");
  const [weightUnit, setWeightUnit] = React.useState<"kg" | "lbs">("kg");
  const [weightStr,  setWeightStr]  = React.useState("");

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
    const w = weightUnit === "kg" ? parseFloat(weightStr) || 0 : lbsToKg(weightStr);
    const patch: Partial<Omit<OnboardingPayload, "createdAt">> = { dob, sex };
    if (h > 0) patch.heightCm = h;
    if (w > 0) patch.weightKg = w;
    updateProfile(patch);
    setBodyOpen(false);
  }

  // ── Activity form ────────────────────────────────────────────────────────────
  const [activityLevel, setActivityLevel] = React.useState<OnboardingPayload["activityLevel"]>(null);
  const [dailySteps,    setDailySteps]    = React.useState("7500");
  const [weightGoal,    setWeightGoal]    = React.useState("");
  const [muscleGoal,    setMuscleGoal]    = React.useState("");

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

  // ── Cycle form ───────────────────────────────────────────────────────────────
  const [cycleLength, setCycleLength] = React.useState("");
  const [lastPeriod,  setLastPeriod]  = React.useState("");

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

  // ── Diet form ────────────────────────────────────────────────────────────────
  const [dietRestrictions, setDietRestrictions] = React.useState<string[]>([]);
  const [allergies,        setAllergies]        = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!dietOpen) return;
    setDietRestrictions([...extras.dietaryRestrictions]);
    setAllergies([...extras.allergies]);
  }, [dietOpen, extras]);

  function saveDiet() {
    updateExtras({ dietaryRestrictions: dietRestrictions, allergies });
    setDietOpen(false);
  }

  // ── Health form ──────────────────────────────────────────────────────────────
  const [conditions,  setConditions]  = React.useState<string[]>([]);
  const [injuries,    setInjuries]    = React.useState<string[]>([]);
  const [medications, setMedications] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!healthOpen) return;
    setConditions([...extras.medicalConditions]);
    setInjuries([...extras.injuries]);
    setMedications([...extras.medications]);
  }, [healthOpen, extras]);

  function saveHealth() {
    updateExtras({ medicalConditions: conditions, injuries, medications });
    setHealthOpen(false);
  }

  // ── Recovery form ────────────────────────────────────────────────────────────
  const [limitations,       setLimitations]       = React.useState<string[]>([]);
  const [accessibilityNeeds,setAccessibilityNeeds] = React.useState<string[]>([]);
  const [recoveryNotes,     setRecoveryNotes]      = React.useState("");
  const [mentalNotes,       setMentalNotes]        = React.useState("");

  React.useEffect(() => {
    if (!recoveryOpen) return;
    setLimitations([...extras.exerciseLimitations]);
    setAccessibilityNeeds([...extras.accessibilityNeeds]);
    setRecoveryNotes(extras.recoveryNotes);
    setMentalNotes(extras.mentalWellnessNotes);
  }, [recoveryOpen, extras]);

  function saveRecovery() {
    updateExtras({ exerciseLimitations: limitations, accessibilityNeeds, recoveryNotes, mentalWellnessNotes: mentalNotes });
    setRecoveryOpen(false);
  }

  // ── Display values ───────────────────────────────────────────────────────────
  const age = profile?.dob ? ageFromDob(profile.dob) : null;

  const heightDisplay = profile?.heightCm
    ? `${Math.round(profile.heightCm)} cm · ${cmToFtIn(profile.heightCm)}`
    : null;

  const weightDisplay = profile?.weightKg
    ? `${profile.weightKg} kg · ${kgToLbs(profile.weightKg)} lbs`
    : null;

  const dietPreview = extrasPreview([
    ...extras.dietaryRestrictions,
    ...extras.allergies,
  ]);

  const healthPreview = extrasCount([
    ...extras.medicalConditions,
    ...extras.injuries,
    ...extras.medications,
  ]);

  const recoveryPreview = (() => {
    const all = [...extras.exerciseLimitations, ...extras.accessibilityNeeds];
    const hasNotes = extras.recoveryNotes.trim() || extras.mentalWellnessNotes.trim();
    return extrasCount(all, hasNotes ? "x" : "");
  })();

  // ── Shared sheet scaffold ─────────────────────────────────────────────────────
  // Each sheet has: drag handle · header · scrollable form · sticky action bar.

  return (
    <>
      {/* Section header */}
      <div className="mb-5">
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
          Health Profile
        </h2>
        <p className="text-[13px] text-muted-foreground/65 mt-0.5">
          Your personal baseline. Edit anytime.
        </p>
      </div>

      <div className="space-y-2.5">
        {/* Body */}
        <SectionCard icon={<User className="h-3.5 w-3.5" />} title="Body">
          <MetricRow label="Age"    value={age !== null ? `${age} years` : null} placeholder="Add your birthday" onEdit={() => setBodyOpen(true)} />
          <MetricRow label="Sex"    value={profile?.sex ? SEX_LABELS[profile.sex] : null} placeholder="Not set" onEdit={() => setBodyOpen(true)} />
          <MetricRow label="Height" value={heightDisplay} placeholder="Add height" onEdit={() => setBodyOpen(true)} />
          <MetricRow label="Weight" value={weightDisplay} placeholder="Add weight" onEdit={() => setBodyOpen(true)} />
        </SectionCard>

        {/* Movement */}
        <SectionCard icon={<Activity className="h-3.5 w-3.5" />} title="Movement">
          <MetricRow label="Activity level" value={profile?.activityLevel ? ACTIVITY_LABELS[profile.activityLevel] : null} placeholder="Set activity level" onEdit={() => setActivityOpen(true)} />
          <MetricRow label="Daily steps"    value={profile?.dailySteps ? stepsDisplay(profile.dailySteps) : null} placeholder="Set step goal" onEdit={() => setActivityOpen(true)} />
          <MetricRow label="Weight goal"    value={profile?.weightGoal ? GOAL_LABELS[profile.weightGoal] : null} placeholder="Set weight goal" onEdit={() => setActivityOpen(true)} />
          <MetricRow label="Muscle goal"    value={profile?.muscleGoal ? MUSCLE_LABELS[profile.muscleGoal] : null} placeholder="Set muscle goal" onEdit={() => setActivityOpen(true)} />
        </SectionCard>

        {/* Cycle — conditionally shown */}
        {(profile?.sex === "female" || profile?.cycleLength || profile?.lastPeriod) && (
          <SectionCard icon={<Heart className="h-3.5 w-3.5" />} title="Cycle Health">
            <MetricRow label="Average cycle" value={profile?.cycleLength ? `${profile.cycleLength} days` : null} placeholder="Set cycle length" onEdit={() => setCycleOpen(true)} />
            <MetricRow
              label="Last period"
              value={profile?.lastPeriod ? new Date(profile.lastPeriod).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null}
              placeholder="Set last period"
              onEdit={() => setCycleOpen(true)}
            />
          </SectionCard>
        )}

        {/* Health context */}
        <SectionCard icon={<Shield className="h-3.5 w-3.5" />} title="Health Context">
          {dietPreview
            ? <MetricRow label="Diet & allergies"   value={dietPreview}   onEdit={() => setDietOpen(true)} />
            : <AddRow label="Tell us about your diet & allergies"           onEdit={() => setDietOpen(true)} />}
          {healthPreview
            ? <MetricRow label="Health background"  value={healthPreview}  onEdit={() => setHealthOpen(true)} />
            : <AddRow label="Add health background"                         onEdit={() => setHealthOpen(true)} />}
          {recoveryPreview
            ? <MetricRow label="Movement & recovery" value={recoveryPreview} onEdit={() => setRecoveryOpen(true)} />
            : <AddRow label="Add movement considerations"                   onEdit={() => setRecoveryOpen(true)} />}
        </SectionCard>
      </div>

      {/* ── Your body sheet ─────────────────────────────────────────────────── */}
      <Sheet open={bodyOpen} onOpenChange={setBodyOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh] flex flex-col rounded-t-3xl p-0">
          <DragHandle />
          <SheetHeader className="flex-shrink-0 px-6 pb-5 pt-0">
            <SheetTitle className="text-[20px] font-semibold tracking-tight">Your body</SheetTitle>
            <SheetDescription className="text-[13px] text-muted-foreground/55 mt-1 leading-snug">
              Helps WellMate understand your unique physiology.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-7">
            <FormField label="Birthday">
              <input type="date" value={dob} onChange={(e) => setDob(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className={inputCls}
              />
            </FormField>

            <FormField label="Sex">
              <div className="flex gap-2">
                {(["male", "female", "other"] as const).map((s) => (
                  <OptionChip key={s} label={SEX_LABELS[s]} active={sex === s} onClick={() => setSex(s)} />
                ))}
              </div>
            </FormField>

            <FormField label="Height">
              <div className="flex gap-2 mb-3">
                <OptionChip label="cm" active={heightUnit === "cm"} onClick={() => setHeightUnit("cm")} />
                <OptionChip label="ft / in" active={heightUnit === "ftin"} onClick={() => setHeightUnit("ftin")} />
              </div>
              {heightUnit === "cm" ? (
                <div className="flex items-center gap-3">
                  <input type="number" value={heightCmStr} onChange={(e) => setHeightCmStr(e.target.value)}
                    placeholder="e.g. 178" min={50} max={300} className={cn(inputCls, "flex-1")} />
                  <span className="text-[14px] text-muted-foreground/60 w-8">cm</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <input type="number" value={heightFt} onChange={(e) => setHeightFt(e.target.value)}
                    placeholder="5" min={1} max={9} className={cn(inputCls, "flex-1")} />
                  <span className="text-[14px] text-muted-foreground/60">ft</span>
                  <input type="number" value={heightIn} onChange={(e) => setHeightIn(e.target.value)}
                    placeholder="10" min={0} max={11} className={cn(inputCls, "flex-1")} />
                  <span className="text-[14px] text-muted-foreground/60">in</span>
                </div>
              )}
            </FormField>

            <FormField label="Weight">
              <div className="flex gap-2 mb-3">
                <OptionChip label="kg" active={weightUnit === "kg"} onClick={() => {
                  if (weightUnit === "lbs" && weightStr) setWeightStr(String(Math.round(lbsToKg(weightStr) * 10) / 10));
                  setWeightUnit("kg");
                }} />
                <OptionChip label="lbs" active={weightUnit === "lbs"} onClick={() => {
                  if (weightUnit === "kg" && weightStr) setWeightStr(String(kgToLbs(parseFloat(weightStr))));
                  setWeightUnit("lbs");
                }} />
              </div>
              <div className="flex items-center gap-3">
                <input type="number" value={weightStr}
                  onChange={(e) => setWeightStr(e.target.value)}
                  placeholder={weightUnit === "kg" ? "e.g. 75" : "e.g. 165"}
                  min={20} max={weightUnit === "kg" ? 500 : 1100} step={0.1}
                  className={cn(inputCls, "flex-1")}
                />
                <span className="text-[14px] text-muted-foreground/60 w-8">{weightUnit}</span>
              </div>
            </FormField>
          </div>

          <SheetSaveBar onCancel={() => setBodyOpen(false)} onSave={saveBody} />
        </SheetContent>
      </Sheet>

      {/* ── Movement & Goals sheet ───────────────────────────────────────────── */}
      <Sheet open={activityOpen} onOpenChange={setActivityOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh] flex flex-col rounded-t-3xl p-0">
          <DragHandle />
          <SheetHeader className="flex-shrink-0 px-6 pb-5 pt-0">
            <SheetTitle className="text-[20px] font-semibold tracking-tight">Movement &amp; Goals</SheetTitle>
            <SheetDescription className="text-[13px] text-muted-foreground/55 mt-1 leading-snug">
              Shapes your energy targets and activity insights.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-7">
            <FormField label="How active are you?">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {(["sedentary", "light", "moderate", "active", "veryActive"] as const).map((level) => (
                  <OptionChip key={level} label={ACTIVITY_LABELS[level]}
                    active={activityLevel === level} onClick={() => setActivityLevel(level)} />
                ))}
              </div>
            </FormField>

            <FormField label="Daily steps" hint="Factors into your activity score and goal tracking.">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {STEPS_OPTIONS.map((opt) => (
                  <OptionChip key={opt.value} label={opt.label}
                    active={dailySteps === opt.value} onClick={() => setDailySteps(opt.value)} />
                ))}
              </div>
            </FormField>

            <FormField label="Weight direction">
              <div className="flex gap-2">
                {(["lose", "maintain", "gain"] as const).map((g) => (
                  <OptionChip key={g} label={GOAL_LABELS[g]} active={weightGoal === g} onClick={() => setWeightGoal(g)} />
                ))}
              </div>
            </FormField>

            <FormField label="Muscle focus">
              <div className="flex gap-2">
                {(["build", "maintain", "cut"] as const).map((g) => (
                  <OptionChip key={g} label={MUSCLE_LABELS[g]} active={muscleGoal === g} onClick={() => setMuscleGoal(g)} />
                ))}
              </div>
            </FormField>
          </div>

          <SheetSaveBar onCancel={() => setActivityOpen(false)} onSave={saveActivity} />
        </SheetContent>
      </Sheet>

      {/* ── Cycle health sheet ───────────────────────────────────────────────── */}
      <Sheet open={cycleOpen} onOpenChange={setCycleOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh] flex flex-col rounded-t-3xl p-0">
          <DragHandle />
          <SheetHeader className="flex-shrink-0 px-6 pb-5 pt-0">
            <SheetTitle className="text-[20px] font-semibold tracking-tight">Your cycle</SheetTitle>
            <SheetDescription className="text-[13px] text-muted-foreground/55 mt-1 leading-snug">
              Optional — shapes cycle-aware wellbeing insights.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-7">
            <FormField label="Your average cycle" hint="Typically 21–35 days.">
              <div className="flex items-center gap-3">
                <input type="number" value={cycleLength} onChange={(e) => setCycleLength(e.target.value)}
                  placeholder="28" min={15} max={60} className={cn(inputCls, "flex-1")} />
                <span className="text-[14px] text-muted-foreground/60">days</span>
              </div>
            </FormField>

            <FormField label="Last cycle started">
              <input type="date" value={lastPeriod} onChange={(e) => setLastPeriod(e.target.value)}
                max={new Date().toISOString().split("T")[0]} className={inputCls} />
            </FormField>
          </div>

          <SheetSaveBar onCancel={() => setCycleOpen(false)} onSave={saveCycle} />
        </SheetContent>
      </Sheet>

      {/* ── Food preferences sheet ───────────────────────────────────────────── */}
      <Sheet open={dietOpen} onOpenChange={setDietOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh] flex flex-col rounded-t-3xl p-0">
          <DragHandle />
          <SheetHeader className="flex-shrink-0 px-6 pb-5 pt-0">
            <SheetTitle className="text-[20px] font-semibold tracking-tight">Food Preferences</SheetTitle>
            <SheetDescription className="text-[13px] text-muted-foreground/55 mt-1 leading-snug">
              Personalises your nutrition insights and food suggestions.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-8">
            <FormField label="Dietary style">
              <TagInput tags={dietRestrictions} onChange={setDietRestrictions}
                placeholder="e.g. Low sugar…" presets={DIET_PRESETS} />
            </FormField>

            <FormField label="Allergies &amp; intolerances">
              <TagInput tags={allergies} onChange={setAllergies}
                placeholder="e.g. Sesame…" presets={ALLERGY_PRESETS} />
            </FormField>
          </div>

          <SheetSaveBar onCancel={() => setDietOpen(false)} onSave={saveDiet} />
        </SheetContent>
      </Sheet>

      {/* ── Health background sheet ──────────────────────────────────────────── */}
      <Sheet open={healthOpen} onOpenChange={setHealthOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh] flex flex-col rounded-t-3xl p-0">
          <DragHandle />
          <SheetHeader className="flex-shrink-0 px-6 pb-5 pt-0">
            <SheetTitle className="text-[20px] font-semibold tracking-tight">Health Background</SheetTitle>
            <SheetDescription className="text-[13px] text-muted-foreground/55 mt-1 leading-snug">
              Optional — stays private on your device. Helps WellMate give more relevant suggestions.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-8">
            <FormField label="Health conditions">
              <TagInput tags={conditions} onChange={setConditions} placeholder="e.g. Type 2 diabetes…" />
            </FormField>

            <FormField label="Current injuries">
              <TagInput tags={injuries} onChange={setInjuries} placeholder="e.g. Knee injury…" />
            </FormField>

            <FormField label="Medications">
              <TagInput tags={medications} onChange={setMedications} placeholder="e.g. Metformin…" />
            </FormField>
          </div>

          <SheetSaveBar onCancel={() => setHealthOpen(false)} onSave={saveHealth} />
        </SheetContent>
      </Sheet>

      {/* ── Movement & recovery sheet ────────────────────────────────────────── */}
      <Sheet open={recoveryOpen} onOpenChange={setRecoveryOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh] flex flex-col rounded-t-3xl p-0">
          <DragHandle />
          <SheetHeader className="flex-shrink-0 px-6 pb-5 pt-0">
            <SheetTitle className="text-[20px] font-semibold tracking-tight">Movement &amp; Recovery</SheetTitle>
            <SheetDescription className="text-[13px] text-muted-foreground/55 mt-1 leading-snug">
              Helps WellMate suggest appropriate exercises and support your recovery.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4 space-y-8">
            <FormField label="Movement considerations">
              <TagInput tags={limitations} onChange={setLimitations}
                placeholder="e.g. No high impact…" presets={LIMITATION_PRESETS} />
            </FormField>

            <FormField label="Accessibility">
              <TagInput tags={accessibilityNeeds} onChange={setAccessibilityNeeds}
                placeholder="e.g. Wheelchair accessible…" presets={ACCESSIBILITY_PRESETS} />
            </FormField>

            <FormField label="How you recover" hint="Optional context for recovery suggestions.">
              <textarea
                value={recoveryNotes}
                onChange={(e) => setRecoveryNotes(e.target.value)}
                placeholder="e.g. I need rest days after intense sessions…"
                rows={3}
                className={textareaCls}
              />
            </FormField>

            <FormField label="Mental wellness" hint="Helps tailor stress and mood support.">
              <textarea
                value={mentalNotes}
                onChange={(e) => setMentalNotes(e.target.value)}
                placeholder="e.g. Managing anxiety, prefer calm activities…"
                rows={3}
                className={textareaCls}
              />
            </FormField>
          </div>

          <SheetSaveBar onCancel={() => setRecoveryOpen(false)} onSave={saveRecovery} />
        </SheetContent>
      </Sheet>
    </>
  );
}

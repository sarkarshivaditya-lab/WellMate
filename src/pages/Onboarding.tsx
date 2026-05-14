import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  readOnboardingDraft,
  saveOnboardingDraft,
  clearOnboardingDraft,
} from "@/data/local/onboardingPayload";

/* ======================================================
   ONBOARDING — FULL 8 STEP FLOW
   ====================================================== */

type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "veryActive";

export default function Onboarding() {
  const navigate = useNavigate();

  // Redirect users who already completed onboarding — they should never
  // land here again. RequireAuth on /physical handles re-login if needed.
  useEffect(() => {
    if (localStorage.getItem("onboarded") === "true") {
      navigate("/physical", { replace: true });
    }
  }, [navigate]);

  /* ---------- NO AUTH GUARD DURING ONBOARDING ---------- */

  const setHeightUnitAndSync = (nextUnit: "cm" | "ftin") => {
    if (nextUnit === heightUnit) return;

    if (nextUnit === "ftin") {
      // cm -> ft/in (derive from existing cm)
      const cm = Number(height);
      if (Number.isFinite(cm) && cm > 0) {
        const totalIn = Math.round(cm / 2.54);
        const ft = Math.floor(totalIn / 12);
        const inches = totalIn - ft * 12;
        setHeightFt(String(ft));
        setHeightIn(String(inches));
      } else {
        setHeightFt("");
        setHeightIn("");
      }
      setHeightUnit("ftin");
      return;
    }

    // ft/in -> cm (commit current ft/in into cm)
    const ft = Number(heightFt);
    const rawIn = Number(heightIn);
    const clampedIn = Number.isFinite(rawIn)
      ? Math.min(11, Math.max(0, rawIn))
      : 0;
    const cm = (Number.isFinite(ft) ? ft : 0) * 30.48 + clampedIn * 2.54;
    setHeight(Number.isFinite(cm) && cm > 0 ? String(cm) : "");
    setHeightUnit("cm");
  };

  /* ---------- core step ---------- */
  const [step, setStep] = useState(() => readOnboardingDraft()?.step ?? 1);

  /* ---------- identity ---------- */
  const [dob, setDob] = useState(() => readOnboardingDraft()?.dob ?? "");
  const [sex, setSex] = useState(() => readOnboardingDraft()?.sex ?? "");

  /* ---------- body metrics ---------- */
  const [height, setHeight] = useState(
    () => readOnboardingDraft()?.height ?? "",
  );
  const [heightUnit, setHeightUnit] = useState<"cm" | "ftin">(
    () => readOnboardingDraft()?.heightUnit ?? "cm",
  );
  const [heightFt, setHeightFt] = useState(
    () => readOnboardingDraft()?.heightFt ?? "",
  );
  const [heightIn, setHeightIn] = useState(
    () => readOnboardingDraft()?.heightIn ?? "",
  );
  const [weight, setWeight] = useState(() => readOnboardingDraft()?.weight ?? "");

  /* ---------- height unit conversion (step 2) ---------- */
  useEffect(() => {
    if (heightUnit !== "ftin") return;

    const ft = Number(heightFt);
    const rawIn = Number(heightIn);
    const clampedIn = Number.isFinite(rawIn)
      ? Math.min(11, Math.max(0, rawIn))
      : 0;

    // Clamp inches immediately (UI + normalization)
    if (heightIn !== "" && rawIn !== clampedIn) {
      setHeightIn(String(clampedIn));
    }

    const cm = (Number.isFinite(ft) ? ft : 0) * 30.48 + clampedIn * 2.54;
    if (cm > 0) {
      setHeight(String(cm));
    } else {
      setHeight("");
    }
  }, [heightUnit, heightFt, heightIn]);

  /* ---------- activity ---------- */
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(
    () => (readOnboardingDraft()?.activityLevel as ActivityLevel | null) ?? null,
  );
  const [dailySteps, setDailySteps] = useState(
    () => readOnboardingDraft()?.dailySteps ?? "",
  );

  /* ---------- goals ---------- */
  const [weightGoal, setWeightGoal] = useState(
    () => readOnboardingDraft()?.weightGoal ?? "",
  );
  const [muscleGoal, setMuscleGoal] = useState(
    () => readOnboardingDraft()?.muscleGoal ?? "",
  );

  /* ---------- female health ---------- */
  const [cycleLength, setCycleLength] = useState(
    () => readOnboardingDraft()?.cycleLength ?? "",
  );
  const [lastPeriod, setLastPeriod] = useState(
    () => readOnboardingDraft()?.lastPeriod ?? "",
  );

  const [additionalHealthChoice, setAdditionalHealthChoice] = useState(
    () => readOnboardingDraft()?.additionalHealthChoice ?? "",
  );
  const [additionalHealthNotes, setAdditionalHealthNotes] = useState(
    () => readOnboardingDraft()?.additionalHealthNotes ?? "",
  );

  const [attemptedNext, setAttemptedNext] = useState(false);

  /* ---------- persist draft on every field change ---------- */
  useEffect(() => {
    saveOnboardingDraft({
      step,
      dob,
      sex,
      height,
      heightUnit,
      heightFt,
      heightIn,
      weight,
      activityLevel,
      dailySteps,
      weightGoal,
      muscleGoal,
      cycleLength,
      lastPeriod,
      additionalHealthChoice,
      additionalHealthNotes,
    });
  }, [
    step,
    dob,
    sex,
    height,
    heightUnit,
    heightFt,
    heightIn,
    weight,
    activityLevel,
    dailySteps,
    weightGoal,
    muscleGoal,
    cycleLength,
    lastPeriod,
    additionalHealthChoice,
    additionalHealthNotes,
  ]);

  function buildOnboardingProfile() {
    return {
      dob,
      sex,

      heightCm: Number(height) || null,
      weightKg: Number(weight) || null,

      activityLevel,
      dailySteps,

      weightGoal,
      muscleGoal,

      cycleLength: sex === "female" ? Number(cycleLength) || null : null,
      lastPeriod: sex === "female" ? lastPeriod || null : null,

      additionalHealth:
        sex !== "female" && additionalHealthChoice === "yes"
          ? additionalHealthNotes || null
          : null,

      // metadata
      completedAt: Date.now(),
      source: "onboarding",
    };
  }

  /* ---------- navigation ---------- */
  function isStepValid() {
    if (step === 1) return Boolean(dob && sex);
    if (step === 2) {
      if (!(Number(weight) > 0)) return false;

      if (heightUnit === "cm") {
        return Number(height) > 0;
      }

      const ft = Number(heightFt);
      const rawIn = Number(heightIn);
      const clampedIn = Number.isFinite(rawIn)
        ? Math.min(11, Math.max(0, rawIn))
        : 0;
      const cm = (Number.isFinite(ft) ? ft : 0) * 30.48 + clampedIn * 2.54;

      return Number.isFinite(ft) && ft > 0 && cm > 0;
    }
    if (step === 3) return Boolean(activityLevel);
    if (step === 5) return Boolean(weightGoal);
    return true;
  }

  const next = () => {
    setAttemptedNext(true);
    if (!isStepValid()) return;
    setAttemptedNext(false);
    if (step === 7 && sex !== "female") {
      setStep(8);
    } else {
      setStep((s) => Math.min(8, s + 1));
    }
  };

  const back = () => setStep((s) => Math.max(1, s - 1));

  const finish = async () => {
    setAttemptedNext(true);
    if (!isStepValid()) return;
    setAttemptedNext(false);

    const profile = buildOnboardingProfile();

    // Persist onboarding snapshot (pre-auth, offline-safe)
    localStorage.setItem("onboarding_profile", JSON.stringify(profile));

    // Mark onboarding complete and clear in-progress draft
    localStorage.setItem("onboarded", "true");
    localStorage.removeItem("postOnboardingTransitionShown");
    clearOnboardingDraft();

    navigate("/physical");
  };

  /* ======================================================
     CALCULATIONS (STEP 8 ONLY)
     ====================================================== */

  const age = dob
    ? Math.floor(
        (Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
      )
    : 0;

  const w = Number(weight);
  const h = Number(height);

  let BMR = 0;
  if (sex === "male") {
    BMR = 10 * w + 6.25 * h - 5 * age + 5;
  } else if (sex === "female") {
    BMR = 10 * w + 6.25 * h - 5 * age - 161;
  }

  const activityMultiplierMap: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    veryActive: 1.9,
  };

  const multiplier =
    (activityLevel ? activityMultiplierMap[activityLevel] : undefined) || 1.2;
  const maintenanceCalories = Math.round(BMR * multiplier);

  let goalCalories = maintenanceCalories;
  if (weightGoal === "lose") goalCalories -= 300;
  if (weightGoal === "gain") goalCalories += 300;

  /* ======================================================
     RENDER
     ====================================================== */

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-b from-[hsl(var(--header-gradient-start))] to-background">
      <div className="bg-card rounded-3xl border border-border card-shadow-hover p-8 sm:p-10 max-w-md w-full space-y-8">

        {/* ================= HEADER ================= */}
        <div className="space-y-6">

          {/* Brand + progress */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                WellMate
              </span>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {step} / 8
              </span>
            </div>
            <div className="h-[3px] rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(step / 8) * 100}%` }}
              />
            </div>
          </div>

          {/* Step heading */}
          <div className="space-y-1.5">
            <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.01em] text-foreground">
              {step === 1 && "Welcome to WellMate"}
              {step === 2 && "Your body metrics"}
              {step === 3 && "Your daily activity"}
              {step === 4 && "Your movement habits"}
              {step === 5 && "Your weight goal"}
              {step === 6 && "Your muscle focus"}
              {step === 7 && "Additional health details"}
              {step === 8 && "Your health snapshot"}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {step === 1 && "Let's personalize your health experience."}
              {step === 2 && "These help us estimate your daily energy needs."}
              {step === 3 && "Your activity level shapes your calorie baseline."}
              {step === 4 && "Daily movement helps refine accuracy."}
              {step === 5 && "We'll adjust recommendations based on your goal."}
              {step === 6 && "This helps prioritize strength vs balance."}
              {step === 7 && "Only if applicable to you."}
              {step === 8 && "Here's what we've learned about you."}
            </p>
          </div>
        </div>

        {/* ================= STEPS ================= */}

        {/* STEP 1 — IDENTITY */}
        {step === 1 && (
          <div className="space-y-5">
            <Field
              label="Date of Birth"
              type="date"
              value={dob}
              onChange={(v) => {
                setDob(v);
                setAttemptedNext(false);
              }}
            />
            {attemptedNext && !dob && <ValidationError />}

            <Select
              label="Biological Sex"
              value={sex}
              onChange={(v) => {
                setSex(v);
                setAttemptedNext(false);
              }}
              options={[
                { value: "", label: "Select" },
                { value: "female", label: "Female" },
                { value: "male", label: "Male" },
                { value: "other", label: "Other" },
              ]}
            />
            {attemptedNext && !sex && <ValidationError />}
          </div>
        )}

        {/* STEP 2 — BODY */}
        {step === 2 && (
          <div className="space-y-5">
            {/* Segmented unit control */}
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Height unit
              </p>
              <div className="inline-flex bg-muted rounded-xl p-1 gap-1">
                {(["cm", "ftin"] as const).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => setHeightUnitAndSync(unit)}
                    aria-pressed={heightUnit === unit}
                    className={`
                      px-5 py-1.5 rounded-lg text-sm font-medium transition-premium
                      ${heightUnit === unit
                        ? "bg-card text-foreground card-shadow-rest"
                        : "text-muted-foreground hover:text-foreground"
                      }
                    `}
                  >
                    {unit === "cm" ? "cm" : "ft + in"}
                  </button>
                ))}
              </div>
            </div>

            {heightUnit === "cm" && (
              <Field
                label="Height (cm)"
                type="number"
                value={height}
                onChange={(v) => {
                  setHeight(v);
                  setAttemptedNext(false);
                }}
              />
            )}

            {heightUnit === "ftin" && (
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Height (ft)"
                  type="number"
                  value={heightFt}
                  onChange={(v) => {
                    setHeightFt(v);
                    setAttemptedNext(false);
                  }}
                />
                <Field
                  label="Height (in)"
                  type="number"
                  value={heightIn}
                  onChange={(v) => {
                    setHeightIn(v);
                    setAttemptedNext(false);
                  }}
                />
              </div>
            )}
            {attemptedNext && Number(height) <= 0 && <ValidationError />}

            <Field
              label="Weight (kg)"
              type="number"
              value={weight}
              onChange={(v) => {
                setWeight(v);
                setAttemptedNext(false);
              }}
            />
            {attemptedNext && Number(weight) <= 0 && <ValidationError />}
          </div>
        )}

        {/* STEP 3 — ACTIVITY */}
        {step === 3 && (
          <>
            <ChoiceGroup
              label="How active are you on a typical day?"
              value={(activityLevel ?? "") as string}
              onChange={
                ((v: string) => {
                  (setActivityLevel as (value: string) => void)(v);
                  setAttemptedNext(false);
                }) as (value: string) => void
              }
              options={[
                ["sedentary", "Sedentary", "Mostly sitting"],
                ["light", "Lightly active", "Some walking"],
                ["moderate", "Moderately active", "Exercise 3–5× / week"],
                ["active", "Active", "Daily exercise"],
                ["veryActive", "Very active", "Hard training or physical job"],
              ]}
            />
            {attemptedNext && !activityLevel && <ValidationError />}
          </>
        )}

        {/* STEP 4 — STEPS */}
        {step === 4 && (
          <ChoiceGroup
            label="Average daily steps"
            value={dailySteps}
            onChange={setDailySteps}
            options={[
              ["<5k", "< 5,000"],
              ["5–7k", "5,000 – 7,500"],
              ["7–10k", "7,500 – 10,000"],
              ["10k+", "10,000+"],
            ]}
          />
        )}

        {/* STEP 5 — WEIGHT GOAL */}
        {step === 5 && (
          <>
            <ChoiceGroup
              label="Primary weight goal"
              value={weightGoal}
              onChange={(v) => {
                setWeightGoal(v);
                setAttemptedNext(false);
              }}
              options={[
                ["lose", "Lose fat"],
                ["maintain", "Maintain weight"],
                ["gain", "Gain weight"],
              ]}
            />
            {attemptedNext && !weightGoal && <ValidationError />}
          </>
        )}

        {/* STEP 6 — MUSCLE */}
        {step === 6 && (
          <ChoiceGroup
            label="Muscle goal"
            value={muscleGoal}
            onChange={setMuscleGoal}
            options={[
              ["gain", "Gain muscle"],
              ["maintain", "Maintain muscle"],
              ["none", "Not a priority"],
            ]}
          />
        )}

        {/* STEP 7 — FEMALE HEALTH */}
        {step === 7 && sex === "female" && (
          <div className="space-y-5">
            <Field
              label="Cycle length (days)"
              type="number"
              value={cycleLength}
              onChange={setCycleLength}
            />
            <Field
              label="First day of last period"
              type="date"
              value={lastPeriod}
              onChange={setLastPeriod}
            />
          </div>
        )}

        {step === 7 && sex !== "female" && (
          <ChoiceGroup
            label="Do you have any additional health information to add?"
            value={additionalHealthChoice}
            onChange={setAdditionalHealthChoice}
            options={[
              ["yes", "Yes, add details"],
              ["none", "No, continue"],
              ["skip", "Skip for now"],
            ]}
          />
        )}

        {step === 7 && sex !== "female" && additionalHealthChoice === "yes" && (
          <Field
            label="Additional health information"
            value={additionalHealthNotes}
            onChange={setAdditionalHealthNotes}
          />
        )}

        {/* STEP 8 — SUMMARY */}
        {step === 8 && (
          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Based on your body and activity level
            </p>

            {/* Metric rows */}
            <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
              <Summary label="Age" value={`${age} years`} />
              <Summary
                label="Height"
                value={
                  heightUnit === "cm"
                    ? `${height} cm`
                    : `${heightFt} ft ${heightIn} in (${height} cm)`
                }
              />
              <Summary label="Weight" value={`${weight} kg`} />
              <Summary label="Activity" value={activityLevel ?? "—"} />
              <Summary label="Daily steps" value={dailySteps} />
              <Summary label="Goal" value={weightGoal} />
              <Summary label="Muscle" value={muscleGoal} />

              {sex === "female" && cycleLength && (
                <Summary label="Cycle length" value={`${cycleLength} days`} />
              )}
              {sex === "female" && lastPeriod && (
                <Summary label="Last period" value={lastPeriod} />
              )}
              {sex !== "female" && additionalHealthChoice === "yes" && (
                <Summary
                  label="Additional health info"
                  value={additionalHealthNotes}
                />
              )}
            </div>

            {/* Calorie callout */}
            <div className="rounded-2xl bg-primary/[0.07] border border-primary/20 px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
                Estimated maintenance calories
              </p>
              <p className="text-3xl font-semibold text-foreground leading-none">
                {maintenanceCalories}
                <span className="text-base font-normal text-muted-foreground ml-1.5">
                  kcal / day
                </span>
              </p>
              <p className="text-sm text-muted-foreground mt-1.5">
                Goal target: ~{goalCalories} kcal / day
              </p>
            </div>
          </div>
        )}

        {/* ================= NAV ================= */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <button
            type="button"
            onClick={back}
            disabled={step === 1}
            className="
              px-3 py-2 rounded-lg
              text-sm text-muted-foreground
              hover:text-foreground hover:bg-muted/60
              disabled:opacity-30 disabled:cursor-not-allowed
              transition-premium
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
            "
          >
            Back
          </button>

          <button
            type="button"
            onClick={step < 8 ? next : finish}
            disabled={!isStepValid()}
            className="
              px-7 py-2.5 rounded-xl
              text-sm font-semibold
              bg-primary text-primary-foreground
              card-shadow-rest
              hover:brightness-105
              active:scale-[0.98] active:brightness-95
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-premium
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
            "
          >
            {step < 8 ? "Continue" : "Finish setup"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ======================================================
   UI HELPERS
   ====================================================== */

type FieldProps = {
  label: string;
  type?: React.HTMLInputTypeAttribute;
  value: string;
  onChange: (value: string) => void;
};

type SelectOption = { label: string; value: string };

type SelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
};

type ChoiceOption = [value: string, title: string, subtitle?: string];

type ChoiceGroupProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ChoiceOption[];
};

type SummaryProps = {
  label: string;
  value: React.ReactNode;
};

function ValidationError() {
  return (
    <p className="text-xs text-destructive">This field is required</p>
  );
}

function Field({ label, type, value, onChange }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          w-full rounded-xl
          bg-muted/50
          border border-border
          px-4 py-3
          text-sm text-foreground
          focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/60
          transition-premium
        "
      />
    </div>
  );
}

function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          w-full rounded-xl
          bg-muted/50
          border border-border
          px-4 py-3
          text-sm text-foreground
          focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/60
          transition-premium
        "
      >
        {options.map((o: SelectOption) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ChoiceGroup({ label, value, onChange, options }: ChoiceGroupProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="space-y-2">
        {options.map(([v, title, subtitle]: ChoiceOption) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={value === v}
            className={`
              w-full text-left rounded-xl border px-4 py-3.5 transition-premium
              ${value === v
                ? "bg-primary/10 border-primary/60 card-shadow-rest"
                : "bg-muted/40 border-border hover:bg-muted/70"
              }
            `}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-sm font-medium leading-tight ${value === v ? "text-primary" : "text-foreground"}`}>
                  {title}
                </p>
                {subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
                )}
              </div>
              {value === v && (
                <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Summary({ label, value }: SummaryProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-card">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground text-right capitalize max-w-[60%]">
        {value}
      </span>
    </div>
  );
}

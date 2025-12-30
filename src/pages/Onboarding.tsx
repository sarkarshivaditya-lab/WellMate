import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";

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

  const completeOnboarding = useMutation(api.users.completeOnboarding);

  /* ---------- AUTH GUARD ---------- */
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      loginWithRedirect({
        appState: { returnTo: window.location.pathname },
      });
    }
  }, [isAuthenticated, isLoading, loginWithRedirect]);

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
  const [step, setStep] = useState(1);

  /* ---------- identity ---------- */
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState("");

  /* ---------- body metrics ---------- */
  const [height, setHeight] = useState("");
  const [heightUnit, setHeightUnit] = useState<"cm" | "ftin">("cm");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [weight, setWeight] = useState("");

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
    null,
  );
  const [dailySteps, setDailySteps] = useState("");

  /* ---------- goals ---------- */
  const [weightGoal, setWeightGoal] = useState("");
  const [muscleGoal, setMuscleGoal] = useState("");

  /* ---------- female health ---------- */
  const [cycleLength, setCycleLength] = useState("");
  const [lastPeriod, setLastPeriod] = useState("");

  const [additionalHealthChoice, setAdditionalHealthChoice] = useState("");
  const [additionalHealthNotes, setAdditionalHealthNotes] = useState("");

  const [attemptedNext, setAttemptedNext] = useState(false);

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
    try {
      await completeOnboarding({
        dob,
        sex: sex as "male" | "female" | "other",
        heightCm: Number(height),
        weightKg: Number(weight),
        activityLevel: activityLevel ?? "sedentary",
        goal: weightGoal as "lose" | "maintain" | "gain",
        periodTrackingEnabled: sex === "female",
      });

      localStorage.setItem("onboarded", "true");
      navigate("/physical");
    } catch (error) {
      console.error("Failed to complete onboarding", error);
    }
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
    very: 1.725,
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
    <div
      className="
        min-h-screen flex items-center justify-center px-6
        bg-[radial-gradient(ellipse_at_top,hsl(var(--surface-vignette))_0%,hsl(var(--surface-bg))_70%)]
      "
    >
      <div
        className="
          max-w-md w-auto mx-auto
          rounded-3xl
          bg-[hsl(var(--surface-elev-1))]/85
          backdrop-blur-2xl
          border border-[hsl(var(--surface-separator))]/40
          card-glow
          p-10
          space-y-10
        "
      >
        {/* ================= HEADER ================= */}
        <div className="space-y-4">
          <span className="text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--text-meta))]">
            Step {step} of 8
          </span>

          <h1 className="text-[2.6rem] font-semibold leading-[1.15] text-[hsl(var(--text-primary))]">
            {step === 1 && "Welcome to WellMate"}
            {step === 2 && "Your body metrics"}
            {step === 3 && "Your daily activity"}
            {step === 4 && "Your movement habits"}
            {step === 5 && "Your weight goal"}
            {step === 6 && "Your muscle focus"}
            {step === 7 && "Additional health details"}
            {step === 8 && "Your health snapshot"}
          </h1>

          <p className="text-base leading-relaxed text-[hsl(var(--text-secondary))] max-w-sm">
            {step === 1 && "Let’s personalize your health experience."}
            {step === 2 && "These help us estimate your daily energy needs."}
            {step === 3 && "Your activity level shapes your calorie baseline."}
            {step === 4 && "Daily movement helps refine accuracy."}
            {step === 5 && "We’ll adjust recommendations based on your goal."}
            {step === 6 && "This helps prioritize strength vs balance."}
            {step === 7 && "Only if applicable to you."}
            {step === 8 && "Here’s what we’ve learned about you."}
          </p>
        </div>

        {/* ================= STEPS ================= */}

        {/* STEP 1 — IDENTITY */}
        {step === 1 && (
          <div className="space-y-6">
            <Field
              label="Date of Birth"
              type="date"
              value={dob}
              onChange={(v) => {
                setDob(v);
                setAttemptedNext(false);
              }}
            />
            {attemptedNext && !dob && (
              <p className="text-xs text-[hsl(var(--destructive))]">
                This field is required
              </p>
            )}
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
            {attemptedNext && !sex && (
              <p className="text-xs text-[hsl(var(--destructive))]">
                This field is required
              </p>
            )}
          </div>
        )}

        {/* STEP 2 — BODY */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm">Height units</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setHeightUnitAndSync("cm")}
                  aria-pressed={heightUnit === "cm"}
                  className={
                    "w-full text-left rounded-xl border px-4 py-3 transition-premium " +
                    (heightUnit === "cm"
                      ? "bg-[hsl(var(--action-primary))]/18 border-[hsl(var(--action-primary))] card-glow"
                      : "bg-[hsl(var(--control-fill))]/65 border-[hsl(var(--control-border))] hover:bg-[hsl(var(--control-fill))]/75")
                  }
                >
                  <div className="flex flex-col gap-1">
                    <p
                      className={
                        (heightUnit === "cm"
                          ? "text-[hsl(var(--action-primary))]"
                          : "text-[hsl(var(--text-primary))]") + " font-medium"
                      }
                    >
                      cm
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setHeightUnitAndSync("ftin")}
                  aria-pressed={heightUnit === "ftin"}
                  className={
                    "w-full text-left rounded-xl border px-4 py-3 transition-premium " +
                    (heightUnit === "ftin"
                      ? "bg-[hsl(var(--action-primary))]/18 border-[hsl(var(--action-primary))] card-glow"
                      : "bg-[hsl(var(--control-fill))]/65 border-[hsl(var(--control-border))] hover:bg-[hsl(var(--control-fill))]/75")
                  }
                >
                  <div className="flex flex-col gap-1">
                    <p
                      className={
                        (heightUnit === "ftin"
                          ? "text-[hsl(var(--action-primary))]"
                          : "text-[hsl(var(--text-primary))]") + " font-medium"
                      }
                    >
                      ft + in
                    </p>
                  </div>
                </button>
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
            {attemptedNext && Number(height) <= 0 && (
              <p className="text-xs text-[hsl(var(--destructive))]">
                This field is required
              </p>
            )}
            <Field
              label="Weight (kg)"
              type="number"
              value={weight}
              onChange={(v) => {
                setWeight(v);
                setAttemptedNext(false);
              }}
            />
            {attemptedNext && Number(weight) <= 0 && (
              <p className="text-xs text-[hsl(var(--destructive))]">
                This field is required
              </p>
            )}
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
            {attemptedNext && !activityLevel && (
              <p className="text-xs text-[hsl(var(--destructive))]">
                This field is required
              </p>
            )}
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
            {attemptedNext && !weightGoal && (
              <p className="text-xs text-[hsl(var(--destructive))]">
                This field is required
              </p>
            )}
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
          <div className="space-y-6">
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
          <div className="space-y-4 text-sm text-[hsl(var(--text-primary))]">
            <p className="text-sm text-[hsl(var(--text-meta))]">
              Based on your body and activity level
            </p>
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

            <div className="pt-4 border-t border-[hsl(var(--surface-separator))]/40">
              <p className="text-[hsl(var(--text-meta))]">
                Estimated daily maintenance calories
              </p>
              <p className="text-2xl font-semibold">
                {maintenanceCalories} kcal/day
              </p>
              <p className="text-sm text-[hsl(var(--text-secondary))]">
                Goal target: ~{goalCalories} kcal/day
              </p>
            </div>
          </div>
        )}

        {/* ================= NAV ================= */}
        <div className="pt-6 border-t border-[hsl(var(--surface-separator))]/40 flex justify-between items-center">
          {/* BACK */}
          <button
            onClick={back}
            disabled={step === 1}
            className="
              text-sm px-3 py-1
              text-[hsl(var(--text-meta))]
              disabled:text-[hsl(var(--text-disabled))]
              transition-premium
              hover:text-[hsl(var(--text-primary))]
              focus-visible:outline-none
              focus-visible:ring-2 focus-visible:ring-[hsl(var(--action-primary))]/40
              active:scale-[0.98]
            "
          >
            Back
          </button>

          {/* CONTINUE / FINISH */}
          <button
            onClick={step < 8 ? next : finish}
            disabled={isStepValid() === false}
            className="
              rounded-xl
              bg-[hsl(var(--action-primary))]
              px-6 py-3
              text-sm font-medium
              text-[hsl(var(--action-primary-fg))]
              card-glow
              hover:brightness-105
              active:bg-[hsl(var(--action-pressed))]
              active:scale-[0.98]
              focus-visible:outline-none
              focus-visible:ring-2 focus-visible:ring-[hsl(var(--action-primary))]/50
              transition-premium
            "
          >
            {step < 8 ? "Continue" : "Finish"}
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

function Field({ label, type, value, onChange }: FieldProps) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider mb-1 text-[hsl(var(--text-label))]">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          w-full rounded-xl
          bg-[hsl(var(--control-fill))]/65
          border border-[hsl(var(--control-border))]
          px-4 py-3
          text-[hsl(var(--text-primary))]
        "
      />
    </div>
  );
}

function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider mb-1 text-[hsl(var(--text-label))]">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          w-full rounded-xl
          bg-[hsl(var(--control-fill))]/65
          border border-[hsl(var(--control-border))]
          px-4 py-3
          text-[hsl(var(--text-primary))]
          focus:outline-none
          focus:ring-2 focus:ring-[hsl(var(--action-primary))]/50
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
      <p className="text-sm">{label}</p>
      {options.map(([v, title, subtitle]: ChoiceOption) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={
            "w-full text-left rounded-xl border px-4 py-3 transition-premium " +
            (value === v
              ? "bg-[hsl(var(--action-primary))]/18 border-[hsl(var(--action-primary))] card-glow"
              : "bg-[hsl(var(--control-fill))]/65 border-[hsl(var(--control-border))] hover:bg-[hsl(var(--control-fill))]/75")
          }
        >
          <div className="flex flex-col gap-1">
            <p
              className={
                (value === v
                  ? "text-[hsl(var(--action-primary))]"
                  : "text-[hsl(var(--text-primary))]") + " font-medium"
              }
            >
              {title}
            </p>
            {subtitle && (
              <p className="text-sm text-[hsl(var(--text-secondary))]">
                {subtitle}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

function Summary({ label, value }: SummaryProps) {
  return (
    <p>
      <span>{label}</span> — {value}
    </p>
  );
}

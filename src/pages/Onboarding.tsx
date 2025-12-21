import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

/* ======================================================
   ONBOARDING — FULL 8 STEP FLOW
   ====================================================== */

export default function Onboarding() {
  const navigate = useNavigate();

  /* ---------- core step ---------- */
  const [step, setStep] = useState(1);

  /* ---------- identity ---------- */
  const [dob, setDob] = useState("");
  const [sex, setSex] = useState("");

  /* ---------- body metrics ---------- */
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");

  /* ---------- activity ---------- */
  const [activityLevel, setActivityLevel] = useState("");
  const [dailySteps, setDailySteps] = useState("");

  /* ---------- goals ---------- */
  const [weightGoal, setWeightGoal] = useState("");
  const [muscleGoal, setMuscleGoal] = useState("");

  /* ---------- female health ---------- */
  const [cycleLength, setCycleLength] = useState("");
  const [lastPeriod, setLastPeriod] = useState("");

  /* ---------- navigation ---------- */
  const next = () => {
    if (step === 7 && sex !== "female") {
      setStep(8);
    } else {
      setStep((s) => Math.min(8, s + 1));
    }
  };

  const back = () => setStep((s) => Math.max(1, s - 1));

  const finish = () => {
    localStorage.setItem("onboarded", "true");
    navigate("/physical");
  };

  /* ======================================================
     CALCULATIONS (STEP 8 ONLY)
     ====================================================== */

  const age = dob
    ? Math.floor(
        (Date.now() - new Date(dob).getTime()) /
          (1000 * 60 * 60 * 24 * 365.25)
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

  const multiplier = activityMultiplierMap[activityLevel] || 1.2;
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
          shadow-[var(--elev-card)]
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
            Welcome to WellMate
          </h1>

          <p className="text-base leading-relaxed text-[hsl(var(--text-secondary))] max-w-sm">
            Let’s personalize your health experience.
          </p>
        </div>

        {/* ================= STEPS ================= */}

        {/* STEP 1 — IDENTITY */}
        {step === 1 && (
          <div className="space-y-6">
            <Field label="Date of Birth" type="date" value={dob} onChange={setDob} />
            <Select
              label="Biological Sex"
              value={sex}
              onChange={setSex}
              options={[
                { value: "", label: "Select" },
                { value: "female", label: "Female" },
                { value: "male", label: "Male" },
                { value: "other", label: "Other" },
              ]}
            />
          </div>
        )}

        {/* STEP 2 — BODY */}
        {step === 2 && (
          <div className="space-y-6">
            <Field label="Height (cm)" type="number" value={height} onChange={setHeight} />
            <Field label="Weight (kg)" type="number" value={weight} onChange={setWeight} />
          </div>
        )}

        {/* STEP 3 — ACTIVITY */}
        {step === 3 && (
          <ChoiceGroup
            label="How active are you on a typical day?"
            value={activityLevel}
            onChange={setActivityLevel}
            options={[
              ["sedentary", "Sedentary", "Mostly sitting"],
              ["light", "Lightly active", "Some walking"],
              ["moderate", "Moderately active", "Exercise 3–5× / week"],
              ["very", "Very active", "Hard training or physical job"],
            ]}
          />
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
          <ChoiceGroup
            label="Primary weight goal"
            value={weightGoal}
            onChange={setWeightGoal}
            options={[
              ["lose", "Lose fat"],
              ["maintain", "Maintain weight"],
              ["gain", "Gain weight"],
            ]}
          />
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

        {/* STEP 8 — SUMMARY */}
        {step === 8 && (
          <div className="space-y-4 text-sm text-[hsl(var(--text-primary))]">
            <Summary label="Age" value={`${age} years`} />
            <Summary label="Height" value={`${height} cm`} />
            <Summary label="Weight" value={`${weight} kg`} />
            <Summary label="Activity" value={activityLevel} />
            <Summary label="Goal" value={weightGoal} />
            <Summary label="Muscle" value={muscleGoal} />

            <div className="pt-4 border-t border-[hsl(var(--surface-separator))]/40">
              <p className="text-[hsl(var(--text-meta))]">Estimated maintenance calories</p>
              <p className="text-2xl font-semibold">{maintenanceCalories} kcal/day</p>
              <p className="text-sm text-[hsl(var(--text-secondary))]">
                Goal target: ~{goalCalories} kcal/day
              </p>
            </div>
          </div>
        )}

        {/* ================= NAV ================= */}
        <div className="pt-6 border-t border-[hsl(var(--surface-separator))]/40 flex justify-between items-center">
          <button
            onClick={back}
            disabled={step === 1}
            className="text-sm px-3 py-1 text-[hsl(var(--text-meta))] disabled:text-[hsl(var(--text-disabled))]"
          >
            Back
          </button>

          <button
            onClick={step < 8 ? next : finish}
            className="
              rounded-xl
              bg-[hsl(var(--action-primary))]
              px-6 py-3
              text-sm font-medium
              text-[hsl(var(--action-primary-fg))]
              shadow-[0_10px_25px_rgba(0,0,0,0.45)]
              hover:brightness-105
              active:bg-[hsl(var(--action-pressed))]
              transition
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
   UI HELPERS (STYLE CONSISTENT)
   ====================================================== */

function Field({ label, type, value, onChange }: any) {
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
          shadow-[var(--control-inner-shadow),var(--control-top-light)]
          focus:outline-none focus:ring-2 focus:ring-[hsl(var(--control-focus-glow))]/20
        "
      />
    </div>
  );
}

function Select({ label, value, onChange, options }: any) {
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
          shadow-[var(--control-inner-shadow),var(--control-top-light)]
          focus:outline-none focus:ring-2 focus:ring-[hsl(var(--control-focus-glow))]/20
        "
      >
        {options.map((o: any) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ChoiceGroup({ label, value, onChange, options }: any) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-[hsl(var(--text-secondary))]">{label}</p>
      {options.map(([v, title, subtitle]: any) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`
            w-full text-left rounded-xl px-4 py-3 border transition
            ${
              value === v
                ? "bg-[hsl(var(--surface-elev-2))] border-[hsl(var(--action-primary))]"
                : "border-[hsl(var(--surface-separator))]/40"
            }
          `}
        >
          <p className="text-sm font-medium">{title}</p>
          {subtitle && (
            <p className="text-xs text-[hsl(var(--text-meta))]">{subtitle}</p>
          )}
        </button>
      ))}
    </div>
  );
}

function Summary({ label, value }: any) {
  return (
    <p>
      <span className="text-[hsl(var(--text-meta))]">{label}</span> — {value}
    </p>
  );
}

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { readOnboardingDraft, saveOnboardingDraft, clearOnboardingDraft } from "@/data/local/onboardingPayload";

type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "veryActive";

export default function Onboarding() {
  const navigate = useNavigate();
  useEffect(() => {
    if (localStorage.getItem("onboarded") === "true") {
      navigate("/physical", { replace: true });
    }
  }, [navigate]);

  const draft = readOnboardingDraft();
  const [step, setStep] = useState(() => draft?.step ?? 1);
  const [dob, setDob] = useState(() => draft?.dob ?? "");
  const [sex, setSex] = useState(() => draft?.sex ?? "");
  const [height, setHeight] = useState(() => draft?.height ?? "");
  const [heightUnit, setHeightUnit] = useState<"cm" | "ftin">(() => draft?.heightUnit ?? "cm");
  const [heightFt, setHeightFt] = useState(() => draft?.heightFt ?? "");
  const [heightIn, setHeightIn] = useState(() => draft?.heightIn ?? "");
  const [weight, setWeight] = useState(() => draft?.weight ?? "");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(() => (draft?.activityLevel as ActivityLevel | null) ?? null);
  const [dailySteps, setDailySteps] = useState(() => draft?.dailySteps ?? "");
  const [weightGoal, setWeightGoal] = useState(() => draft?.weightGoal ?? "");
  const [muscleGoal, setMuscleGoal] = useState(() => draft?.muscleGoal ?? "");
  const [cycleLength, setCycleLength] = useState(() => draft?.cycleLength ?? "");
  const [lastPeriod, setLastPeriod] = useState(() => draft?.lastPeriod ?? "");
  const [additionalHealthChoice, setAdditionalHealthChoice] = useState(() => draft?.additionalHealthChoice ?? "");
  const [additionalHealthNotes, setAdditionalHealthNotes] = useState(() => draft?.additionalHealthNotes ?? "");
  const [bloodType, setBloodType] = useState(() => draft?.bloodType ?? "");
  const [allergies, setAllergies] = useState(() => draft?.allergies ?? "");
  const [emergencyContactName, setEmergencyContactName] = useState(() => draft?.emergencyContactName ?? "");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(() => draft?.emergencyContactPhone ?? "");
  const [localAmbulanceNumber, setLocalAmbulanceNumber] = useState(() => draft?.localAmbulanceNumber ?? "");
  const [trackingMode, setTrackingMode] = useState<"automatic" | "manual">(() => draft?.trackingMode === "manual" ? "manual" : "automatic");
  const [attemptedNext, setAttemptedNext] = useState(false);
  const [saving, setSaving] = useState(false);

  const setHeightUnitAndSync = (nextUnit: "cm" | "ftin") => {
    if (nextUnit === heightUnit) return;
    if (nextUnit === "ftin") {
      const cm = Number(height);
      if (Number.isFinite(cm) && cm > 0) {
        const totalIn = Math.round(cm / 2.54);
        setHeightFt(String(Math.floor(totalIn / 12)));
        setHeightIn(String(totalIn % 12));
      } else {
        setHeightFt("");
        setHeightIn("");
      }
      setHeightUnit("ftin");
      return;
    }
    const ft = Number(heightFt);
    const rawIn = Number(heightIn);
    const clampedIn = Number.isFinite(rawIn) ? Math.min(11, Math.max(0, rawIn)) : 0;
    const cm = (Number.isFinite(ft) ? ft : 0) * 30.48 + clampedIn * 2.54;
    setHeight(Number.isFinite(cm) && cm > 0 ? String(cm) : "");
    setHeightUnit("cm");
  };

  useEffect(() => {
    if (heightUnit !== "ftin") return;
    const ft = Number(heightFt);
    const rawIn = Number(heightIn);
    const clampedIn = Number.isFinite(rawIn) ? Math.min(11, Math.max(0, rawIn)) : 0;
    if (heightIn !== "" && rawIn !== clampedIn) setHeightIn(String(clampedIn));
    const cm = (Number.isFinite(ft) ? ft : 0) * 30.48 + clampedIn * 2.54;
    setHeight(cm > 0 ? String(cm) : "");
  }, [heightUnit, heightFt, heightIn]);

  useEffect(() => {
    saveOnboardingDraft({
      step, dob, sex, height, heightUnit, heightFt, heightIn, weight,
      activityLevel, dailySteps, weightGoal, muscleGoal, cycleLength,
      lastPeriod, additionalHealthChoice, additionalHealthNotes,
      bloodType, allergies, emergencyContactName, emergencyContactPhone,
      localAmbulanceNumber, trackingMode,
    });
  }, [step, dob, sex, height, heightUnit, heightFt, heightIn, weight, activityLevel, dailySteps, weightGoal, muscleGoal, cycleLength, lastPeriod, additionalHealthChoice, additionalHealthNotes, bloodType, allergies, emergencyContactName, emergencyContactPhone, localAmbulanceNumber, trackingMode]);

  function buildOnboardingProfile() {
    return {
      dob,
      sex,
      heightCm: Number(height) || 0,
      weightKg: Number(weight) || 0,
      activityLevel,
      dailySteps,
      weightGoal,
      muscleGoal,
      cycleLength: sex === "female" ? Number(cycleLength) || undefined : undefined,
      lastPeriod: sex === "female" ? lastPeriod || undefined : undefined,
      additionalHealthNotes: sex !== "female" && additionalHealthChoice === "yes" ? additionalHealthNotes || undefined : undefined,
      bloodType,
      allergies,
      emergencyContactName,
      emergencyContactPhone,
      localAmbulanceNumber,
      trackingMode,
      createdAt: Date.now(),
    };
  }

  function isStepValid() {
    if (step === 1) return Boolean(dob && (sex === "male" || sex === "female" || sex === "other"));
    if (step === 2) {
      if (!(Number(weight) > 0)) return false;
      if (heightUnit === "cm") return Number(height) > 0;
      const ft = Number(heightFt);
      const rawIn = Number(heightIn);
      const clampedIn = Number.isFinite(rawIn) ? Math.min(11, Math.max(0, rawIn)) : 0;
      const cm = (Number.isFinite(ft) ? ft : 0) * 30.48 + clampedIn * 2.54;
      return Number.isFinite(ft) && ft > 0 && cm > 0;
    }
    if (step === 3) return Boolean(activityLevel);
    if (step === 5) return weightGoal === "lose" || weightGoal === "maintain" || weightGoal === "gain";
    if (step === 8) {
      return Boolean(bloodType.trim() && emergencyContactName.trim() && emergencyContactPhone.trim() && localAmbulanceNumber.trim() && trackingMode);
    }
    return true;
  }

  const next = () => {
    setAttemptedNext(true);
    if (!isStepValid()) return;
    setAttemptedNext(false);
    if (step === 7 && sex !== "female") setStep(8);
    else setStep((current) => Math.min(8, current + 1));
  };

  const back = () => {
    if (saving) return;
    setStep((current) => Math.max(1, current - 1));
  };

  const finish = () => {
    setAttemptedNext(true);
    if (!isStepValid() || saving) return;
    setAttemptedNext(false);
    setSaving(true);

    const now = Date.now();
    const profile = {
      ...buildOnboardingProfile(),
      completedAt: now,
    };

    try {
      localStorage.setItem("onboarding_profile", JSON.stringify(profile));
      localStorage.setItem("onboarded", "true");
      localStorage.removeItem("postOnboardingTransitionShown");
      clearOnboardingDraft();
      navigate("/transition", { replace: true });
    } catch (error) {
      console.error("[WellMate] Failed to save onboarding profile locally:", error);
      setSaving(false);
      setAttemptedNext(true);
    }
  };

  const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : 0;
  const w = Number(weight);
  const h = Number(height);
  let BMR = 0;
  if (sex === "male") BMR = 10 * w + 6.25 * h - 5 * age + 5;
  else if (sex === "female") BMR = 10 * w + 6.25 * h - 5 * age - 161;

  const activityMultiplierMap: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    veryActive: 1.9,
  };
  const multiplier = (activityLevel ? activityMultiplierMap[activityLevel] : undefined) || 1.2;
  const maintenanceCalories = Math.round(BMR * multiplier);
  let goalCalories = maintenanceCalories;
  if (weightGoal === "lose") goalCalories -= 300;
  if (weightGoal === "gain") goalCalories += 300;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 wm-ambient-bg">
      <div className="glass-primary rounded-3xl p-8 sm:p-10 max-w-md w-full space-y-8">
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">WellMate</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">{step} / 8</span>
            </div>
            <div className="h-[3px] rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{ width: `${(step / 8) * 100}%` }} />
            </div>
          </div>
          <div className="space-y-1.5">
            <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.01em] text-foreground">
              {step === 1 && "Welcome to WellMate"}
              {step === 2 && "Your body metrics"}
              {step === 3 && "Your daily activity"}
              {step === 4 && "Your movement habits"}
              {step === 5 && "Your weight goal"}
              {step === 6 && "Your muscle focus"}
              {step === 7 && "Additional health details"}
              {step === 8 && "Golden Hour readiness"}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {step === 1 && "A few questions — everything you share stays on your device."}
              {step === 2 && "Used to calculate your daily energy estimate."}
              {step === 3 && "Your activity level shapes your calorie baseline."}
              {step === 4 && "Helps refine your calorie estimate alongside your activity level."}
              {step === 5 && "Shifts your calorie target to match your direction."}
              {step === 6 && "This helps prioritize strength vs balance."}
              {step === 7 && "Only if applicable to you."}
              {step === 8 && "Set up the emergency profile WellMate can use when seconds matter."}
            </p>
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <Field label="Date of Birth" type="date" value={dob} onChange={(value) => { setDob(value); setAttemptedNext(false); }} />
            {attemptedNext && !dob && <ValidationError />}
            <Select label="Biological Sex" value={sex} onChange={(value) => { setSex(value); setAttemptedNext(false); }}
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

        {step === 2 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Height unit</p>
              <div className="inline-flex glass-subtle rounded-xl p-1 gap-1">
                {(["cm", "ftin"] as const).map((unit) => (
                  <button key={unit} type="button" onClick={() => setHeightUnitAndSync(unit)} aria-pressed={heightUnit === unit}
                    className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-premium ${heightUnit === unit ? "bg-card text-foreground card-shadow-rest" : "text-muted-foreground hover:text-foreground"}`}>
                    {unit === "cm" ? "cm" : "ft + in"}
                  </button>
                ))}
              </div>
            </div>
            {heightUnit === "cm" && <Field label="Height (cm)" type="number" value={height} onChange={(value) => { setHeight(value); setAttemptedNext(false); }} />}
            {heightUnit === "ftin" && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Height (ft)" type="number" value={heightFt} onChange={(value) => { setHeightFt(value); setAttemptedNext(false); }} />
                <Field label="Height (in)" type="number" value={heightIn} onChange={(value) => { setHeightIn(value); setAttemptedNext(false); }} />
              </div>
            )}
            {attemptedNext && Number(height) <= 0 && <ValidationError />}
            <Field label="Weight (kg)" type="number" value={weight} onChange={(value) => { setWeight(value); setAttemptedNext(false); }} />
            {attemptedNext && Number(weight) <= 0 && <ValidationError />}
          </div>
        )}

        {step === 3 && (
          <>
            <ChoiceGroup label="How active are you on a typical day?" value={(activityLevel ?? "") as string}
              onChange={(value) => { setActivityLevel(value as ActivityLevel); setAttemptedNext(false); }}
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

        {step === 4 && (
          <ChoiceGroup label="Average daily steps" value={dailySteps} onChange={setDailySteps}
            options={[
              ["<5k", "< 5,000"],
              ["5–7k", "5,000 – 7,500"],
              ["7–10k", "7,500 – 10,000"],
              ["10k+", "10,000+"],
            ]}
          />
        )}

        {step === 5 && (
          <>
            <ChoiceGroup label="Primary weight goal" value={weightGoal} onChange={(value) => { setWeightGoal(value); setAttemptedNext(false); }}
              options={[
                ["lose", "Lose fat"],
                ["maintain", "Maintain weight"],
                ["gain", "Gain weight"],
              ]}
            />
            {attemptedNext && !weightGoal && <ValidationError />}
          </>
        )}

        {step === 6 && (
          <ChoiceGroup label="Muscle goal" value={muscleGoal} onChange={setMuscleGoal}
            options={[
              ["gain", "Gain muscle"],
              ["maintain", "Maintain muscle"],
              ["none", "Not a priority"],
            ]}
          />
        )}

        {step === 7 && sex === "female" && (
          <div className="space-y-5">
            <Field label="Cycle length (days)" type="number" value={cycleLength} onChange={setCycleLength} />
            <Field label="First day of last period" type="date" value={lastPeriod} onChange={setLastPeriod} />
          </div>
        )}

        {step === 7 && sex !== "female" && (
          <>
            <ChoiceGroup label="Anything else you'd like to include?" value={additionalHealthChoice} onChange={setAdditionalHealthChoice}
              options={[
                ["yes", "Yes, I'll add something"],
                ["none", "No, that's all"],
                ["skip", "Skip for now"],
              ]}
            />
            {additionalHealthChoice === "yes" && <Field label="Additional health information" value={additionalHealthNotes} onChange={setAdditionalHealthNotes} />}
          </>
        )}

        {step === 8 && (
          <div className="space-y-5">
            <div className="rounded-2xl glass-brand p-4 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Golden Hour</p>
              <p className="text-sm text-foreground">Every second between impact and action matters.</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This profile is securely synchronized to your WellMate account when you're signed in.
              </p>
            </div>

            <Select label="Blood type" value={bloodType} onChange={setBloodType}
              options={[
                { value: "", label: "Select" },
                { value: "A+", label: "A+" },
                { value: "A-", label: "A-" },
                { value: "B+", label: "B+" },
                { value: "B-", label: "B-" },
                { value: "AB+", label: "AB+" },
                { value: "AB-", label: "AB-" },
                { value: "O+", label: "O+" },
                { value: "O-", label: "O-" },
                { value: "unknown", label: "Unknown" },
              ]}
            />
            <Field label="Allergies" type="text" value={allergies} onChange={setAllergies} />
            <Field label="Emergency contact name" value={emergencyContactName} onChange={setEmergencyContactName} />
            <Field label="Emergency contact phone" type="tel" value={emergencyContactPhone} onChange={setEmergencyContactPhone} />
            <Field label="Local ambulance service number" type="tel" value={localAmbulanceNumber} onChange={setLocalAmbulanceNumber} />
            <p className="text-[11px] text-muted-foreground -mt-2">
              Ambulance numbers can vary by state. Enter the local service number you want WellMate to use.
            </p>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Tracking mode</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" aria-pressed={trackingMode === "automatic"} onClick={() => setTrackingMode("automatic")}
                  className={cn("rounded-xl p-3 text-left border min-h-[76px] transition-premium", trackingMode === "automatic" ? "glass-brand border-primary/30" : "glass-subtle border-border/50")}>
                  <p className="text-sm font-semibold">Automatic</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Detect suspicious motion and abrupt stops conservatively.</p>
                </button>
                <button type="button" aria-pressed={trackingMode === "manual"} onClick={() => setTrackingMode("manual")}
                  className={cn("rounded-xl p-3 text-left border min-h-[76px] transition-premium", trackingMode === "manual" ? "glass-brand border-primary/30" : "glass-subtle border-border/50")}>
                  <p className="text-sm font-semibold">Manual</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Start tracking explicitly when you need it.</p>
                </button>
              </div>
            </div>

            {attemptedNext && (!bloodType || !emergencyContactName.trim() || !emergencyContactPhone.trim() || !localAmbulanceNumber.trim()) && (
              <p className="text-xs text-destructive">Complete the required emergency profile fields before finishing setup.</p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <button type="button" onClick={back} disabled={step === 1 || saving}
            className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            Back
          </button>
          <button type="button" onClick={step < 8 ? next : finish} disabled={!isStepValid() || saving}
            className="px-7 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground card-shadow-rest hover:brightness-105 active:scale-[0.98] active:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
            {saving ? "Saving..." : step < 8 ? "Continue" : "Finish setup"}
          </button>
        </div>
      </div>
    </div>
  );
}

type FieldProps = {
  label: string;
  type?: React.HTMLInputTypeAttribute;
  value: string;
  onChange: (value: string) => void;
};

function ValidationError() {
  return <p className="text-xs text-destructive">This field is required</p>;
}

function Field({ label, type, value, onChange }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl bg-muted/50 border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/60 transition-premium"
      />
    </div>
  );
}

type SelectOption = { label: string; value: string };
type SelectProps = { label: string; value: string; onChange: (value: string) => void; options: SelectOption[] };

function Select({ label, value, onChange, options }: SelectProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl bg-muted/50 border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/60 transition-premium">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

type ChoiceOption = [value: string, title: string, subtitle?: string];
type ChoiceGroupProps = { label: string; value: string; onChange: (value: string) => void; options: ChoiceOption[] };

function ChoiceGroup({ label, value, onChange, options }: ChoiceGroupProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="space-y-2">
        {options.map(([optionValue, title, subtitle]) => (
          <button key={optionValue} type="button" onClick={() => onChange(optionValue)} aria-pressed={value === optionValue}
            className={`w-full text-left rounded-xl border px-4 py-3.5 transition-premium ${
              value === optionValue ? "bg-primary/10 border-primary/60 card-shadow-rest" : "bg-muted/40 border-border hover:bg-muted/70"
            }`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-sm font-medium leading-tight ${
                  value === optionValue ? "text-primary" : "text-foreground"
                }`}>{title}</p>
                {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
              </div>
              {value === optionValue && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

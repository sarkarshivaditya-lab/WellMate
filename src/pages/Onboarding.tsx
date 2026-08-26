import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  readOnboardingDraft,
  saveOnboardingDraft,
  clearOnboardingDraft,
  type EmergencyContactPayload,
} from "@/data/local/onboardingPayload";

type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "veryActive";

const makeId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const EMPTY_CONTACT = (): EmergencyContactPayload => ({ id: makeId(), name: "", phone: "" });

export default function Onboarding() {
  const navigate = useNavigate();
  const draft = readOnboardingDraft();
  const [step, setStep] = useState(() => draft?.step ?? 1);
  const [dob, setDob] = useState(() => draft?.dob ?? "");
  const [sex, setSex] = useState(() => draft?.sex ?? "");
  const [height, setHeight] = useState(() => draft?.height ?? "");
  const [heightUnit, setHeightUnit] = useState<"cm" | "ftin">(() => draft?.heightUnit ?? "cm");
  const [heightFt, setHeightFt] = useState(() => draft?.heightFt ?? "");
  const [heightIn, setHeightIn] = useState(() => draft?.heightIn ?? "");
  const [weight, setWeight] = useState(() => draft?.weight ?? "");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(
    () => (draft?.activityLevel as ActivityLevel | null) ?? null,
  );
  const [dailySteps, setDailySteps] = useState(() => draft?.dailySteps ?? "");
  const [weightGoal, setWeightGoal] = useState(() => draft?.weightGoal ?? "");
  const [muscleGoal, setMuscleGoal] = useState(() => draft?.muscleGoal ?? "");
  const [cycleLength, setCycleLength] = useState(() => draft?.cycleLength ?? "");
  const [lastPeriod, setLastPeriod] = useState(() => draft?.lastPeriod ?? "");
  const [additionalHealthChoice, setAdditionalHealthChoice] = useState(() => draft?.additionalHealthChoice ?? "");
  const [additionalHealthNotes, setAdditionalHealthNotes] = useState(() => draft?.additionalHealthNotes ?? "");
  const [bloodType, setBloodType] = useState(() => draft?.bloodType ?? "");
  const [allergies, setAllergies] = useState(() => draft?.allergies ?? "");
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContactPayload[]>(
    () => (draft?.emergencyContacts?.length ? draft.emergencyContacts : [EMPTY_CONTACT()]),
  );
  const [attemptedNext, setAttemptedNext] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("onboarded") === "true") {
      navigate("/physical", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    saveOnboardingDraft({ step, dob, sex, height, heightUnit, heightFt, heightIn, weight, activityLevel, dailySteps, weightGoal, muscleGoal, cycleLength, lastPeriod, additionalHealthChoice, additionalHealthNotes, bloodType, allergies, emergencyContacts });
  }, [step, dob, sex, height, heightUnit, heightFt, heightIn, weight, activityLevel, dailySteps, weightGoal, muscleGoal, cycleLength, lastPeriod, additionalHealthChoice, additionalHealthNotes, bloodType, allergies, emergencyContacts]);

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
    setHeight(cm > 0 ? String(cm) : "");
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

  function buildOnboardingProfile() {
    const parsedHeight = Number(height);
    const parsedWeight = Number(weight);
    const normalizedHeight = Number.isFinite(parsedHeight) && parsedHeight > 0 ? parsedHeight : 0;
    const normalizedWeight = Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 0;
    return { dob, sex: sex as "male" | "female" | "other" | "", heightCm: normalizedHeight, weightKg: normalizedWeight, activityLevel, dailySteps, weightGoal, muscleGoal, cycleLength: sex === "female" ? Number(cycleLength) || undefined : undefined, lastPeriod: sex === "female" ? lastPeriod || undefined : undefined, additionalHealthNotes: sex !== "female" && additionalHealthChoice === "yes" ? additionalHealthNotes || undefined : undefined, bloodType: bloodType || undefined, allergies: allergies.split(",").map((value) => value.trim()).filter(Boolean), emergencyContacts: emergencyContacts.filter((contact) => contact.name.trim() && contact.phone.trim()).map((contact) => ({ id: contact.id, name: contact.name.trim(), phone: contact.phone.trim() })), createdAt: Date.now() };
  }

  const isEmergencyStepValid = bloodType.trim().length > 0 && emergencyContacts.length > 0 && emergencyContacts.every((contact) => contact.name.trim().length > 0 && contact.phone.trim().length >= 7);

  function isStepValid() {
    if (step === 1) return Boolean(dob && sex);
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
    if (step === 5) return Boolean(weightGoal);
    if (step === 8) return isEmergencyStepValid;
    return true;
  }

  const next = () => { setAttemptedNext(true); if (!isStepValid()) return; setAttemptedNext(false); setStep((current) => Math.min(8, current + 1)); };
  const back = () => setStep((current) => Math.max(1, current - 1));
  const finish = () => { setAttemptedNext(true); if (!isStepValid()) return; localStorage.setItem("onboarding_profile", JSON.stringify(buildOnboardingProfile())); localStorage.setItem("onboarded", "true"); localStorage.removeItem("postOnboardingTransitionShown"); clearOnboardingDraft(); navigate("/physical"); };

  const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : 0;
  const w = Number(weight);
  const h = Number(height);
  let BMR = 0;
  if (sex === "male") BMR = 10 * w + 6.25 * h - 5 * age + 5;
  if (sex === "female") BMR = 10 * w + 6.25 * h - 5 * age - 161;
  const activityMultiplierMap: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, veryActive: 1.9 };
  const multiplier = (activityLevel ? activityMultiplierMap[activityLevel] : undefined) || 1.2;
  const maintenanceCalories = Math.round(BMR * multiplier);
  let goalCalories = maintenanceCalories;
  if (weightGoal === "lose") goalCalories -= 300;
  if (weightGoal === "gain") goalCalories += 300;

  const updateContact = (id: string, patch: Partial<EmergencyContactPayload>) => setEmergencyContacts((contacts) => contacts.map((contact) => (contact.id === id ? { ...contact, ...patch } : contact)));
  const addContact = () => setEmergencyContacts((contacts) => [...contacts, EMPTY_CONTACT()]);
  const removeContact = (id: string) => setEmergencyContacts((contacts) => contacts.filter((contact) => contact.id !== id));

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-b from-[hsl(var(--header-gradient-start))] to-background">
      <div className="bg-card rounded-3xl border border-border card-shadow-hover p-8 sm:p-10 max-w-md w-full space-y-8">
        <div className="space-y-6"><div className="space-y-3"><div className="flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">WellMate</span><span className="text-[10px] tabular-nums text-muted-foreground">{step} / 8</span></div><div className="h-[3px] rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{ width: `${(step / 8) * 100}%` }} /></div></div><div className="space-y-1.5"><h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.01em] text-foreground">{step === 1 && "Welcome to WellMate"}{step === 2 && "Your body metrics"}{step === 3 && "Your daily activity"}{step === 4 && "Your movement habits"}{step === 5 && "Your weight goal"}{step === 6 && "Your muscle focus"}{step === 7 && "Additional health details"}{step === 8 && "Your emergency profile"}</h1><p className="text-sm leading-relaxed text-muted-foreground">{step === 1 && "A few questions — everything you share stays on your device."}{step === 2 && "Used to calculate your daily energy estimate."}{step === 3 && "Your activity level shapes your calorie baseline."}{step === 4 && "Helps refine your calorie estimate alongside your activity level."}{step === 5 && "Shifts your calorie target to match your direction."}{step === 6 && "This helps prioritize strength vs balance."}{step === 7 && "Only if applicable to you."}{step === 8 && "These details help WellMate act quickly during the Golden Hour."}</p></div></div>

        {step === 1 && <div className="space-y-5"><Field label="Date of Birth" type="date" value={dob} onChange={setDob} />{attemptedNext && !dob && <ValidationError />}<Select label="Biological Sex" value={sex} onChange={setSex} options={[{ value: "", label: "Select" }, { value: "female", label: "Female" }, { value: "male", label: "Male" }, { value: "other", label: "Other" }]} />{attemptedNext && !sex && <ValidationError />}</div>}

        {step === 2 && <div className="space-y-5"><div className="space-y-2"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Height unit</p><div className="inline-flex bg-muted rounded-xl p-1 gap-1">{(["cm", "ftin"] as const).map((unit) => <button key={unit} type="button" onClick={() => setHeightUnitAndSync(unit)} aria-pressed={heightUnit === unit} className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-premium ${heightUnit === unit ? "bg-card text-foreground card-shadow-rest" : "text-muted-foreground hover:text-foreground"}`}>{unit === "cm" ? "cm" : "ft + in"}</button>)}</div></div>{heightUnit === "cm" && <Field label="Height (cm)" type="number" value={height} onChange={setHeight} />}{heightUnit === "ftin" && <div className="grid grid-cols-2 gap-4"><Field label="Height (ft)" type="number" value={heightFt} onChange={setHeightFt} /><Field label="Height (in)" type="number" value={heightIn} onChange={setHeightIn} /></div>}{attemptedNext && Number(height) <= 0 && <ValidationError />}<Field label="Weight (kg)" type="number" value={weight} onChange={setWeight} />{attemptedNext && Number(weight) <= 0 && <ValidationError />}</div>}

        {step === 3 && <><ChoiceGroup label="How active are you on a typical day?" value={activityLevel ?? ""} onChange={(value) => setActivityLevel(value as ActivityLevel)} options={[["sedentary", "Sedentary", "Mostly sitting"], ["light", "Lightly active", "Some walking"], ["moderate", "Moderately active", "Exercise 3–5× / week"], ["active", "Active", "Daily exercise"], ["veryActive", "Very active", "Hard training or physical job"]]} />{attemptedNext && !activityLevel && <ValidationError />}</>}

        {step === 4 && <ChoiceGroup label="Average daily steps" value={dailySteps} onChange={setDailySteps} options={[["<5k", "< 5,000"], ["5–7k", "5,000 – 7,500"], ["7–10k", "7,500 – 10,000"], ["10k+", "10,000+"]]} />}
        {step === 5 && <><ChoiceGroup label="Primary weight goal" value={weightGoal} onChange={setWeightGoal} options={[["lose", "Lose fat"], ["maintain", "Maintain weight"], ["gain", "Gain weight"]]} />{attemptedNext && !weightGoal && <ValidationError />}</>}
        {step === 6 && <ChoiceGroup label="Muscle goal" value={muscleGoal} onChange={setMuscleGoal} options={[["gain", "Gain muscle"], ["maintain", "Maintain muscle"], ["none", "Not a priority"]]} />}
        {step === 7 && sex === "female" && <div className="space-y-5"><Field label="Cycle length (days)" type="number" value={cycleLength} onChange={setCycleLength} /><Field label="First day of last period" type="date" value={lastPeriod} onChange={setLastPeriod} /></div>}
        {step === 7 && sex !== "female" && <ChoiceGroup label="Anything else you'd like to include?" value={additionalHealthChoice} onChange={setAdditionalHealthChoice} options={[["yes", "Yes, I'll add something"], ["none", "No, that's all"], ["skip", "Skip for now"]]} />}
        {step === 7 && sex !== "female" && additionalHealthChoice === "yes" && <Field label="Additional health information" value={additionalHealthNotes} onChange={setAdditionalHealthNotes} />}

        {step === 8 && <div className="space-y-6"><div className="rounded-2xl border border-primary/20 bg-primary/[0.06] px-5 py-4"><p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Golden Hour readiness</p><p className="text-sm text-foreground mt-1">WellMate uses this information only when an emergency workflow needs it.</p></div><Select label="Blood type" value={bloodType} onChange={setBloodType} options={[{ value: "", label: "Select" }, { value: "A+", label: "A+" }, { value: "A-", label: "A−" }, { value: "B+", label: "B+" }, { value: "B-", label: "B−" }, { value: "AB+", label: "AB+" }, { value: "AB-", label: "AB−" }, { value: "O+", label: "O+" }, { value: "O-", label: "O−" }, { value: "unknown", label: "Unknown" }]} /><Field label="Allergies (comma separated)" value={allergies} onChange={setAllergies} /><div className="space-y-3"><div className="flex items-center justify-between"><div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Emergency contacts</p><p className="text-xs text-muted-foreground mt-1">At least one is required for escalation.</p></div><button type="button" onClick={addContact} className="text-xs font-semibold text-primary">Add contact</button></div><div className="space-y-3">{emergencyContacts.map((contact) => <div key={contact.id} className="rounded-2xl border border-border p-4 space-y-3"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Emergency contact</span>{emergencyContacts.length > 1 && <button type="button" onClick={() => removeContact(contact.id)} className="text-xs text-destructive">Remove</button>}</div><Field label="Name" value={contact.name} onChange={(value) => updateContact(contact.id, { name: value })} /><Field label="Phone" type="tel" value={contact.phone} onChange={(value) => updateContact(contact.id, { phone: value })} /></div>)}</div></div>{attemptedNext && !isEmergencyStepValid && <ValidationError message="Enter your blood type and at least one valid emergency contact." />}<div className="rounded-2xl border border-border overflow-hidden divide-y divide-border"><Summary label="Blood type" value={bloodType || "—"} /><Summary label="Allergies" value={allergies || "None recorded"} /><Summary label="Contacts" value={`${emergencyContacts.filter((contact) => contact.name && contact.phone).length} ready`} /><Summary label="Age" value={`${age} years`} /><Summary label="Height" value={heightUnit === "cm" ? `${height} cm` : `${heightFt} ft ${heightIn} in (${height} cm)`} /><Summary label="Weight" value={`${weight} kg`} /></div><div className="rounded-2xl bg-primary/[0.07] border border-primary/20 px-5 py-4"><p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">Estimated maintenance calories</p><p className="text-3xl font-semibold text-foreground leading-none">{maintenanceCalories}<span className="text-base font-normal text-muted-foreground ml-1.5">kcal / day</span></p><p className="text-sm text-muted-foreground mt-1.5">Goal target: ~{goalCalories} kcal / day</p></div></div>}

        <div className="flex items-center justify-between pt-2 border-t border-border"><button type="button" onClick={back} disabled={step === 1} className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">Back</button><button type="button" onClick={step < 8 ? next : finish} disabled={!isStepValid()} className="px-7 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground card-shadow-rest hover:brightness-105 active:scale-[0.98] active:brightness-95 disabled:opacity-40 disabled:cursor-not-allowed transition-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">{step < 8 ? "Continue" : "Finish setup"}</button></div>
      </div>
    </div>
  );
}

function Field({ label, type = "text", value, onChange }: { label: string; type?: string; value: string; onChange: (value: string) => void }) {
  return <label className="block space-y-2"><span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30" /></label>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="block space-y-2"><span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function ChoiceGroup({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <div className="space-y-3"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p><div className="space-y-2">{options.map(([optionValue, title, description]) => <button key={optionValue} type="button" onClick={() => onChange(optionValue)} className={`w-full text-left rounded-2xl border p-4 transition-premium ${value === optionValue ? "border-primary bg-primary/[0.06]" : "border-border hover:bg-muted/40"}`}><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">{title}</span><span className={`h-4 w-4 rounded-full border ${value === optionValue ? "border-primary bg-primary" : "border-muted-foreground/40"}`} /></div>{description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}</button>)}</div></div>;
}

function ValidationError({ message = "Please complete this field." }: { message?: string }) { return <p className="text-xs font-medium text-destructive">{message}</p>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between px-4 py-3 text-sm"><span className="text-muted-foreground">{label}</span><span className="font-medium text-foreground">{value}</span></div>; }

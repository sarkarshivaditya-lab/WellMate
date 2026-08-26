import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  ChevronRight,
  HeartPulse,
  Layers,
  Moon,
  Sparkles,
  Utensils,
  Watch,
} from "lucide-react";

type Status = "live" | "planned";

function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold flex-shrink-0", status === "live" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>
      <span className={cn("h-1.5 w-1.5 rounded-full", status === "live" ? "bg-emerald-500" : "bg-amber-500")} />
      {status === "live" ? "Live" : "Planned"}
    </span>
  );
}

function SectionDivider({ label }: { label: string }) {
  return <div className="flex items-center gap-3 py-1"><div className="flex-1 h-px bg-border/50" /><span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span><div className="flex-1 h-px bg-border/50" /></div>;
}

function FeatureItem({ children }: { children: ReactNode }) {
  return <li className="flex items-start gap-2.5 text-[13px] text-foreground/80"><CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-[3px] text-primary/50" /><span className="leading-snug">{children}</span></li>;
}

function RoadmapCard({ icon, status, title, body, features, footnote }: { icon: ReactNode; status: Status; title: string; body: string; features: string[]; footnote?: string }) {
  return <Card className={cn("border-l-[3px]", status === "live" ? "border-l-primary" : "border-l-amber-400/70")}><CardContent className="px-4 pt-4 pb-5 space-y-3"><div className="flex items-center justify-between"><div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", status === "live" ? "bg-primary/10 text-primary" : "bg-amber-100/80 text-amber-700")}>{icon}</div><StatusBadge status={status} /></div><h3 className="text-[15px] font-semibold leading-snug tracking-[-0.01em]">{title}</h3><p className="text-[13px] leading-relaxed text-foreground/72">{body}</p><ul className="space-y-2.5">{features.map((f, i) => <FeatureItem key={i}>{f}</FeatureItem>)}</ul>{footnote && <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border/40 pt-3 italic">{footnote}</p>}</CardContent></Card>;
}

export default function Roadmap() {
  const navigate = useNavigate();

  return <div className="min-h-screen bg-background pb-[calc(3.5rem+env(safe-area-inset-bottom)+2rem)]">
    <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-xl border-b border-border/30"><div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto"><Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 rounded-xl flex-shrink-0" aria-label="Go back"><ArrowLeft className="h-4 w-4" /></Button><div><p className="text-sm font-semibold leading-none">What's Next</p><p className="text-[11px] text-muted-foreground leading-none mt-1">Roadmap &amp; Vision</p></div></div></div>

    <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto">
      <Card className="border-l-[3px] border-l-primary border-primary/20 bg-primary/[0.035]"><CardContent className="px-4 pt-4 pb-5 space-y-2.5"><p className="text-[10px] font-semibold uppercase tracking-widest text-primary/60">Golden Hour direction</p><p className="text-[13.5px] leading-relaxed text-foreground/85">WellMate is evolving from a general wellness companion into an emergency-response system centered on one job: <span className="font-semibold text-foreground">bridging the Golden Hour gap between accident and action.</span> Wellness remains valuable, but the emergency workflow is the product's center of gravity.</p></CardContent></Card>

      <SectionDivider label="Current build" />
      <RoadmapCard icon={<HeartPulse className="h-4 w-4" />} status="live" title="Golden Hour emergency response" body="The current build prioritizes accident detection, rapid confirmation, emergency escalation and clear status over generic dashboard complexity." features={["Blood type, allergy and emergency-contact capture in local onboarding", "Automatic monitoring with low-frequency GPS and movement-triggered motion sensing", "Manual tracking with explicit TRACKING ACTIVE status", "Deterministic accident state machine with temporal false-positive protection", "Approximately 15-second emergency confirmation with I'M OK and immediate-help paths", "Explicit delivery outcomes for emergency-contact notification", "User-mediated emergency services calling where the build configures a number"]} footnote="Hardware power-button interception is behind a platform boundary and remains unavailable to a normal third-party browser/WebView; the in-app SOS path is the legitimate fallback." />

      <RoadmapCard icon={<Layers className="h-4 w-4" />} status="live" title="WellMate v1 — working wellness foundation" body="The existing wellness experience remains intact around the emergency center of gravity, using local-first data ownership and deferred Convex synchronization." features={["Offline-capable React + TypeScript frontend", "Local-first profile and wellness data persistence", "Physical health, nutrition, activity and sleep tracking", "Mental wellness hub and Convex-backed AI coaching", "Existing Mystic Green design system and accessible touch-first interaction patterns"]} />

      <SectionDivider label="Coming next" />
      <RoadmapCard icon={<Brain className="h-4 w-4" />} status="planned" title="WellMate AI — online intelligence boundary" body="The offline local-model runtime has been removed. Future AI will arrive through a provider-neutral application boundary so the UI remains independent of whichever online plugin or backend is supplied." features={["Online adapter contract isolated from the UI", "Longitudinal wellness-context reasoning through approved online infrastructure", "Privacy-aware prompting and data minimization", "Clear provider state when online AI is unavailable", "No simulated offline inference or model-download UX"]} footnote="Provider integration is intentionally deferred until the supplied online AI plugin is available." />

      <RoadmapCard icon={<Watch className="h-4 w-4" />} status="planned" title="Wearable & platform integration" body="Deep wearable integration remains a future infrastructure track once native plugin and backend telemetry requirements are ready." features={["Apple Health + Apple Watch", "Garmin Connect", "Fitbit", "Samsung Health", "Google Health Connect", "WHOOP", "Oura"]} footnote="Each platform requires its supported native APIs, permissions, developer agreements and deployment configuration." />

      <RoadmapCard icon={<Utensils className="h-4 w-4" />} status="planned" title="Smart nutrition logging" body="The current manual logger establishes the local data model; future intelligence can add approved food databases, scanning and online assistance without coupling the app to local inference." features={["Food database integration", "Natural-language food search", "Macro estimation", "Serving-size normalization", "Barcode scanning", "Saved meals and templates"]} />

      <RoadmapCard icon={<Moon className="h-4 w-4" />} status="planned" title="Sleep intelligence" body="Sleep insights will deepen as wearable telemetry becomes available, with the existing manual path serving as the current fallback." features={["Sleep duration and consistency", "Stage analysis", "Readiness and recovery trends", "HRV-aware correlations", "Automatic wearable-synced sleep"]} />

      <SectionDivider label="The bigger picture" />
      <Card className="bg-primary/[0.035] border-primary/15"><CardContent className="px-4 pt-4 pb-5 space-y-3"><div className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-primary/70" /><p className="text-[10px] font-semibold uppercase tracking-widest text-primary/60">Product positioning</p></div><p className="text-[13px] leading-relaxed text-foreground/80">The Golden Hour is the defining experience: WellMate should tell the user whether monitoring is active, what happens after a suspected accident, what information is available, and who will be contacted. The wellness foundation supports that mission rather than competing with it.</p><p className="text-[13px] leading-relaxed text-foreground/80">Production maturity now depends on native sensor execution, platform-specific deployment configuration, emergency-contact delivery infrastructure and the future online AI provider — not on adding another local model runtime.</p></CardContent></Card>

      <button type="button" onClick={() => navigate("/profile")} className={cn("w-full flex items-center justify-between rounded-xl px-4 py-3.5", "border border-border/50 bg-muted/30 hover:bg-muted/60", "transition-premium text-left")}><span className="text-[13px] text-muted-foreground">Back to Profile</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></button>
    </div>
  </div>;
}

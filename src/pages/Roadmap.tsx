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
  Layers,
  Moon,
  Sparkles,
  Utensils,
  Watch,
} from "lucide-react";

/* ======================================================
   ATOMS
   ====================================================== */

type Status = "live" | "planned";

function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold flex-shrink-0",
        status === "live"
          ? "bg-emerald-100 text-emerald-800"
          : "bg-amber-100 text-amber-800",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "live" ? "bg-emerald-500" : "bg-amber-500",
        )}
      />
      {status === "live" ? "Live" : "Planned"}
    </span>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-border/50" />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex-1 h-px bg-border/50" />
    </div>
  );
}

function FeatureItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[13px] text-foreground/80">
      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-primary/50" />
      <span className="leading-snug">{children}</span>
    </li>
  );
}

function RoadmapCard({
  icon,
  status,
  title,
  body,
  features,
  footnote,
}: {
  icon: ReactNode;
  status: Status;
  title: string;
  body: string;
  features: string[];
  footnote?: string;
}) {
  return (
    <Card
      className={cn(
        "border-l-[3px]",
        status === "live"
          ? "border-l-primary"
          : "border-l-amber-400/70",
      )}
    >
      <CardContent className="pt-4 pb-4 space-y-3">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl flex-shrink-0",
                status === "live"
                  ? "bg-primary/10 text-primary"
                  : "bg-amber-100/80 text-amber-700",
              )}
            >
              {icon}
            </div>
            <h3 className="text-[14px] font-semibold leading-snug">{title}</h3>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Body */}
        <p className="text-[13px] leading-relaxed text-foreground/75">{body}</p>

        {/* Feature list */}
        <ul className="space-y-2">
          {features.map((f, i) => (
            <FeatureItem key={i}>{f}</FeatureItem>
          ))}
        </ul>

        {/* Footnote */}
        {footnote && (
          <p className="text-[11px] text-muted-foreground leading-snug border-t border-border/40 pt-2.5 italic">
            {footnote}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ======================================================
   PAGE
   ====================================================== */

export default function Roadmap() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-[calc(3.5rem+env(safe-area-inset-bottom)+2rem)]">

      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-xl border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-8 w-8 rounded-xl flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="text-sm font-semibold">What's Next</p>
            <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
              Roadmap &amp; Vision
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-6 space-y-5 max-w-2xl mx-auto">

        {/* ── From the builder ── */}
        <Card className="border-primary/20 bg-primary/[0.04]">
          <CardContent className="pt-4 pb-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/60">
              From the builder
            </p>
            <p className="text-[13px] leading-relaxed text-foreground/85">
              WellMate was built by{" "}
              <span className="font-semibold text-foreground">Shivaditya Sarkar</span>, a
              self-taught developer. This project grew out of an opportunity
              offered by{" "}
              <span className="font-semibold text-foreground">Dr. Anuradha Palta ma'am</span>
              {" "}— to whom I am genuinely grateful. The aim was to design and build a
              production-grade health platform: real architecture, real UX decisions,
              real constraints. This is what it looks like so far.
            </p>
          </CardContent>
        </Card>

        {/* ── Current build ── */}
        <SectionDivider label="Current build" />

        <RoadmapCard
          icon={<Layers className="h-4 w-4" />}
          status="live"
          title="WellMate v1 — Working Prototype"
          body="A fully functional proof of concept demonstrating the core architecture and UX approach. The technical foundations are production-grade — offline-first data persistence, modular backend, AI-ready structure. Current constraints are infrastructure scale and deployment resources, not conceptual gaps."
          features={[
            "Offline-first React + TypeScript frontend — fully functional without a network connection",
            "Local-first data persistence with deferred server sync via Convex",
            "Physical health tracking — exercises, nutrition logging, activity",
            "Mental wellness hub — mood tracking, journaling, AI coach tab",
            "General wellness AI assistant with context-aware routing",
            "First-launch disclaimer system with crisis keyword detection",
            "WCAG AA-compliant Mystic Green design system",
          ]}
        />

        {/* ── Coming next ── */}
        <SectionDivider label="Coming next" />

        <RoadmapCard
          icon={<Watch className="h-4 w-4" />}
          status="planned"
          title="Wearable &amp; Platform Integration"
          body="Deep integration with major wearable ecosystems is central to the roadmap. Each platform requires production deployment, developer program enrollment, API compliance review, and backend infrastructure to handle continuous telemetry synchronization. The integration architecture is already designed for this — these are deployment-phase requirements."
          features={[
            "Apple Health + Apple Watch — via HealthKit integration",
            "Garmin Connect — via Garmin Health API",
            "Fitbit — via Fitbit Web API",
            "Samsung Health",
            "Google Fit / Android Health Connect",
            "WHOOP — recovery, HRV, and strain data",
            "Oura Ring — sleep staging and readiness metrics",
          ]}
          footnote="Synced data: heart rate · steps · workouts · calories · recovery score · sleep stages · HRV. Requires production deployment, platform developer agreements, and backend telemetry infrastructure."
        />

        <RoadmapCard
          icon={<Brain className="h-4 w-4" />}
          status="planned"
          title="WellMate AI — Expanded Intelligence"
          body="AI capabilities are intentionally constrained in the prototype. Production AI inference — hosted GPU infrastructure, model runtimes, scalable orchestration, and ongoing API costs — requires funded infrastructure. The vision is a context-aware wellness companion integrated across all of the user's tracked data: not a chatbot, not a diagnostic tool, but an assistant that understands patterns over time."
          features={[
            "Personalized insights driven by the user's own health trends",
            "Pattern recognition across sleep, exercise, mood, and nutrition data",
            "Conversational interface with full longitudinal health context",
            "On-device inference for privacy-sensitive data processing",
            "Cloud-assisted analysis for complex cross-metric correlations",
            "Proactive nudges and trend-aware recommendations",
          ]}
          footnote="Requires: hosted inference infrastructure, GPU compute, model orchestration layer, and ongoing API operational budget."
        />

        <RoadmapCard
          icon={<Utensils className="h-4 w-4" />}
          status="planned"
          title="Smart Nutrition Logging"
          body="The current manual meal logger validates the UX flow and data schema before expanding the integration surface. Full nutrition logging requires food database integrations, serving-size normalization, and intelligent search — the data model and API surface are already architected to support this."
          features={[
            "Food database integration — USDA FoodData Central, Open Food Facts",
            "Intelligent food search with natural language input",
            "Automatic macro estimation from food entries",
            "Serving-size normalization and portion guidance",
            "Barcode scanning for packaged food items",
            "Saved meals and reusable meal template library",
            "AI-assisted meal composition and suggestions",
          ]}
          footnote="Current manual logging intentionally validates UX and data model before infrastructure expansion."
        />

        <RoadmapCard
          icon={<Moon className="h-4 w-4" />}
          status="planned"
          title="Sleep Intelligence"
          body="Sleep insight features are architecturally planned and unlock fully once wearable integrations are implemented. The data model and visualization layer are already designed for this data. Manual sleep input is the current workaround — accurate sleep intelligence requires continuous sensor data from a wearable."
          features={[
            "Sleep duration and consistency tracking",
            "Sleep stage analysis — light, deep, and REM",
            "Recovery scoring and daily readiness metrics",
            "HRV-based wellness and stress correlation",
            "Weekly and monthly trend visualization",
            "Wearable-synced automatic sleep detection",
          ]}
          footnote="Full sleep intelligence unlocks with wearable platform integration."
        />

        {/* ── The bigger picture ── */}
        <SectionDivider label="The bigger picture" />

        <Card className="bg-primary/[0.04] border-primary/15">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary/70" />
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/60">
                Product positioning
              </p>
            </div>
            <p className="text-[13px] leading-relaxed text-foreground/80">
              This is an intentionally focused prototype — built to validate architecture,
              UX decisions, and future scalability. Every design choice and technical
              constraint was made with production scale in mind.
            </p>
            <p className="text-[13px] leading-relaxed text-foreground/80">
              The gap between this prototype and a production consumer product is not a
              conceptual one. It is infrastructure, deployment resources, and ecosystem
              access — all of which are tractable given the right support.
            </p>
          </CardContent>
        </Card>

        {/* Quick-nav back to profile */}
        <button
          type="button"
          onClick={() => navigate("/profile")}
          className={cn(
            "w-full flex items-center justify-between rounded-xl px-4 py-3",
            "border border-border/50 bg-muted/30 hover:bg-muted/60",
            "transition-colors duration-150 text-left",
          )}
        >
          <span className="text-[13px] text-muted-foreground">Back to Profile</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

      </div>
    </div>
  );
}

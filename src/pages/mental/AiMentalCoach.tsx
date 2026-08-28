import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AlertTriangle, Heart, Info, RotateCcw, Send, Sparkles, WifiOff } from "lucide-react";
import type { AiMentalResponse } from "@/services/aiMentalTypes";
import { EMERGENCY_COPY } from "@/content/disclaimerCopy";
import { haptics } from "@/motion";
import { useConnectivity } from "@/hooks/useConnectivity";
import { LAUNCH_STATE } from "@/ai/launchState";

const emotionConfig: Record<AiMentalResponse["emotion"], { bg: string; emoji: string }> = {
  calm: { bg: "bg-emerald-100 text-emerald-800", emoji: "😌" },
  content: { bg: "bg-emerald-100 text-emerald-800", emoji: "😊" },
  hopeful: { bg: "bg-teal-100 text-teal-800", emoji: "🌱" },
  stressed: { bg: "bg-orange-100 text-orange-800", emoji: "😰" },
  anxious: { bg: "bg-yellow-100 text-yellow-800", emoji: "😟" },
  overwhelmed: { bg: "bg-purple-100 text-purple-800", emoji: "😵" },
  frustrated: { bg: "bg-red-100 text-red-800", emoji: "😤" },
  sad: { bg: "bg-blue-100 text-blue-800", emoji: "😢" },
};

function isFallbackResponse(r: AiMentalResponse): boolean {
  return r.confidence === "low" &&
    (r.summary.toLowerCase().includes("setting") ||
      r.summary.toLowerCase().includes("configured") ||
      r.summary.toLowerCase().includes("try again"));
}

const FALLBACK_RESPONSE: AiMentalResponse = {
  summary: "WellMate AI is temporarily unavailable. Please try again shortly.",
  emotion: "calm",
  suggestions: ["Take a slow breath and give yourself a moment", "You can come back and continue when you're ready"],
  practice: { id: "p1", title: "Gentle Breathing", steps: ["Inhale slowly through your nose", "Exhale gently through your mouth", "Repeat for a few calm breaths"] },
  escalation: false,
  confidence: "low",
};

const STARTER_PROMPTS = ["Hi", "I'm feeling a bit overwhelmed", "I just want to talk", "I had a long day", "I want to feel calmer"];

type CoachTabContentProps = { compact?: boolean; onClose?: () => void; initialMessage?: string };

export function CoachTabContent({ compact = false, onClose, initialMessage = "" }: CoachTabContentProps = {}) {
  const [message, setMessage] = useState(initialMessage);
  const [response, setResponse] = useState<AiMentalResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const connectivity = useConnectivity();
  const askCoach = useAction(api.aiMentalCoach.askMentalCoach);

  useEffect(() => {
    if (initialMessage) setMessage(initialMessage);
  }, [initialMessage]);

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    haptics.light();
    setIsLoading(true);
    try {
      const result = await askCoach({ message: trimmed });
      setResponse(result);
      setMessage("");
    } catch {
      setResponse(FALLBACK_RESPONSE);
      setMessage("");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit() {
    await submit(message);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  const fallbackMode = response ? isFallbackResponse(response) : false;

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {onClose && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
      )}

      {!compact && !LAUNCH_STATE.mentalCoachingAvailable && (
        <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-4">
          <p className="text-[13px] font-semibold text-foreground/85 leading-snug">Advanced wellbeing coaching is being prepared for launch</p>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">Mental wellbeing coaching draws on deep reasoning and cloud intelligence capabilities that extend beyond the current offline AI runtime. These features are being finalized and will be available in the full release.</p>
          <p className="mt-2 text-[11px] text-muted-foreground/65">Journaling, mood tracking, and wellbeing tools are fully available.</p>
        </div>
      )}

      {!compact && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/8 px-4 py-3">
          <Heart className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          <div><p className="text-[13px] font-medium leading-snug">WellMate Coach</p><p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">A calm space to talk through what's on your mind — without judgment.</p></div>
        </div>
      )}

      {connectivity === "offline" && (
        <Card className="border-border/50 bg-muted/30"><CardContent className="flex gap-3 pt-4 pb-4"><WifiOff className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" /><div><p className="text-[13px] font-medium">You're offline</p><p className="mt-0.5 text-[12px] text-muted-foreground">Coaching requires a connection. You can still journal or explore tools while offline.</p></div></CardContent></Card>
      )}

      {fallbackMode && connectivity === "online" && (
        <Card className="border-blue-400/30 bg-blue-50/60"><CardContent className="flex gap-3 pt-4 pb-4"><Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" /><div><p className="text-[13px] font-medium text-blue-900">WellMate AI is temporarily unavailable</p><p className="mt-0.5 text-[12px] text-muted-foreground">Please try again shortly. Your data and progress are unaffected.</p></div></CardContent></Card>
      )}

      <Card>
        <CardContent className="space-y-3 pt-4 pb-4">
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={handleKeyDown} placeholder="You can say anything — even just 'hi'." className={cn("resize-none text-[14px] leading-relaxed", compact ? "min-h-[72px]" : "min-h-[96px]")} disabled={isLoading} />
          <Button onClick={handleSubmit} disabled={!message.trim() || isLoading || connectivity === "offline"} className="w-full">{isLoading ? <><Sparkles className="h-4 w-4 animate-pulse" />Thinking…</> : <><Send className="h-4 w-4" />Get Support</>}</Button>
        </CardContent>
      </Card>

      {isLoading && <Card><CardContent className="space-y-3 pt-4 pb-4"><Skeleton className="h-3.5 w-3/4" /><Skeleton className="h-3.5 w-full" /><Skeleton className="h-3.5 w-5/6" /><Skeleton className="mt-2 h-14 w-full" /></CardContent></Card>}

      {response?.escalation && (
        <Card className="border-destructive/25 bg-destructive/5"><CardContent className="space-y-3 pt-4 pb-4"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" /><div className="space-y-1"><p className="text-sm font-semibold">You're not alone</p><p className="text-[13px] leading-relaxed text-muted-foreground">It sounds like you might benefit from talking to someone right now. Reaching out is a sign of strength.</p></div></div><div className="rounded-xl border border-border/40 bg-background/60 p-3 space-y-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{EMERGENCY_COPY.title}</p><p className="text-[12px] text-muted-foreground">{EMERGENCY_COPY.body}</p><div className="space-y-1.5 text-[13px]">{EMERGENCY_COPY.resources.map((r) => <div key={r.label}><span className="font-semibold">{r.label}</span> — {r.description}</div>)}</div></div>{response.summary && !isFallbackResponse(response) && <p className="text-[13px] leading-relaxed text-muted-foreground">{response.summary}</p>}<Button variant="outline" size="sm" onClick={() => { setResponse(null); setMessage(""); }} className="w-full text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" />Start over</Button></CardContent></Card>
      )}

      {response && !response.escalation && (
        <div className="space-y-3">
          <Card><CardHeader className="pb-2"><div className="flex items-center justify-between gap-2"><CardTitle className="text-base">Reflection</CardTitle><span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium", emotionConfig[response.emotion].bg)}>{emotionConfig[response.emotion].emoji} {response.emotion}</span></div></CardHeader><CardContent className="pt-0"><p className="text-[14px] leading-relaxed text-foreground/90">{response.summary}</p></CardContent></Card>
          {response.suggestions.length > 0 && <Card><CardHeader className="pb-2"><CardTitle className="text-base">Gentle suggestions</CardTitle></CardHeader><CardContent className="pt-0 space-y-2.5">{response.suggestions.map((s, i) => <div key={i} className="flex items-start gap-2.5 text-[13px]"><span className="mt-0.5 flex-shrink-0 text-primary">•</span><span className="leading-snug text-foreground/85">{s}</span></div>)}</CardContent></Card>}
          <Button variant="outline" size="sm" onClick={() => { setResponse(null); setMessage(""); }} className="w-full text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" />Ask something else</Button>
        </div>
      )}

      {!response && !isLoading && !compact && <Card><CardHeader className="pb-2"><CardTitle className="text-[13px] font-medium text-muted-foreground">You could start with:</CardTitle></CardHeader><CardContent className="pt-0 grid gap-1.5">{STARTER_PROMPTS.map((p) => <button key={p} onClick={() => setMessage(p)} className={cn("text-left text-[13px] px-3 py-2.5 rounded-xl min-h-[36px]", "bg-secondary/50 hover:bg-secondary", "transition-premium")}>"{p}"</button>)}</CardContent></Card>}
    </div>
  );
}

export default function AiMentalCoach() {
  return <div className="mx-auto max-w-2xl space-y-6 p-6"><div className="space-y-2 text-center"><div className="flex justify-center"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"><Heart className="h-7 w-7 text-primary" /></div></div><h1 className="text-2xl font-bold">WellMate</h1><p className="mx-auto max-w-sm text-sm text-muted-foreground">A calm space for reflection and emotional wellbeing</p></div><CoachTabContent /></div>;
}

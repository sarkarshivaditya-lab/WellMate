import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, Cloud, ShieldCheck } from "lucide-react";

type AiSection = {
  icon: React.ElementType;
  title: string;
  body?: string;
  bullets?: readonly string[];
};

const AI_SECTIONS: AiSection[] = [
  {
    icon: Cpu,
    title: "On-Device Intelligence",
    body: "Certain WellMate features use AI that runs entirely on your device. When available, your reflections and wellness data are processed locally — no internet required, and nothing leaves your phone.",
  },
  {
    icon: Cloud,
    title: "Cloud-Assisted Features",
    body: "Some advanced capabilities — like deep wellbeing coaching — may use secure cloud processing. These features are designed to handle sensitive information carefully and are optional where possible.",
  },
  {
    icon: ShieldCheck,
    title: "Your Privacy",
    bullets: [
      "Wellbeing data is treated as sensitive and never sold to third parties.",
      "WellMate does not share personal data with marketing companies.",
      "AI responses are informational and supportive — not medical advice or clinical diagnosis.",
      "You remain in control: export or delete your data at any time.",
    ],
  },
];

export function AiPrivacyCard() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>AI &amp; Privacy</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          How WellMate uses intelligence and handles your data
        </p>
      </CardHeader>

      <CardContent className="space-y-5 pt-0">
        {AI_SECTIONS.map(({ icon: Icon, title, body, bullets }, i) => (
          <div key={i} className="flex gap-3">
            <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Icon className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="text-[13px] font-semibold text-foreground/90 leading-snug">
                {title}
              </p>
              {body && (
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  {body}
                </p>
              )}
              {bullets && (
                <ul className="space-y-1.5 pt-0.5">
                  {bullets.map((b, bi) => (
                    <li
                      key={bi}
                      className="flex items-start gap-2 text-[12px] leading-relaxed text-muted-foreground"
                    >
                      <span className="mt-[5px] h-[4px] w-[4px] flex-shrink-0 rounded-full bg-primary/40" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}

        <div className="rounded-xl bg-muted/35 px-3.5 py-2.5">
          <p className="text-[11px] leading-relaxed text-muted-foreground/70">
            WellMate is a wellness support tool, not a medical service. AI-generated content is informational only and does not constitute clinical advice.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

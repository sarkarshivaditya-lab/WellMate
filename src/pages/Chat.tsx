import { Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import PageLayout from "@/components/layout/PageLayout";
import { cn } from "@/lib/utils";

export default function Chat() {
  return (
    <PageLayout title="Support" subtitle="Wellness guidance and care">
      <div className="space-y-10 pt-2 pb-6">

        {/* ── Launch headline ── */}
        <div className="space-y-4 pt-2">
          <span
            className={cn(
              "inline-block text-[10.5px] font-semibold tracking-[0.1em] uppercase",
              "text-primary/55 bg-primary/8 rounded-full px-3 py-1",
            )}
          >
            Coming Soon
          </span>
          <h1 className="text-[26px] font-semibold tracking-tight text-foreground leading-[1.25]">
            Human wellness guidance is coming to WellMate.
          </h1>
          <p className="text-[14px] text-muted-foreground/80 leading-relaxed">
            We are building a platform where verified mental wellness professionals,
            dietitians, and nutritionists work alongside WellMate's intelligent
            support systems — giving you care that understands your complete
            wellness history.
          </p>
        </div>

        {/* ── What is being built ── */}
        <div className="space-y-4">
          <p className="text-[11px] font-semibold tracking-[0.09em] uppercase text-muted-foreground/45">
            Planned platform
          </p>
          <div className="space-y-3">
            {[
              "Mental wellness professionals, therapists & counsellors",
              "Registered dietitians & nutritionists",
              "Longitudinal care informed by your full wellness history",
              "Intelligent support available between sessions",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <div className="mt-[6px] h-1 w-1 rounded-full bg-primary/35 flex-shrink-0" />
                <p className="text-[13.5px] text-foreground/65 leading-snug">{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Philosophy ── */}
        <Card className="border-border/25 bg-muted/15">
          <CardContent className="py-5 px-5">
            <p className="text-[13px] text-foreground/50 leading-relaxed">
              WellMate is designed from the ground up to combine longitudinal
              wellness understanding with human expertise — so that every
              consultation begins with context, not a blank page.
            </p>
          </CardContent>
        </Card>

        {/* ── Founder contact ── */}
        <div className="space-y-4">
          <p className="text-[11px] font-semibold tracking-[0.09em] uppercase text-muted-foreground/45">
            Early access & consultation
          </p>
          <Card className="border-border/40">
            <CardContent className="py-5 px-5 space-y-4">
              <div className="space-y-0.5">
                <p className="text-[15px] font-semibold text-foreground tracking-tight">
                  Dr. Anuradha Palta
                </p>
                <p className="text-[12.5px] text-muted-foreground/70">
                  Founder, WellMate
                </p>
              </div>
              <p className="text-[12.5px] text-muted-foreground/65 leading-relaxed">
                For wellness consultations, early access enquiries, or platform
                partnership discussions, you are welcome to reach out directly.
              </p>
              <a
                href="tel:+917061486520"
                className={cn(
                  "inline-flex items-center gap-2.5",
                  "px-4 py-2.5 rounded-xl",
                  "bg-muted/40 hover:bg-muted/70",
                  "border border-border/35 hover:border-border/60",
                  "transition-premium active:scale-[0.97]",
                )}
              >
                <Phone className="h-3.5 w-3.5 text-foreground/40" strokeWidth={2} />
                <span className="text-[13px] font-medium text-foreground/65">
                  +91 70614 86520
                </span>
              </a>
            </CardContent>
          </Card>
        </div>

        {/* ── Closing note ── */}
        <p className="text-[11px] text-muted-foreground/35 leading-relaxed pb-2">
          The WellMate Support platform is currently in development. Clinical and
          wellness professionals interested in joining the network are invited to connect.
        </p>

      </div>
    </PageLayout>
  );
}

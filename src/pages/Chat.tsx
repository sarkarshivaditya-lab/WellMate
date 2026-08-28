import { Stethoscope, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import PageLayout from "@/components/layout/PageLayout";
import { cn } from "@/lib/utils";

export default function Chat() {
  return (
    <PageLayout title="Support" subtitle="Human care is coming to WellMate">
      <div className="space-y-8 pt-2 pb-6">
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
            Talk to the right healthcare professional from home.
          </h1>
          <p className="text-[14px] text-muted-foreground/80 leading-relaxed">
            In upcoming versions, WellMate will make it possible to connect with
            doctors and healthcare professionals across specialties from the comfort
            of your home — with your wellness context ready when you need it.
          </p>
        </div>

        <Card className="glass-brand border-primary/20">
          <CardContent className="py-6 px-5 space-y-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[15px] font-semibold text-foreground">
                  Healthcare access, built into WellMate
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  The goal is simple: when you need human expertise, you should be
                  able to find and connect with the appropriate professional without
                  leaving your home.
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {[
                "Doctors across multiple specialties",
                "Mental health and wellbeing professionals",
                "Dietitians and nutrition specialists",
                "Care informed by your WellMate wellness history",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="mt-[6px] h-1.5 w-1.5 rounded-full bg-primary/45 flex-shrink-0" />
                  <p className="text-[13.5px] text-foreground/70 leading-snug">{item}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-subtle">
          <CardContent className="py-6 px-5">
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary/65" />
              <div>
                <p className="text-[13.5px] font-semibold text-foreground/85">
                  This network is being built now.
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  Doctor and specialist consultations are not available in the
                  current release. This section will become your gateway to human
                  healthcare support in a future version of WellMate.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <p className="text-[11px] text-muted-foreground/45 leading-relaxed pb-2">
          Until these services launch, WellMate's current features remain focused on
          wellness guidance, health tracking, and emergency-support capabilities.
        </p>
      </div>
    </PageLayout>
  );
}

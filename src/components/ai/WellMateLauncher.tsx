import * as React from "react";
import { LotusIcon } from "@/components/LotusIcon";
import { cn } from "@/lib/utils";
import { CoachTabContent } from "@/pages/mental/AiMentalCoach";
import { subscribeToWellMateOpen } from "@/ai/wellMateEvents";

export function WellMateLauncher() {
  const [open, setOpen] = React.useState(false);
  const [initialMessage, setInitialMessage] = React.useState("");
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    return subscribeToWellMateOpen(({ prompt }) => {
      setOpen(true);
      setInitialMessage(prompt ?? "");
    });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open WellMate Coach"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "fixed z-50 right-4",
          "bottom-[calc(env(safe-area-inset-bottom)+56px+12px)]",
          "h-11 w-11 rounded-full",
          "bg-primary text-primary-foreground",
          "shadow-[0_4px_16px_rgba(20,60,50,0.24),_0_1px_4px_rgba(20,60,50,0.16)]",
          "flex items-center justify-center",
          "transition-premium",
          "hover:brightness-105 hover:scale-[1.04]",
          "active:scale-[0.97]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        )}
      >
        <LotusIcon className={cn("h-5 w-5", !open && "animate-lotus-breathe")} />
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="WellMate Coach"
          className={cn(
            "fixed z-50 right-4",
            "bottom-[calc(env(safe-area-inset-bottom)+56px+64px)]",
            "w-[min(380px,calc(100vw-2rem))]",
            "max-h-[75dvh] overflow-y-auto",
            "rounded-2xl border border-border/40 bg-card/95 backdrop-blur-xl text-card-foreground",
            "shadow-[0_8px_32px_rgba(20,60,50,0.14),_0_2px_8px_rgba(20,60,50,0.08)]",
            "p-3",
          )}
        >
          <div className="px-1 pb-2">
            <p className="text-sm font-medium">WellMate Coach</p>
            <p className="text-xs text-muted-foreground">Same mental coaching AI used in /mental</p>
          </div>
          <CoachTabContent compact initialMessage={initialMessage} onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}

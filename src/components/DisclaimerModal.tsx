import { useEffect, useRef } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setDisclaimerAcked } from "@/data/disclaimerStore";
import { PolicyContent } from "@/components/PolicyContent";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

interface DisclaimerModalProps {
  onAck: () => void;
}

export function DisclaimerModal({ onAck }: DisclaimerModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));

    getFocusable()[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const items = getFocusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleAck() {
    setDisclaimerAcked();
    onAck();
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6 bg-black/55 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div className="w-full max-w-md h-[90vh] flex flex-col rounded-2xl bg-card border border-border/50 shadow-2xl overflow-hidden">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-6 pt-7 pb-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100/90 border border-amber-200/70 shadow-sm">
              <ShieldAlert className="h-5 w-5 text-amber-700" />
            </div>
          </div>
          <p
            id="disclaimer-title"
            className="text-[15px] font-semibold text-foreground/90 leading-snug"
          >
            Before you begin
          </p>
          <p className="mt-2 text-[12.5px] leading-snug text-muted-foreground">
            Please read our Terms of Service and Privacy Policy.
          </p>
        </div>

        {/* ── Divider ────────────────────────────────────────── */}
        <div className="flex-shrink-0 h-px bg-border/30" />

        {/* ── Scrollable body ────────────────────────────────── */}
        <div className="relative flex-1 min-h-0">
          <div className="absolute inset-0 overflow-y-auto px-5 py-5 overscroll-contain">
            <PolicyContent />
            {/* Bottom spacer so last card clears the footer fade */}
            <div className="h-4" />
          </div>
          {/* Fade indicating scrollable content below */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-card to-transparent" />
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 px-5 pt-4 border-t border-border/25"
          style={{
            paddingBottom:
              "max(1.25rem, calc(1.25rem + env(safe-area-inset-bottom, 0px)))",
          }}
        >
          <Button className="w-full" onClick={handleAck}>
            I understand — continue to WellMate
          </Button>
          <p className="mt-2.5 text-[11px] text-center text-muted-foreground">
            By continuing, you acknowledge these terms.
          </p>
        </div>
      </div>
    </div>
  );
}

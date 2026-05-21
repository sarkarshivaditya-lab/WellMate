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
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
    >
      <div className="w-full max-w-md max-h-[90dvh] flex flex-col rounded-2xl bg-card border border-amber-200/60 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 bg-amber-50/80 border-b border-amber-200/50 flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 border border-amber-200/60 flex-shrink-0">
              <ShieldAlert className="h-4 w-4 text-amber-700" />
            </div>
            <p id="disclaimer-title" className="text-sm font-semibold text-amber-900">
              Before you begin
            </p>
          </div>
          <p className="text-[13px] text-amber-800/80 leading-snug">
            Please read the Terms of Service and Privacy Policy before using the app.
          </p>
        </div>

        {/* Scrollable policy body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 overscroll-y-contain">
          <PolicyContent />
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 flex-shrink-0 border-t border-border/30">
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

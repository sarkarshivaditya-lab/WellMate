import * as React from "react";
import { cn } from "@/lib/utils";

function WellMateLauncher() {
  const [open, setOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  // Close on Escape key
  React.useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <>
      {/* Floating launcher button */}
      <button
        type="button"
        aria-label="Open WellMate"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed z-50",
          "right-4",
          "bottom-[calc(env(safe-area-inset-bottom)+56px+12px)]",
          "h-11 w-11 rounded-full",
          "bg-primary text-primary-foreground",
          "shadow-md",
          "flex items-center justify-center",
          "text-sm font-medium",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        )}
      >
        WM
      </button>

      {/* Placeholder panel (UI only, no AI yet) */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="WellMate"
          className={cn(
            "fixed z-50",
            "right-4",
            "bottom-[calc(env(safe-area-inset-bottom)+56px+64px)]",
            "w-72",
            "rounded-lg border bg-card text-card-foreground",
            "shadow-lg",
          )}
        >
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-medium">WellMate</p>
            <p className="text-xs text-muted-foreground">
              Your health companion
            </p>
          </div>

          <div className="px-4 py-4 text-sm text-muted-foreground">
            WellMate will be available here.
          </div>
        </div>
      )}
    </>
  );
}

export { WellMateLauncher };

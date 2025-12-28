import * as React from "react";
import { cn } from "@/lib/utils";

function WellMateLauncher() {
  const [open, setOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

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

  // Focus input when panel opens
  React.useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
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

      {/* AI panel shell */}
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
            "w-80",
            "rounded-xl border bg-card text-card-foreground",
            "shadow-lg",
            "flex flex-col",
          )}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b">
            <p className="text-sm font-medium">WellMate</p>
            <p className="text-xs text-muted-foreground">
              Your health companion
            </p>
          </div>

          {/* Message list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
            <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2">
              Hi, I’m WellMate 👋
            </div>
            <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2">
              I’ll help you with fitness, nutrition, and wellbeing.
            </div>
            <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2">
              You’ll be able to ask questions here soon.
            </div>
          </div>

          {/* Input area */}
          <div className="border-t px-3 py-2 flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask WellMate…"
              disabled
              className={cn(
                "flex-1 rounded-md border bg-background px-3 py-2 text-sm",
                "text-muted-foreground",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              )}
            />
            <button
              type="button"
              disabled
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium",
                "bg-muted text-muted-foreground",
              )}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export { WellMateLauncher };

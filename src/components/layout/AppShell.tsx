import React from "react";
import { useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import BottomNav from "./BottomNav";
import { WellMateLauncher } from "@/components/ai/WellMateLauncher";
import { DisclaimerModal } from "@/components/DisclaimerModal";
import { hasAckedDisclaimer } from "@/data/disclaimerStore";
import OfflineBanner from "@/components/OfflineBanner";
import SyncPulse from "@/components/SyncPulse";
import { CommandPaletteProvider, useCommandPalette } from "@/contexts/commandPaletteContext";
import { WellmateCommandPalette } from "@/components/search/WellmateCommandPalette";
import { haptics } from "@/motion/haptics";
import { emitAnalyticsEvent } from "@/analytics/eventBus";
import { cn } from "@/lib/utils";

// ── Top search bar ────────────────────────────────────────────────────────────
// Sits at the very top of the AppShell flex column, outside the scrollable
// main container — so it stays visible regardless of scroll position without
// needing fixed positioning. pt-[env(safe-area-inset-top)] handles notches.

function TopSearchBar() {
  const { openPalette } = useCommandPalette();

  function handleOpen() {
    haptics.light();
    emitAnalyticsEvent({ type: "command_palette_opened", ts: Date.now() });
    openPalette();
  }

  return (
    <div
      className={cn(
        "relative z-20 w-full shrink-0",
        "bg-secondary/70 backdrop-blur-md",
        "border-b border-border/50",
        "pt-[env(safe-area-inset-top)]",
      )}
    >
      <div className="w-full sm:max-w-4xl mx-auto px-4 sm:px-6 py-2">
        <button
          type="button"
          onClick={handleOpen}
          aria-label="Search"
          className={cn(
            "w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl",
            "bg-background hover:bg-card",
            "border border-border/70 hover:border-border",
            "shadow-sm",
            "text-muted-foreground",
            "transition-premium active:scale-[0.99]",
          )}
        >
          <Search className="h-4 w-4 flex-shrink-0" />
          <span className="text-[13px] flex-1 text-left">Search</span>
          <kbd
            aria-hidden
            className="hidden sm:inline-flex items-center text-[10px] text-muted-foreground/60 border border-border/50 rounded px-1.5 py-0.5 font-medium"
          >
            ⌘K
          </kbd>
        </button>
      </div>
    </div>
  );
}

// ── Keyboard shortcut handler ─────────────────────────────────────────────────

function KeyboardShortcut() {
  const { openPalette, open } = useCommandPalette();

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k" && !open) {
        e.preventDefault();
        emitAnalyticsEvent({ type: "command_palette_opened", ts: Date.now() });
        openPalette();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, openPalette]);

  return null;
}

// ── Shell inner (requires palette context) ─────────────────────────────────────

function AppShellInner({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [showDisclaimer, setShowDisclaimer] = React.useState(
    () => !hasAckedDisclaimer(),
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Skip-to-content — keyboard accessibility */}
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>

      {/* Global search bar — above all page content, never scrolls */}
      <TopSearchBar />

      {/* Connectivity + sync status strips */}
      <OfflineBanner />
      <SyncPulse />

      {/* Main scrollable content */}
      <main
        id="main-content"
        aria-label="Main content"
        className="flex-1 overflow-y-auto pb-[calc(3.5rem+env(safe-area-inset-bottom)+1.5rem)]"
      >
        <div key={location.pathname} className="animate-wm-route-in">
          {children}
        </div>
      </main>

      {/* Persistent bottom navigation */}
      <BottomNav />

      {/* Persistent WellMate launcher — bottom-right, above nav */}
      <WellMateLauncher />

      {/* Command palette — rendered in portal, lives here so all children can open it */}
      <WellmateCommandPalette />

      {/* Keyboard shortcut listener */}
      <KeyboardShortcut />

      {/* First-launch disclaimer — non-dismissable until acknowledged */}
      {showDisclaimer && (
        <DisclaimerModal onAck={() => setShowDisclaimer(false)} />
      )}
    </div>
  );
}

// ── AppShell root (provides palette context) ──────────────────────────────────

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CommandPaletteProvider>
      <AppShellInner>{children}</AppShellInner>
    </CommandPaletteProvider>
  );
}

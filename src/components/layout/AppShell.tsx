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

// ── Search FAB ────────────────────────────────────────────────────────────────
// Positioned bottom-left, mirroring WellMateLauncher on the right.
// Provides a persistent mobile-friendly palette trigger without modifying nav.

function SearchFab() {
  const { openPalette } = useCommandPalette();

  function handleOpen() {
    haptics.light();
    emitAnalyticsEvent({ type: "command_palette_opened", ts: Date.now() });
    openPalette();
  }

  return (
    <button
      onClick={handleOpen}
      aria-label="Open search"
      className={cn(
        "fixed z-40 left-4",
        "bottom-[calc(env(safe-area-inset-bottom)+56px+12px)]",
        "flex items-center gap-1.5 px-3 py-2 rounded-full",
        "bg-background/90 backdrop-blur-md",
        "border border-border/50 shadow-sm",
        "text-muted-foreground text-xs font-medium",
        "transition-premium active:scale-[0.95] hover:border-border/80 hover:text-foreground",
      )}
    >
      <Search className="h-3.5 w-3.5" />
      <span>Search</span>
    </button>
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

      {/* Connectivity + sync status strips — always above content */}
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

      {/* Search FAB — bottom-left, above nav */}
      <SearchFab />

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

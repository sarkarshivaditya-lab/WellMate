import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, User } from "lucide-react";
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

function TopSearchBar() {
  const { openPalette } = useCommandPalette();
  const navigate = useNavigate();

  function handleOpen() {
    haptics.light();
    emitAnalyticsEvent({ type: "command_palette_opened", ts: Date.now() });
    openPalette();
  }

  function handleProfile() {
    haptics.light();
    navigate("/profile");
  }

  return (
    <div
      className={cn(
        "relative z-20 w-full shrink-0",
        "glass-secondary border-0 border-b rounded-none",
        "pt-[env(safe-area-inset-top)]",
      )}
    >
      <div className="w-full sm:max-w-4xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-2.5">
        <button
          type="button"
          onClick={handleOpen}
          aria-label="Search"
          className={cn(
            "flex-1 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl min-h-10",
            "glass-subtle text-muted-foreground",
            "hover:text-foreground transition-premium active:scale-[0.99]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          )}
        >
          <Search className="h-4 w-4 flex-shrink-0" />
          <span className="text-[13px] flex-1 text-left">Search</span>
          <kbd
            aria-hidden
            className="hidden sm:inline-flex items-center text-[10px] text-muted-foreground/70 border border-border/50 rounded px-1.5 py-0.5 font-medium"
          >
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          onClick={handleProfile}
          aria-label="Profile"
          className={cn(
            "flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full",
            "glass-subtle text-muted-foreground hover:text-foreground",
            "transition-premium active:scale-[0.94]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          )}
        >
          <User className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

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

function AppShellInner({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [showDisclaimer, setShowDisclaimer] = React.useState(
    () => !hasAckedDisclaimer(),
  );

  return (
    <div className="min-h-screen wm-ambient-bg flex flex-col">
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>

      <TopSearchBar />

      <OfflineBanner />
      <SyncPulse />

      <main
        id="main-content"
        aria-label="Main content"
        className="flex-1 overflow-y-auto pb-[calc(3.5rem+env(safe-area-inset-bottom)+1.5rem)]"
      >
        <div key={location.pathname} className="animate-wm-route-in">
          {children}
        </div>
      </main>

      <BottomNav />
      <WellMateLauncher />
      <WellmateCommandPalette />
      <KeyboardShortcut />

      {showDisclaimer && (
        <DisclaimerModal onAck={() => setShowDisclaimer(false)} />
      )}
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <CommandPaletteProvider>
      <AppShellInner>{children}</AppShellInner>
    </CommandPaletteProvider>
  );
}

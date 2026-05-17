import React from "react";
import { useLocation } from "react-router-dom";
import BottomNav from "./BottomNav";
import { WellMateLauncher } from "@/components/ai/WellMateLauncher";
import { DisclaimerModal } from "@/components/DisclaimerModal";
import { hasAckedDisclaimer } from "@/data/disclaimerStore";
import OfflineBanner from "@/components/OfflineBanner";
import SyncPulse from "@/components/SyncPulse";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const location = useLocation();
  const [showDisclaimer, setShowDisclaimer] = React.useState(
    () => !hasAckedDisclaimer(),
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Connectivity + sync status strips — always above content */}
      <OfflineBanner />
      <SyncPulse />

      {/* Main scrollable content */}
      <main className="flex-1 overflow-y-auto pb-[calc(3.5rem+env(safe-area-inset-bottom)+1.5rem)]">
        <div key={location.pathname} className="animate-wm-route-in">
          {children}
        </div>
      </main>

      {/* Persistent bottom navigation */}
      <BottomNav />

      {/* Persistent WellMate launcher */}
      <WellMateLauncher />

      {/* First-launch disclaimer — non-dismissable until acknowledged */}
      {showDisclaimer && (
        <DisclaimerModal onAck={() => setShowDisclaimer(false)} />
      )}
    </div>
  );
}

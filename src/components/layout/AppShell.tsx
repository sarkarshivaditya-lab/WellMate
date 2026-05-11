import React from "react";
import BottomNav from "./BottomNav";
import { WellMateLauncher } from "@/components/ai/WellMateLauncher";
import { DisclaimerModal } from "@/components/DisclaimerModal";
import { hasAckedDisclaimer } from "@/data/disclaimerStore";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [showDisclaimer, setShowDisclaimer] = React.useState(
    () => !hasAckedDisclaimer(),
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main scrollable content */}
      <main className="flex-1 overflow-y-auto pb-[calc(3.5rem+env(safe-area-inset-bottom)+1.5rem)]">
        {children}
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

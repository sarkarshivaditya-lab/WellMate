import React from "react";
import BottomNav from "./BottomNav";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main scrollable content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Persistent bottom navigation */}
      <BottomNav />
    </div>
  );
}

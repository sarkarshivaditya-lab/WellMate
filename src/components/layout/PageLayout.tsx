import React from "react";
import { cn } from "@/lib/utils";
import {
  getSyncStatus,
  getSyncSummary,
  subscribeToSyncStatus,
  requestManualRetry,
  openDeadletterView,
  consumeDeadletterOpen,
} from "@/sync/syncStatus";
import {
  getDeadletterQueue,
  restoreDeadletterTask,
  discardDeadletterTask,
} from "@/sync/syncQueue";

type PageTab = {
  label: string;
  value: string;
};

type PageLayoutProps = {
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  tabs?: PageTab[];
  activeTab?: string;
  onTabChange?: (value: string) => void;
  children: React.ReactNode;
};

function PageLayout({
  title,
  subtitle,
  headerRight,
  tabs,
  activeTab,
  onTabChange,
  children,
}: PageLayoutProps) {
  const [, forceRender] = React.useReducer((x) => x + 1, 0);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [deadletterOpen, setDeadletterOpen] = React.useState(false);

  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const badgeRef = React.useRef<HTMLDivElement | null>(null);
  const deadRef  = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    return subscribeToSyncStatus(() => forceRender());
  }, []);

  React.useEffect(() => {
    if (consumeDeadletterOpen()) {
      setDeadletterOpen(true);
      setPanelOpen(false);
    }
  }, []);

  React.useEffect(() => {
    function onClickOutside(e: PointerEvent) {
      if (
        panelOpen &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        badgeRef.current &&
        !badgeRef.current.contains(e.target as Node)
      ) {
        setPanelOpen(false);
      }

      if (
        deadletterOpen &&
        deadRef.current &&
        !deadRef.current.contains(e.target as Node)
      ) {
        setDeadletterOpen(false);
      }
    }

    document.addEventListener("pointerdown", onClickOutside);
    return () => document.removeEventListener("pointerdown", onClickOutside);
  }, [panelOpen, deadletterOpen]);

  const syncStatus = getSyncStatus();
  const { pendingCount, deadletterCount, hasErrors } = getSyncSummary();
  const deadletter = getDeadletterQueue();

  const showBadge = syncStatus !== "idle" || pendingCount > 0 || hasErrors;
  const hasHeader = title || subtitle || headerRight || showBadge || (tabs && tabs.length > 0);

  return (
    <div className="min-h-screen w-full bg-background relative">
      {/* Subtle indigo-to-background gradient — depth, not decoration */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-header-gradient-start to-background"
      />

      <div
        className={cn(
          "relative z-10 w-full mx-auto pb-8",
          "px-4 sm:px-6 sm:max-w-4xl",
          hasHeader ? "pt-16" : "pt-8",
        )}
      >
        {hasHeader && (
          <header
            className={cn(
              "mb-8 rounded-2xl",
              "bg-card/90 backdrop-blur-sm",
              "border border-border/40",
              "shadow-[0_1px_3px_rgba(20,60,50,0.05),_0_4px_16px_rgba(20,60,50,0.08)]",
              "px-5 sm:px-6 pt-5 pb-4",
              "space-y-4",
            )}
          >
            {/* Title row — sync chip + headerRight in unified right zone, no absolute positioning */}
            {(title || subtitle || headerRight || showBadge) && (
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {title && (
                    <h1 className="text-[22px] font-semibold leading-tight tracking-tight">
                      {title}
                    </h1>
                  )}
                  {subtitle && (
                    <p className="mt-1 text-[13px] text-muted-foreground leading-snug">
                      {subtitle}
                    </p>
                  )}
                </div>

                {(showBadge || headerRight) && (
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    {showBadge && (
                      <div className="relative" ref={badgeRef}>
                        <button
                          onClick={() => setPanelOpen((v) => !v)}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium border",
                            "transition-premium",
                            "hover:brightness-[0.97] active:scale-[0.98]",
                            syncStatus === "offline"  && "bg-muted text-muted-foreground border-border",
                            syncStatus === "syncing"  && "bg-blue-50 text-blue-700 border-blue-200/80",
                            syncStatus === "error"    && "bg-red-50 text-red-700 border-red-200/80",
                            syncStatus === "retrying" && "bg-amber-50 text-amber-700 border-amber-200/80",
                            syncStatus === "idle"     && "bg-muted text-muted-foreground border-border",
                          )}
                        >
                          <span>
                            {syncStatus === "offline"  && "Offline"}
                            {syncStatus === "syncing"  && "Syncing"}
                            {syncStatus === "retrying" && "Retrying"}
                            {syncStatus === "error"    && "Sync error"}
                            {syncStatus === "idle"     && "Sync"}
                          </span>

                          {pendingCount > 0 && (
                            <span className="opacity-50">({pendingCount})</span>
                          )}

                          {hasErrors && (
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          )}
                        </button>

                        {panelOpen && (
                          <div
                            ref={panelRef}
                            className={cn(
                              "absolute right-0 top-full mt-2 w-64 rounded-2xl z-50",
                              "border border-border bg-card",
                              "shadow-[0_4px_16px_rgba(20,60,50,0.10),_0_1px_4px_rgba(20,60,50,0.06)]",
                              "p-4 text-sm",
                              "animate-in fade-in slide-in-from-top-1 duration-150",
                            )}
                          >
                            <div className="space-y-2">
                              <div className="font-semibold tracking-tight">Sync</div>

                              <div className="text-muted-foreground">
                                {syncStatus === "syncing" && "Syncing your data…"}
                                {syncStatus === "retrying" && "Retrying failed items…"}
                                {syncStatus === "error" && "Some items couldn't sync."}
                                {syncStatus === "offline" && "You're offline — sync will resume automatically."}
                                {syncStatus === "idle" && pendingCount === 0 && "Everything is up to date."}
                                {syncStatus === "idle" && pendingCount > 0 && `${pendingCount} item${pendingCount !== 1 ? "s" : ""} waiting to sync.`}
                              </div>

                              {deadletterCount > 0 && (
                                <div className="text-muted-foreground">
                                  <span className="font-medium text-foreground">{deadletterCount}</span>{" "}
                                  item{deadletterCount !== 1 ? "s" : ""} failed to sync.
                                </div>
                              )}
                            </div>

                            <div className="mt-4 flex flex-col gap-2">
                              <button
                                onClick={() => { requestManualRetry(); setPanelOpen(false); }}
                                className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted transition-premium"
                              >
                                Retry now
                              </button>

                              {deadletterCount > 0 && (
                                <button
                                  onClick={() => { openDeadletterView(); setPanelOpen(false); }}
                                  className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted transition-premium"
                                >
                                  View failed items
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {headerRight && (
                      <div className="shrink-0">{headerRight}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Pill tabs */}
            {tabs && tabs.length > 0 && (
              <div className="flex gap-1 bg-muted rounded-full p-2 w-full">
                {tabs.map((tab) => {
                  const isActive = tab.value === activeTab;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => onTabChange?.(tab.value)}
                      className={cn(
                        "flex-1 px-2 py-2.5 text-[13px] font-medium rounded-full min-h-[36px] text-center",
                        "transition-premium",
                        isActive
                          ? "bg-card text-foreground shadow-[0_1px_3px_rgba(20,60,50,0.12),_0_0_0_1px_rgba(20,60,50,0.05)]"
                          : "text-muted-foreground hover:text-foreground/80",
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}
          </header>
        )}

        {children}
      </div>

      {/* Dead-letter panel — preserved exactly */}
      {deadletterOpen && (
        <div
          ref={deadRef}
          className={cn(
            "fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom)+0.5rem)] right-4 left-4",
            "sm:left-auto sm:w-96",
            "rounded-2xl border border-border bg-card",
            "shadow-[0_8px_32px_rgba(20,60,50,0.12)]",
            "p-4 z-50",
            "animate-in fade-in slide-in-from-bottom-2 duration-200",
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold tracking-tight">Failed sync items</div>
            <button
              onClick={() => setDeadletterOpen(false)}
              className="text-sm text-muted-foreground hover:text-foreground transition-premium"
            >
              Close
            </button>
          </div>

          {deadletter.length === 0 ? (
            <div className="text-sm text-muted-foreground">No failed items.</div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-auto">
              {deadletter.map((task) => (
                <div
                  key={task.id}
                  className="rounded-xl border border-border p-3 text-sm transition-premium hover:bg-muted/30"
                >
                  <div className="font-medium">
                    {task.entity} · {task.action}
                  </div>
                  <div className="text-muted-foreground">
                    Attempts: {task.attempts}
                  </div>

                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => restoreDeadletterTask(task.id)}
                      className="flex-1 rounded-xl border border-border px-2 py-1 hover:bg-muted transition-premium"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => discardDeadletterTask(task.id)}
                      className="flex-1 rounded-xl border border-border px-2 py-1 hover:bg-muted transition-premium"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PageLayout;

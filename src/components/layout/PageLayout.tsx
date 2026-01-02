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
  tabs?: PageTab[];
  activeTab?: string;
  onTabChange?: (value: string) => void;
  children: React.ReactNode;
};

function PageLayout({
  title,
  subtitle,
  tabs,
  activeTab,
  onTabChange,
  children,
}: PageLayoutProps) {
  const hasHeader = title || subtitle || (tabs && tabs.length > 0);

  const [, forceRender] = React.useReducer((x) => x + 1, 0);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [deadletterOpen, setDeadletterOpen] = React.useState(false);

  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const badgeRef = React.useRef<HTMLDivElement | null>(null);
  const deadRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    return subscribeToSyncStatus(() => forceRender());
  }, []);

  React.useEffect(() => {
    if (consumeDeadletterOpen()) {
      setDeadletterOpen(true);
      setPanelOpen(false);
    }
  });

  React.useEffect(() => {
    function onClickOutside(e: MouseEvent) {
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

    document.addEventListener("mousedown", onClickOutside);
    return () =>
      document.removeEventListener("mousedown", onClickOutside);
  }, [panelOpen, deadletterOpen]);

  const syncStatus = getSyncStatus();
  const { pendingCount, deadletterCount, hasErrors } =
    getSyncSummary();
  const deadletter = getDeadletterQueue();

  const showBadge =
    syncStatus !== "idle" || pendingCount > 0 || hasErrors;

  return (
    <div className="min-h-screen w-full bg-background relative">
      <div
        aria-hidden
        className="
          pointer-events-none fixed inset-0 z-0
          bg-gradient-to-b
          from-header-gradient-start
          via-header-gradient-end/60
          to-background
        "
      />

      <div
        className={cn(
          "relative z-10 w-full mx-auto pb-8",
          "px-4 sm:px-6 sm:max-w-4xl",
          hasHeader ? "pt-16" : "pt-8",
        )}
      >
        {hasHeader && (
          <header className="mb-8 space-y-4 rounded-2xl bg-background border border-border/60 px-4 sm:px-6 py-5 relative">
            {showBadge && (
              <div className="absolute top-4 right-4">
                <div ref={badgeRef}>
                  <button
                    onClick={() => setPanelOpen((v) => !v)}
                    className={cn(
                      "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border",
                      "transition-all duration-150",
                      "hover:shadow-sm hover:scale-[1.02]",
                      syncStatus === "offline" &&
                        "bg-muted text-muted-foreground border-border",
                      syncStatus === "syncing" &&
                        "bg-blue-50 text-blue-700 border-blue-200",
                      syncStatus === "error" &&
                        "bg-red-50 text-red-700 border-red-200",
                      syncStatus === "retrying" &&
                        "bg-amber-50 text-amber-700 border-amber-200",
                      syncStatus === "idle" &&
                        "bg-muted text-muted-foreground border-border",
                    )}
                  >
                    <span>
                      {syncStatus === "offline" && "Offline"}
                      {syncStatus === "syncing" && "Syncing"}
                      {syncStatus === "retrying" && "Retrying"}
                      {syncStatus === "error" && "Sync error"}
                      {syncStatus === "idle" && "Sync"}
                    </span>

                    {pendingCount > 0 && (
                      <span className="opacity-70">
                        ({pendingCount})
                      </span>
                    )}

                    {hasErrors && (
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                    )}
                  </button>
                </div>

                {panelOpen && (
                  <div
                    ref={panelRef}
                    className="
                      absolute right-0 mt-2 w-64 rounded-xl
                      border border-border bg-background
                      shadow-lg p-4 text-sm z-50
                      animate-in fade-in slide-in-from-top-1
                      duration-150
                    "
                  >
                    <div className="space-y-2">
                      <div className="font-medium">
                        Sync status
                      </div>

                      <div className="text-muted-foreground">
                        State:{" "}
                        <span className="font-medium text-foreground">
                          {syncStatus}
                        </span>
                      </div>

                      <div className="text-muted-foreground">
                        Pending items:{" "}
                        <span className="font-medium text-foreground">
                          {pendingCount}
                        </span>
                      </div>

                      <div className="text-muted-foreground">
                        Failed items:{" "}
                        <span className="font-medium text-foreground">
                          {deadletterCount}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2">
                      <button
                        onClick={() => {
                          requestManualRetry();
                          setPanelOpen(false);
                        }}
                        className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted transition"
                      >
                        Retry now
                      </button>

                      {deadletterCount > 0 && (
                        <button
                          onClick={() => {
                            openDeadletterView();
                            setPanelOpen(false);
                          }}
                          className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted transition"
                        >
                          View failed items
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {(title || subtitle) && (
              <div>
                {title && (
                  <h1 className="text-2xl font-semibold leading-tight">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {subtitle}
                  </p>
                )}
              </div>
            )}

            {tabs && tabs.length > 0 && (
              <div className="flex gap-1 border-b border-border">
                {tabs.map((tab) => {
                  const isActive =
                    tab.value === activeTab;
                  return (
                    <button
                      key={tab.value}
                      onClick={() =>
                        onTabChange?.(tab.value)
                      }
                      className={cn(
                        "px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
                        isActive
                          ? "border-foreground text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground",
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

      {deadletterOpen && (
        <div
          ref={deadRef}
          className="
            fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96
            rounded-2xl border border-border bg-background
            shadow-xl p-4 z-50
            animate-in fade-in slide-in-from-bottom-2
            duration-200
          "
        >
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">
              Failed sync items
            </div>
            <button
              onClick={() => setDeadletterOpen(false)}
              className="text-sm text-muted-foreground hover:text-foreground transition"
            >
              Close
            </button>
          </div>

          {deadletter.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No failed items.
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-auto">
              {deadletter.map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg border border-border p-3 text-sm transition hover:bg-muted/30"
                >
                  <div className="font-medium">
                    {task.entity} · {task.action}
                  </div>
                  <div className="text-muted-foreground">
                    Attempts: {task.attempts}
                  </div>

                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() =>
                        restoreDeadletterTask(task.id)
                      }
                      className="flex-1 rounded-md border border-border px-2 py-1 hover:bg-muted transition"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() =>
                        discardDeadletterTask(task.id)
                      }
                      className="flex-1 rounded-md border border-border px-2 py-1 hover:bg-muted transition"
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

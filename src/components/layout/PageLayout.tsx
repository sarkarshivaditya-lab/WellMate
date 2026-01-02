import React from "react";
import { cn } from "@/lib/utils";
import {
  getSyncStatus,
  getSyncSummary,
  subscribeToSyncStatus,
  requestManualRetry,
  openDeadletterView,
} from "@/sync/syncStatus";

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

  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const badgeRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    return subscribeToSyncStatus(() => {
      forceRender();
    });
  }, []);

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
    }

    document.addEventListener("mousedown", onClickOutside);
    return () =>
      document.removeEventListener("mousedown", onClickOutside);
  }, [panelOpen]);

  const syncStatus = getSyncStatus();
  const { pendingCount, deadletterCount, hasErrors } =
    getSyncSummary();

  const showBadge =
    syncStatus !== "idle" || pendingCount > 0 || hasErrors;

  return (
    /* 🌈 FULL-WIDTH BACKGROUND LAYER */
    <div className="min-h-screen w-full bg-background relative">
      <div
        aria-hidden
        className="
          pointer-events-none
          fixed inset-0
          z-0
          bg-gradient-to-b
          from-header-gradient-start
          via-header-gradient-end/60
          to-background
        "
      />

      {/* 📐 CENTERED CONTENT CONTAINER */}
      <div
        className={cn(
          "relative z-10 w-full mx-auto pb-8",
          "px-4 sm:px-6",
          "sm:max-w-4xl",
          hasHeader ? "pt-16" : "pt-8",
        )}
      >
        {hasHeader && (
          <header className="mb-8 space-y-4 rounded-2xl bg-background border border-border/60 px-4 sm:px-6 py-5 relative">
            {/* 🔄 SYNC BADGE */}
            {showBadge && (
              <div className="absolute top-4 right-4">
                <div ref={badgeRef}>
                  <button
                    type="button"
                    onClick={() =>
                      setPanelOpen((v) => !v)
                    }
                    className={cn(
                      "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border transition",
                      "hover:shadow-sm",
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
                      {syncStatus === "error" &&
                        "Sync error"}
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

                {/* 🧾 SYNC DETAILS PANEL */}
                {panelOpen && (
                  <div
                    ref={panelRef}
                    className="
                      absolute right-0 mt-2 w-64 rounded-xl
                      border border-border bg-background
                      shadow-lg p-4 text-sm
                      z-50
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
                        type="button"
                        onClick={() => {
                          requestManualRetry();
                          setPanelOpen(false);
                        }}
                        className="
                          w-full rounded-lg border border-border
                          px-3 py-2 text-sm font-medium
                          hover:bg-muted transition
                        "
                      >
                        Retry now
                      </button>

                      {deadletterCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            openDeadletterView();
                            setPanelOpen(false);
                          }}
                          className="
                            w-full rounded-lg border border-border
                            px-3 py-2 text-sm font-medium
                            hover:bg-muted transition
                          "
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
                        "px-3 py-2 text-sm font-medium transition-colors",
                        "border-b-2 -mb-px",
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
    </div>
  );
}

export default PageLayout;

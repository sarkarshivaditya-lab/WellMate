import React from "react";
import { cn } from "@/lib/utils";

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

  return (
    /* 🌈 FULL-WIDTH BACKGROUND LAYER */
    <div
      className="
        min-h-screen
        w-full
        bg-background
        relative
      "
    >
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
          <header className="mb-8 space-y-4 rounded-2xl bg-background border border-border/60 px-4 sm:px-6 py-5">
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
                  const isActive = tab.value === activeTab;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => onTabChange?.(tab.value)}
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

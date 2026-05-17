import React from "react";

interface State {
  hasError: boolean;
  errorId: string;
}

/**
 * Top-level error boundary. Catches uncaught render errors and shows a calm
 * recovery UI instead of a blank screen. Raw error messages are logged to the
 * console but never shown to users.
 */
export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorId: "" };
  }

  static getDerivedStateFromError(): State {
    return {
      hasError: true,
      errorId: `ERR-${Date.now().toString(36).toUpperCase()}`,
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("[AppErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-5 px-8 text-center">
        <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          WellMate
        </p>

        <div className="space-y-2 max-w-xs">
          <h1 className="text-xl font-semibold text-foreground">
            Something unexpected happened
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your data is safe. A quick reload usually resolves this.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="mt-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold px-6 py-3 transition-opacity hover:opacity-90 active:scale-[0.97]"
        >
          Reload app
        </button>

        <p className="text-[10px] text-muted-foreground/40 mt-2">
          {this.state.errorId}
        </p>
      </div>
    );
  }
}

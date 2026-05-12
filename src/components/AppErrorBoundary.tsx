import React from "react";

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Top-level error boundary. Catches any uncaught render error (including
 * provider crashes that escape their own try/catch) and shows a recovery UI
 * instead of a blank/frozen screen.
 */
export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error("[AppErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          background: "hsl(165,10%,96%)",
          color: "hsl(170,20%,12%)",
          textAlign: "center",
          gap: "1rem",
        }}
      >
        <p
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            color: "hsl(166,10%,45%)",
          }}
        >
          WellMate
        </p>
        <h1 style={{ fontSize: "20px", fontWeight: 600 }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: "14px", color: "hsl(166,10%,45%)", maxWidth: "280px" }}>
          {this.state.message}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: "1rem",
            padding: "12px 28px",
            borderRadius: "14px",
            background: "hsl(166,44%,38%)",
            color: "#fff",
            fontWeight: 600,
            fontSize: "15px",
            border: "none",
            cursor: "pointer",
          }}
        >
          Reload app
        </button>
      </div>
    );
  }
}

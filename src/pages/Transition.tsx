import React from "react";
import { useNavigate } from "react-router-dom";

export default function TransitionGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigate = useNavigate();

  const [showTransition, setShowTransition] = React.useState<boolean>(() => {
    const onboarded = localStorage.getItem("onboarded") === "true";
    const transitionShown =
      localStorage.getItem("postOnboardingTransitionShown") === "true";

    return onboarded && !transitionShown;
  });

  if (showTransition) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-black via-neutral-950 to-black text-foreground px-6">
        <div className="relative max-w-sm rounded-xl border border-white/10 bg-black/70 backdrop-blur-xl card-glow px-6 py-7 text-center">
          <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-white/10" />

          <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
            Setup complete
          </p>

          <h1 className="text-2xl font-semibold tracking-tight mb-3">
            You’re all set <span aria-hidden>🎉</span>
          </h1>

          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            We've personalized your experience based on your inputs.
          </p>

          <button
            className="w-full rounded-lg bg-white text-black font-medium py-2.5 transition hover:bg-white/90 active:scale-[0.98]"
            onClick={() => {
              // ✅ mark one-time transition as completed
              localStorage.setItem(
                "postOnboardingTransitionShown",
                "true",
              );

              // ✅ hide transition immediately
              setShowTransition(false);

              // ✅ explicit navigation (NO ambiguity)
              navigate("/physical", { replace: true });
            }}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

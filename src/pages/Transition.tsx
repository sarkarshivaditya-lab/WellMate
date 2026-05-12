import React from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";

/* ---- tiny decorative sparkle (4-pointed star) ---- */
function Sparkle({ size = 16, opacity = 0.45 }: { size?: number; opacity?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2L13.5 10.5L22 12L13.5 13.5L12 22L10.5 13.5L2 12L10.5 10.5Z"
        fill="hsl(166,38%,48%)"
        fillOpacity={opacity}
      />
    </svg>
  );
}

/* ---- soft bokeh circle ---- */
function Blob({
  style,
  delay = "0s",
}: {
  style: React.CSSProperties;
  delay?: string;
}) {
  return (
    <div
      className="pointer-events-none absolute rounded-full animate-wm-glow"
      style={{ animationDelay: delay, ...style }}
    />
  );
}

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

  if (!showTransition) return <>{children}</>;

  const handleContinue = () => {
    localStorage.setItem("postOnboardingTransitionShown", "true");
    setShowTransition(false);
    navigate("/physical", { replace: true });
  };

  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, hsl(166,42%,90%) 0%, hsl(166,24%,94%) 45%, hsl(165,14%,97%) 100%)",
        paddingBottom: "calc(3.5rem + env(safe-area-inset-bottom) + 1.5rem)",
      }}
    >
      {/* ---- Bokeh background blobs ---- */}
      <Blob
        style={{
          top: "-90px",
          right: "-110px",
          width: "320px",
          height: "320px",
          background:
            "radial-gradient(circle, hsl(166,52%,78%) 0%, transparent 68%)",
        }}
      />
      <Blob
        delay="1.8s"
        style={{
          bottom: "80px",
          left: "-130px",
          width: "360px",
          height: "360px",
          background:
            "radial-gradient(circle, hsl(166,42%,82%) 0%, transparent 68%)",
        }}
      />
      <Blob
        delay="0.9s"
        style={{
          top: "38%",
          right: "-70px",
          width: "200px",
          height: "200px",
          background:
            "radial-gradient(circle, hsl(166,45%,84%) 0%, transparent 65%)",
        }}
      />

      {/* ---- Floating sparkles ---- */}
      <div
        className="pointer-events-none absolute animate-wm-float"
        style={{ top: "13%", left: "11%" }}
      >
        <Sparkle size={22} opacity={0.52} />
      </div>
      <div
        className="pointer-events-none absolute animate-wm-float-alt"
        style={{ top: "20%", right: "13%" }}
      >
        <Sparkle size={15} opacity={0.42} />
      </div>
      <div
        className="pointer-events-none absolute animate-wm-float"
        style={{ top: "47%", left: "7%", animationDelay: "2s" }}
      >
        <Sparkle size={11} opacity={0.35} />
      </div>
      <div
        className="pointer-events-none absolute animate-wm-float-alt"
        style={{ bottom: "34%", right: "9%", animationDelay: "0.5s" }}
      >
        <Sparkle size={18} opacity={0.42} />
      </div>
      <div
        className="pointer-events-none absolute animate-wm-float"
        style={{ bottom: "24%", left: "14%", animationDelay: "3s" }}
      >
        <Sparkle size={10} opacity={0.3} />
      </div>

      {/* ---- Floating dots ---- */}
      <div
        className="pointer-events-none absolute rounded-full animate-wm-float-alt"
        style={{
          top: "33%",
          right: "17%",
          width: "8px",
          height: "8px",
          background: "hsl(166,38%,56%)",
          opacity: 0.48,
          animationDelay: "1.2s",
        }}
      />
      <div
        className="pointer-events-none absolute rounded-full animate-wm-float"
        style={{
          bottom: "42%",
          left: "17%",
          width: "6px",
          height: "6px",
          background: "hsl(166,38%,52%)",
          opacity: 0.4,
          animationDelay: "0.3s",
        }}
      />

      {/* ---- Main content ---- */}
      <div className="relative z-10 flex flex-col items-center px-8 w-full max-w-sm text-center">

        {/* Success badge */}
        <div className="relative mb-8 animate-wm-icon-in" style={{ isolation: "isolate" }}>
          {/* Outer glow */}
          <div
            className="absolute rounded-full"
            style={{
              inset: "-30px",
              background:
                "radial-gradient(circle, hsl(166,46%,70%) 0%, transparent 65%)",
              opacity: 0.38,
              pointerEvents: "none",
            }}
          />
          {/* Mid glow */}
          <div
            className="absolute rounded-full"
            style={{
              inset: "-16px",
              background:
                "radial-gradient(circle, hsl(166,42%,64%) 0%, transparent 60%)",
              opacity: 0.28,
              pointerEvents: "none",
            }}
          />
          {/* Circle */}
          <div
            className="relative flex items-center justify-center rounded-full"
            style={{
              width: "104px",
              height: "104px",
              background:
                "linear-gradient(148deg, hsl(166,46%,43%) 0%, hsl(166,42%,30%) 100%)",
              boxShadow:
                "0 8px 32px hsl(166 40% 34% / 0.32), 0 2px 8px hsl(166 40% 34% / 0.18)",
            }}
          >
            <Check
              className="text-white"
              strokeWidth={2.5}
              style={{ width: "46px", height: "46px" }}
            />
          </div>
        </div>

        {/* Eyebrow label */}
        <p
          className="animate-wm-fade-1 text-[11px] uppercase tracking-[0.18em] font-semibold mb-3"
          style={{ color: "hsl(166,38%,37%)" }}
        >
          Setup Complete
        </p>

        {/* Heading */}
        <h1
          className="animate-wm-fade-2 font-semibold tracking-tight leading-snug mb-3"
          style={{ fontSize: "clamp(26px,7vw,32px)", color: "hsl(170,20%,12%)" }}
        >
          You're all set!{" "}
          <span aria-hidden role="img">
            🎉
          </span>
        </h1>

        {/* Subtitle */}
        <p
          className="animate-wm-fade-3 text-[15px] leading-relaxed mb-10"
          style={{ color: "hsl(166,10%,44%)", maxWidth: "272px" }}
        >
          We've personalized your experience based on your inputs.
        </p>

        {/* CTA */}
        <button
          className="animate-wm-fade-4 w-full rounded-2xl font-semibold text-white text-[17px] py-[15px] transition-premium active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            background:
              "linear-gradient(138deg, hsl(166,44%,41%) 0%, hsl(166,40%,30%) 100%)",
            boxShadow:
              "0 4px 20px hsl(166 40% 34% / 0.3), 0 1px 4px hsl(166 40% 34% / 0.18)",
          }}
          onClick={handleContinue}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// Welcome — cinematic pre-onboarding experience.
//
// Phase machine:
//   blooming  (0–3.2s)  lotus scales + petals fade in, text fades in at 2.2s
//   idle      (3.2s+)   lotus sways gently, tap hint appears
//   exiting   (on tap)  petals scatter rightward, screen fades, navigate /onboarding
//
// Shown once per install (localStorage: wellmate_welcome_v1).
// Respects prefers-reduced-motion: all animations skip, simple crossfade.

import React from "react";
import { useNavigate } from "react-router-dom";
import { motion, useAnimation, useReducedMotion } from "motion/react";

export const WELCOME_SEEN_KEY = "wellmate_welcome_v1";

// ── Lotus geometry ────────────────────────────────────────────────────────────
//
// All paths start at origin (0,0) pointing upward.
// In the SVG each petal group applies:
//   transform="translate(100 100) rotate(<angle>)"
// placing the petal base at the lotus centre (100,100) and rotating it.
// The CSS transforms from Framer Motion (x, y) layer on top for scatter.

const OUTER_PETAL = "M 0 0 C -22 -16, -24 -44, 0 -62 C 24 -44, 22 -16, 0 0 Z";
const INNER_PETAL = "M 0 0 C -14 -11, -15 -28, 0 -38 C 15 -28, 14 -11, 0 0 Z";
const LEAF_L      = "M 0 0 C -22 6, -52 12, -70 32 C -44 18, -18 10, 0 0 Z";
const LEAF_R      = "M 0 0 C 22 6, 52 12, 70 32 C 44 18, 18 10, 0 0 Z";

// Stamen dots: 5 points at r=17 from centre, starting at the top
const STAMEN = Array.from({ length: 5 }, (_, i) => {
  const rad = ((i * 72 - 90) * Math.PI) / 180;
  return { cx: 100 + 17 * Math.cos(rad), cy: 100 + 17 * Math.sin(rad) };
});

type PetalDef = {
  angle: number;  // SVG rotation around (100,100)
  sx: number;     // scatter CSS translateX — positive = rightward
  sy: number;     // scatter CSS translateY
  dur: number;    // scatter animation duration (s)
  del: number;    // scatter stagger delay (s)
};

// 8 outer petals — every 45°
const OUTER: readonly PetalDef[] = [
  { angle:   0, sx: 160, sy: -120, dur: 0.85, del: 0.00 },
  { angle:  45, sx: 220, sy:  -72, dur: 0.78, del: 0.06 },
  { angle:  90, sx: 265, sy:   10, dur: 0.88, del: 0.03 },
  { angle: 135, sx: 245, sy:   92, dur: 0.80, del: 0.09 },
  { angle: 180, sx: 205, sy:  130, dur: 0.82, del: 0.05 },
  { angle: 225, sx: 225, sy:   82, dur: 0.76, del: 0.12 },
  { angle: 270, sx: 245, sy:  -26, dur: 0.90, del: 0.02 },
  { angle: 315, sx: 182, sy: -102, dur: 0.83, del: 0.07 },
] as const;

// 5 inner petals — every 72°, offset 18° from outer ring
const INNER: readonly PetalDef[] = [
  { angle:  18, sx: 135, sy:  -70, dur: 0.72, del: 0.04 },
  { angle:  90, sx: 175, sy:   44, dur: 0.68, del: 0.08 },
  { angle: 162, sx: 192, sy:   76, dur: 0.75, del: 0.06 },
  { angle: 234, sx: 158, sy:   38, dur: 0.70, del: 0.10 },
  { angle: 306, sx: 142, sy:  -56, dur: 0.65, del: 0.03 },
] as const;

// ── Petal component ──────────────────────────────────────────────────────────

type PetalProps = {
  def: PetalDef;
  pathD: string;
  strokeWidth: number;
  isExiting: boolean;
  bloomDelay: number;
  reduceMotion: boolean;
};

function Petal({ def, pathD, strokeWidth, isExiting, bloomDelay, reduceMotion }: PetalProps) {
  return (
    <motion.g
      initial={{ opacity: reduceMotion ? 1 : 0 }}
      animate={
        isExiting
          ? { x: def.sx, y: def.sy, opacity: 0 }
          : { x: 0, y: 0, opacity: 1 }
      }
      transition={
        isExiting
          ? { duration: def.dur, delay: def.del, ease: [0.25, 0.46, 0.45, 0.94] }
          : {
              duration: reduceMotion ? 0 : 0.9,
              delay: reduceMotion ? 0 : bloomDelay,
              ease: [0.16, 1, 0.3, 1],
            }
      }
    >
      <path
        d={pathD}
        // SVG attribute transform: places + rotates the petal around the lotus centre.
        // This is a static SVG transform; Framer Motion adds CSS transforms on top.
        transform={`translate(100 100) rotate(${def.angle})`}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </motion.g>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WelcomePage() {
  const navigate = useNavigate();
  const reduceMotion = (useReducedMotion() ?? false) as boolean;

  type Phase = "blooming" | "idle" | "exiting";
  const [phase, setPhase] = React.useState<Phase>("blooming");
  const [canTap, setCanTap] = React.useState(false);

  // Controls for the idle sway — kept separate from bloom/exit so they
  // don't conflict with the SVG's own animate prop.
  const swayControls = useAnimation();

  // Bloom → idle transition
  React.useEffect(() => {
    const tapDelay = reduceMotion ? 200 : 900;
    const idleDelay = reduceMotion ? 0 : 3200;
    const t1 = setTimeout(() => setCanTap(true), tapDelay);
    const t2 = setTimeout(() => setPhase("idle"), idleDelay);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [reduceMotion]);

  // Idle sway
  React.useEffect(() => {
    if (phase === "idle" && !reduceMotion) {
      void swayControls.start({
        y: [0, -7, 0, 5, 0],
        rotate: [0, -0.8, 0, 0.8, 0],
        transition: { duration: 5.5, repeat: Infinity, ease: "easeInOut" },
      });
    }
    if (phase === "exiting") {
      swayControls.stop();
    }
  }, [phase, reduceMotion, swayControls]);

  function handleTap() {
    if (!canTap || phase === "exiting") return;
    setPhase("exiting");
    localStorage.setItem(WELCOME_SEEN_KEY, "1");
    // Navigate after scatter + fade complete. Reduced motion skips to near-instant.
    setTimeout(
      () => navigate("/onboarding", { replace: true }),
      reduceMotion ? 300 : 1100,
    );
  }

  const isExiting = phase === "exiting";

  return (
    <motion.div
      className="fixed inset-0 bg-background flex items-center justify-center overflow-hidden cursor-pointer select-none touch-none"
      role="main"
      aria-label="Welcome to WellMate — tap anywhere to begin"
      onClick={handleTap}
      // Overall screen fade — delayed to let scatter play first
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{
        duration: reduceMotion ? 0.25 : 0.55,
        delay: isExiting ? (reduceMotion ? 0 : 0.58) : 0,
        ease: "easeOut",
      }}
    >
      {/* ─── Lotus (background layer) ─────────────────────────────── */}
      {/*
        Three-layer transform separation:
          1. swayControls div  — idle y/rotate sway (stops on exit)
          2. motion.svg        — bloom scale + opacity (0 → 0.18)
          3. Individual petals — staggered fade-in + scatter on exit
      */}
      <motion.div
        className="absolute pointer-events-none"
        style={{ width: "min(75vw, 75vh)", height: "min(75vw, 75vh)" }}
        animate={swayControls}
      >
        <motion.svg
          viewBox="0 0 200 200"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full text-foreground"
          aria-hidden="true"
          initial={{
            opacity: reduceMotion ? 0.18 : 0,
            scale: reduceMotion ? 1 : 0.82,
          }}
          animate={{
            opacity: isExiting ? 0 : 0.18,
            scale: 1,
          }}
          transition={{
            opacity: {
              duration: reduceMotion ? 0 : 2.2,
              ease: [0.25, 0.46, 0.45, 0.94],
            },
            scale: {
              duration: reduceMotion ? 0 : 3.0,
              ease: [0.25, 0.46, 0.45, 0.94],
            },
          }}
        >
          {/* Base leaves — scatter separately on exit */}
          <motion.path
            d={LEAF_L}
            transform="translate(100 100)"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ opacity: reduceMotion ? 1 : 0 }}
            animate={isExiting ? { x: 130, y: 45, opacity: 0 } : { x: 0, y: 0, opacity: 1 }}
            transition={
              isExiting
                ? { duration: 0.68, delay: 0.08, ease: "easeOut" }
                : { duration: reduceMotion ? 0 : 0.9, delay: reduceMotion ? 0 : 0.55, ease: [0.16, 1, 0.3, 1] }
            }
          />
          <motion.path
            d={LEAF_R}
            transform="translate(100 100)"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ opacity: reduceMotion ? 1 : 0 }}
            animate={isExiting ? { x: 170, y: 52, opacity: 0 } : { x: 0, y: 0, opacity: 1 }}
            transition={
              isExiting
                ? { duration: 0.62, delay: 0.04, ease: "easeOut" }
                : { duration: reduceMotion ? 0 : 0.9, delay: reduceMotion ? 0 : 0.7, ease: [0.16, 1, 0.3, 1] }
            }
          />

          {/* Outer petals */}
          {OUTER.map((def, i) => (
            <Petal
              key={`o${i}`}
              def={def}
              pathD={OUTER_PETAL}
              strokeWidth={1.5}
              isExiting={isExiting}
              bloomDelay={i * 0.10}
              reduceMotion={reduceMotion}
            />
          ))}

          {/* Inner petals */}
          {INNER.map((def, i) => (
            <Petal
              key={`n${i}`}
              def={def}
              pathD={INNER_PETAL}
              strokeWidth={1.2}
              isExiting={isExiting}
              bloomDelay={0.45 + i * 0.08}
              reduceMotion={reduceMotion}
            />
          ))}

          {/* Centre circle */}
          <motion.circle
            cx="100"
            cy="100"
            r="10"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.2}
            initial={{ opacity: reduceMotion ? 1 : 0 }}
            animate={isExiting ? { x: 195, y: -28, opacity: 0 } : { x: 0, y: 0, opacity: 1 }}
            transition={
              isExiting
                ? { duration: 0.55, delay: 0.02, ease: "easeOut" }
                : { duration: reduceMotion ? 0 : 0.8, delay: reduceMotion ? 0 : 1.05, ease: [0.16, 1, 0.3, 1] }
            }
          />

          {/* Stamen dots */}
          {STAMEN.map((dot, i) => (
            <motion.circle
              key={`s${i}`}
              cx={dot.cx}
              cy={dot.cy}
              r={1.6}
              fill="currentColor"
              initial={{ opacity: 0 }}
              animate={{ opacity: isExiting ? 0 : 0.55 }}
              transition={{
                duration: reduceMotion ? 0 : 0.65,
                delay: reduceMotion ? 0 : 1.35 + i * 0.06,
                ease: "easeOut",
              }}
            />
          ))}
        </motion.svg>
      </motion.div>

      {/* ─── Welcome text ────────────────────────────────────────── */}
      <motion.div
        className="relative z-10 text-center px-8 pointer-events-none"
        initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
        animate={{ opacity: isExiting ? 0 : 1, y: 0 }}
        transition={{
          opacity: {
            duration: reduceMotion ? 0 : 0.95,
            delay: reduceMotion ? 0 : 2.2,
            ease: "easeOut",
          },
          y: {
            duration: reduceMotion ? 0 : 1.05,
            delay: reduceMotion ? 0 : 2.2,
            ease: [0.16, 1, 0.3, 1],
          },
        }}
      >
        <h1 className="text-[1.4rem] font-semibold tracking-[-0.01em] leading-snug text-foreground">
          Welcome to WellMate
        </h1>
        <p className="mt-2 text-sm font-normal leading-relaxed text-muted-foreground">
          Your all-in-one wellbeing companion
        </p>
      </motion.div>

      {/* ─── Tap hint ────────────────────────────────────────────── */}
      <motion.p
        className="absolute bottom-16 inset-x-0 text-center text-[11px] font-medium tracking-[0.14em] uppercase text-muted-foreground/45 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === "idle" && !isExiting ? 1 : 0 }}
        transition={{
          duration: 0.85,
          delay: phase === "idle" ? 0.75 : 0,
          ease: "easeOut",
        }}
      >
        Tap anywhere to begin
      </motion.p>
    </motion.div>
  );
}

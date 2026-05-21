import type { SVGProps } from "react";

/**
 * LotusIcon — WellMate brand mark for the AI assistant FAB.
 *
 * Geometry: 6 outer petals at 60° intervals + 3 inner petals at 30° offset,
 * derived from the same cubic-bezier petal language as the Welcome screen lotus.
 * Viewbox 24×24, stroke-only, scales cleanly from 16px to 48px.
 */
export function LotusIcon(props: SVGProps<SVGSVGElement>) {
  const outerPetal = "M 0 0.5 C -3.2 -1.8, -3.5 -5.9, 0 -8.5 C 3.5 -5.9, 3.2 -1.8, 0 0.5";
  const innerPetal = "M 0 0.3 C -2 -1.3, -2.2 -3.8, 0 -5.2 C 2.2 -3.8, 2 -1.3, 0 0.3";

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <g transform="translate(12 12)">
        {/* Outer ring — 6 petals at 60° */}
        <path d={outerPetal} />
        <path transform="rotate(60)"  d={outerPetal} />
        <path transform="rotate(120)" d={outerPetal} />
        <path transform="rotate(180)" d={outerPetal} />
        <path transform="rotate(240)" d={outerPetal} />
        <path transform="rotate(300)" d={outerPetal} />

        {/* Inner ring — 3 petals at 30° offset, smaller */}
        <path transform="rotate(30)"  d={innerPetal} />
        <path transform="rotate(150)" d={innerPetal} />
        <path transform="rotate(270)" d={innerPetal} />

        {/* Center stamen */}
        <circle r="1.2" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

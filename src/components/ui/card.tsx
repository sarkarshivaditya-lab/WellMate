import * as React from "react";
import { cn } from "@/lib/utils.ts";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      role="button"
      tabIndex={0}
      className={cn(
        /* Surface */
        "bg-card text-card-foreground rounded-2xl cursor-pointer",

        /* Separation — hairline ring, no hard border */
        "ring-1 ring-black/[0.05]",

        /* Elevation at rest */
        "card-shadow-rest",

        /* Motion */
        "transition-premium will-change-transform",

        /* Hover */
        "hover:-translate-y-0.5 hover:card-shadow-hover",

        /* Focus (keyboard navigation) */
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:-translate-y-0.5",

        /* Pressed */
        "active:translate-y-0 active:card-shadow-pressed",

        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("px-6 pt-6 pb-2 flex flex-col gap-1", className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-base font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6 pb-6", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent };

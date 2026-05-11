import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  [
    // Core — rounded-xl for modern mobile feel
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium",
    "outline-none cursor-pointer select-none",
    "disabled:pointer-events-none disabled:opacity-50",

    // Motion — calm iOS-style spring
    "transition-premium will-change-transform",
    "active:scale-[0.97]",

    // Focus
    "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",

    // Icons
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-primary-foreground",
          "shadow-[0_1px_4px_rgba(20,60,50,0.15),_0_2px_8px_rgba(20,60,50,0.11)]",
          "hover:shadow-[0_2px_8px_rgba(20,60,50,0.20),_0_4px_14px_rgba(20,60,50,0.14)]",
          "hover:brightness-[1.04]",
        ].join(" "),

        destructive: [
          "bg-destructive text-white",
          "shadow-[0_2px_8px_rgba(220,53,69,0.22)]",
          "hover:shadow-[0_4px_14px_rgba(220,53,69,0.28)]",
          "hover:brightness-105",
          "focus-visible:ring-destructive/40",
        ].join(" "),

        outline: [
          "border border-border bg-card text-foreground",
          "hover:bg-accent hover:text-accent-foreground",
        ].join(" "),

        secondary: [
          "bg-secondary text-secondary-foreground",
          "border border-border/60",
          "hover:bg-muted",
        ].join(" "),

        ghost: [
          "bg-transparent text-foreground",
          "hover:bg-accent hover:text-accent-foreground",
        ].join(" "),

        link: "text-primary underline-offset-4 hover:underline",
      },

      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm:      "h-8  rounded-lg gap-1.5 px-3 has-[>svg]:px-2.5",
        lg:      "h-11 rounded-xl px-6 has-[>svg]:px-4",
        icon:    "size-10",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

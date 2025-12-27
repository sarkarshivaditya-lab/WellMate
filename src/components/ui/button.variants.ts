import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  [
    // Core
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium",
    "outline-none cursor-pointer select-none",
    "disabled:pointer-events-none disabled:opacity-50",

    // Motion (Stage 5)
    "transition-premium will-change-transform",
    "active:scale-[0.98]",

    // Focus
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",

    // Icons
    "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-primary-foreground",
          "shadow-[0_6px_18px_rgba(0,0,0,0.35)]",
          "hover:shadow-[0_10px_28px_rgba(0,0,0,0.45)]",
          "hover:brightness-105",
        ].join(" "),
        destructive: [
          "bg-destructive text-white",
          "shadow-[0_6px_18px_rgba(0,0,0,0.35)]",
          "hover:shadow-[0_10px_28px_rgba(0,0,0,0.45)]",
          "hover:brightness-105",
          "focus-visible:ring-destructive/30",
        ].join(" "),
        outline: [
          "border bg-background text-foreground",
          "shadow-none",
          "hover:bg-accent hover:text-accent-foreground",
        ].join(" "),
        secondary: [
          "bg-secondary text-secondary-foreground",
          "shadow-[0_4px_14px_rgba(0,0,0,0.25)]",
          "hover:shadow-[0_8px_22px_rgba(0,0,0,0.35)]",
        ].join(" "),
        ghost: [
          "bg-transparent text-foreground",
          "hover:bg-accent hover:text-accent-foreground",
        ].join(" "),
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

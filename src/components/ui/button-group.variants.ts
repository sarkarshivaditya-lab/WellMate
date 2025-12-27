import { cva } from "class-variance-authority";

export const buttonGroupVariants = cva(
  [
    "flex w-fit items-stretch",
    "rounded-md",
    "transition-premium",

    // Keep group cohesion
    "[&>*]:relative",
    "[&>*]:transition-premium",
    "[&>*]:active:scale-[0.98]",
    "[&>*]:focus-visible:z-10",

    // Subtle shared surface
    "bg-muted/40",
  ].join(" "),
  {
    variants: {
      orientation: {
        horizontal:
          "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none",
        vertical:
          "flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
    },
  },
);

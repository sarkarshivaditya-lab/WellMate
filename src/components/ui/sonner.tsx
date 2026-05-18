import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  // Bottom nav is h-14 (3.5rem/56px) + env(safe-area-inset-bottom).
  // Both offset (>600px) and mobileOffset (≤600px) must be set so the
  // toast floats above the nav at every viewport width.
  const navClearance = "calc(3.5rem + env(safe-area-inset-bottom) + 0.5rem)";

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      offset={navClearance}
      mobileOffset={navClearance}
      style={
        {
          // CSS vars are bare HSL channels (e.g. "168 14% 12%"), so they
          // must be wrapped in hsl() before Sonner consumes them as colors.
          // Without the wrapper, `background: var(--popover)` resolves to
          // an invalid value and the toast background becomes transparent.
          "--normal-bg": "hsl(var(--popover))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--normal-border": "hsl(var(--border))",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };

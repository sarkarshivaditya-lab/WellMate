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
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };

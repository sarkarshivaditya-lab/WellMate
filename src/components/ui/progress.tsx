import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils.ts";

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const safeValue = Math.max(0, Math.min(100, value ?? 0));
  const offset = safeValue === 0 ? 99.5 : 100 - safeValue;

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full bg-primary transition-premium",
        )}
        style={{
          transform: `translateX(-${offset}%)`,
        }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };

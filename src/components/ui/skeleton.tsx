import { cn } from "@/lib/utils.ts";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-md bg-muted-foreground/10 animate-pulse",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };


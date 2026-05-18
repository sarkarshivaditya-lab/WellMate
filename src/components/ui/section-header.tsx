// src/components/ui/section-header.tsx
// Canonical section label — ALL-CAPS category separator above content groups.
// Standardizes: text-[11px] font-semibold uppercase tracking-widest text-muted-foreground

import React from "react";
import { cn } from "@/lib/utils";

type Props = React.ComponentProps<"div"> & {
  label: string;
  right?: React.ReactNode;
};

export function SectionHeader({ label, right, className, ...props }: Props) {
  return (
    <div
      className={cn("flex items-center justify-between px-0.5", className)}
      {...props}
    >
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </h2>
      {right && (
        <div className="text-[11px] text-muted-foreground">{right}</div>
      )}
    </div>
  );
}

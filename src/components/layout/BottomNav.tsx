import React from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils.ts";

function NavItem({
  to,
  label,
  primary = false,
}: {
  to: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <NavLink
      to={to}
      aria-current={({ isActive }) => (isActive ? "page" : undefined)}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center justify-center px-3 py-1 text-xs font-medium transition-colors",
          "text-muted-foreground",
          isActive && "text-foreground",
          primary && !isActive && "text-foreground/80",
        )
      }
    >
      <span
        className={cn(
          "mt-1 rounded-sm px-1.5 py-0.5 leading-none",
          "transition-colors",
          "group-hover:bg-muted/50",
        )}
      >
        {label}
      </span>

      {/* active affordance */}
      <span
        className={cn(
          "absolute inset-x-2 bottom-1 h-6 rounded-md bg-muted/60",
          "opacity-0",
          "pointer-events-none",
          "[aria-current=page_&]:opacity-100",
        )}
      />
    </NavLink>
  );
}

export default function BottomNav() {
  return (
    <nav
      className="
        border-t
        bg-background
        h-14
        pb-[env(safe-area-inset-bottom)]
      "
    >
      <div className="h-full flex items-center justify-around relative">
        <NavItem to="/overview" label="Home" />
        <NavItem to="/physical" label="Physical" primary />
        <NavItem to="/journal" label="Mental" />
        <NavItem to="/habits" label="Insights" />
        <NavItem to="/tools" label="More" />
      </div>
    </nav>
  );
}

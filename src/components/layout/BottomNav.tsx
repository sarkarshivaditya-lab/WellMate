import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils.ts";
import {
  Brain,
  Home,
  LayoutGrid,
  Repeat,
  User,
} from "lucide-react";

function NavItem({
  to,
  label,
  icon,
  activePaths = [],
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  activePaths?: string[];
}) {
  const { pathname } = useLocation();

  // Derive active state from location directly — avoids dual render-prop complexity
  const isRouteActive =
    pathname === to || pathname.startsWith(to + "/");
  const isParentActive = activePaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  const active = isRouteActive || isParentActive;

  return (
    <NavLink
      to={to}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        // Layout — flex-1 so all items share width equally
        "relative flex flex-col items-center justify-center gap-0.5",
        "flex-1 py-1.5 px-1",
        // Touch target — 44px minimum (iOS HIG)
        "min-h-[44px]",
        // Shape + motion
        "rounded-2xl transition-colors duration-150",
        active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {/* Active pill — sits behind icon and label */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-1 top-1 bottom-1 rounded-xl",
          "bg-primary/10",
          "transition-opacity duration-150",
          active ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Icon */}
      <span className="relative flex items-center justify-center h-5 w-5">
        {icon}
      </span>

      {/* Label — always visible; primary tint when active */}
      <span className="relative text-[10px] font-medium leading-none tracking-wide">
        {label}
      </span>
    </NavLink>
  );
}

export default function BottomNav() {
  return (
    <nav
      className={cn(
        // Fixed at bottom — content scrolls behind glass
        "fixed bottom-0 inset-x-0 z-40",
        // Glass surface
        "bg-background/85 backdrop-blur-xl",
        "border-t border-border/30",
        // Height + safe-area (existing 3.5rem = 56px contract preserved)
        "h-14 pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <div className="h-full flex items-center justify-around px-2">
        <NavItem
          to="/overview"
          label="Overview"
          activePaths={["/tools"]}
          icon={<LayoutGrid className="h-5 w-5" />}
        />
        <NavItem
          to="/physical"
          label="Home"
          icon={<Home className="h-5 w-5" />}
        />
        <NavItem
          to="/mental"
          label="Mental"
          activePaths={["/journal"]}
          icon={<Brain className="h-5 w-5" />}
        />
        <NavItem
          to="/habits"
          label="Insights"
          icon={<Repeat className="h-5 w-5" />}
        />
        <NavItem
          to="/profile"
          label="Profile"
          icon={<User className="h-5 w-5" />}
        />
      </div>
    </nav>
  );
}

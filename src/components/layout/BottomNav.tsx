import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils.ts";
import {
  Brain,
  HeartHandshake,
  Home,
  LayoutGrid,
  Repeat,
  User,
} from "lucide-react";

function NavItem({
  to,
  label,
  icon,
  primary = false,
  activePaths = [],
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  primary?: boolean;
  activePaths?: string[];
}) {
  const { pathname } = useLocation();
  const isParentActive = activePaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  return (
    <NavLink
      to={to}
      aria-label={label}
      className={({ isActive }) => {
        const active = isActive || isParentActive;
        return cn(
          "flex flex-col items-center justify-center px-3 py-1 text-xs font-medium transition-colors",
          "text-muted-foreground",
          active && "text-foreground",
          primary && !active && "text-foreground/80",
        );
      }}
    >
      <span className="h-5 w-5 flex items-center justify-center">
        {icon}
      </span>

      {/* active affordance */}
      <span
        className={cn(
          "absolute inset-x-2 bottom-1 h-6 rounded-md bg-muted/60",
          "opacity-0",
          "pointer-events-none",
          isParentActive && "opacity-100",
          "[[aria-current=page]_&]:opacity-100",
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
        <NavItem
          to="/overview"
          label="Overview"
          activePaths={["/tools"]}
          icon={<LayoutGrid className="h-5 w-5" />}
        />
        <NavItem
          to="/physical"
          label="Home"
          primary
          icon={<Home className="h-5 w-5" />}
        />
        <NavItem
          to="/journal"
          label="Mental"
          activePaths={["/mental"]}
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

import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils.ts";
import {
  Brain,
  Home,
  LayoutGrid,
  MessageCircle,
  Repeat,
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
        "relative flex flex-col items-center justify-center gap-0.5",
        "flex-1 py-1.5 px-1 min-h-[44px] rounded-2xl transition-premium",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-1 top-1 bottom-1 rounded-xl",
          "transition-premium",
          active ? "glass-brand opacity-100" : "opacity-0",
        )}
      />
      <span className="relative flex items-center justify-center h-5 w-5">
        {icon}
      </span>
      <span className="relative text-[10px] font-medium leading-none tracking-wide">
        {label}
      </span>
    </NavLink>
  );
}

export default function BottomNav() {
  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        "fixed bottom-0 inset-x-0 z-40",
        "glass-primary border-0 border-t rounded-none",
        "h-14 pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <div className="h-full flex items-center justify-around px-2">
        <NavItem to="/overview" label="Overview" activePaths={["/tools"]} icon={<LayoutGrid className="h-5 w-5" />} />
        <NavItem to="/physical" label="Physical" icon={<Home className="h-5 w-5" />} />
        <NavItem to="/mental" label="Mental" activePaths={["/journal"]} icon={<Brain className="h-5 w-5" />} />
        <NavItem to="/habits" label="Habits" icon={<Repeat className="h-5 w-5" />} />
        <NavItem to="/chat" label="Support" icon={<MessageCircle className="h-5 w-5" />} />
      </div>
    </nav>
  );
}

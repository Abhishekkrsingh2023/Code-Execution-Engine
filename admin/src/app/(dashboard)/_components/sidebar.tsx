"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Code2,
  Users,
  FileText,
  BarChart3,
  Terminal,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/user";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Overview",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Problems",
    href: "/problems",
    icon: Code2,
  },
  {
    label: "Contests",
    href: "/contests",
    icon: Trophy,
  },
  {
    label: "User Directory",
    href: "/users",
    icon: Users,
    adminOnly: true,
  },
  {
    label: "Audit Logs",
    href: "/audit-logs",
    icon: FileText,
    adminOnly: true,
  },
  {
    label: "System Analytics",
    href: "/analytics",
    icon: BarChart3,
    adminOnly: true,
  },
];

interface SidebarProps {
  userRole?: UserRole;
}

export function Sidebar({ userRole = "moderator" }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = userRole === "admin";

  const visibleItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-zinc-800 bg-zinc-950">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2.5 border-b border-zinc-800 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-zinc-900 border border-zinc-700 text-zinc-100">
          <Terminal className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-100">
            code0
          </span>
          <span className="text-[10px] text-zinc-500 font-mono">Console v1.0</span>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 space-y-1 p-2 text-xs">
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Navigation
        </div>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors select-none",
                isActive
                  ? "bg-zinc-800 text-zinc-50 shadow-xs"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-zinc-50" : "text-zinc-400")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Role Indicator Footer */}
      <div className="border-t border-zinc-800 p-3">
        <div className="rounded border border-zinc-800/80 bg-zinc-900/40 p-2.5">
          <div className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500">
            Active Role
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs font-semibold capitalize text-zinc-200">
              {userRole}
            </span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </div>
        </div>
      </div>
    </aside>
  );
}


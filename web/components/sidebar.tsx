"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Link2,
  ArrowLeftRight,
  FileText,
  Settings,
  BarChart3,
  Coins,
  FileCode2,
  Zap,
  Code2,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tour: "dashboard" },
  { href: "/dashboard/payment-links", label: "Payment Links", icon: Link2, tour: "payment-links" },
  { href: "/dashboard/transactions", label: "Transactions", icon: ArrowLeftRight, tour: "transactions" },
  { href: "/dashboard/invoices", label: "Invoices", icon: FileText, tour: "invoices" },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3, tour: "analytics" },
  { href: "/dashboard/tokens", label: "CashTokens", icon: Coins, tour: "tokens" },
  { href: "/dashboard/contracts", label: "Contracts", icon: FileCode2, tour: "contracts" },
  { href: "/docs", label: "Developers", icon: Code2, tour: "developers" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, tour: "settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r bg-sidebar">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-bold text-sidebar-foreground">BCH Pay</span>
      </div>

      <nav className="flex flex-col gap-1 p-4">
        {navItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={item.tour}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 border-t p-4">
        <div className="flex items-center gap-3 rounded-lg bg-primary/5 px-3 py-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">Chipnet</p>
            <p className="text-xs text-muted-foreground">Connected</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

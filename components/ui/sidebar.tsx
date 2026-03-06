"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/(auth)/actions";
import {
  LayoutDashboard,
  Briefcase,
  Lock,
  Vault,
  Scale,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Portfolio/Assets", icon: Briefcase },
  { href: "/airlock", label: "Airlock", icon: Lock },
  { href: "/vault", label: "Vault", icon: Vault },
  { href: "/governance", label: "Governance", icon: Scale },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 hidden md:flex flex-col border-r border-border bg-white">
      <nav className="flex-1 flex flex-col gap-1 p-4">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === href
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-border">
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Logout"
          >
            Logout
          </button>
        </form>
      </div>
    </aside>
  );
}

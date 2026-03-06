"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction, type ActionResult } from "@/app/(auth)/actions";
import {
  LayoutDashboard,
  LineChart,
  FileInput,
  CalendarCheck,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const modelingItems = [
  { href: "/canvas", label: "Projection Canvas", icon: LayoutDashboard },
  { href: "/dashboard", label: "Runway Dashboard", icon: LineChart },
] as const;

const actualsItems = [
  { href: "/import", label: "Import Bank CSV", icon: FileInput },
  { href: "/actuals", label: "Month Close & History", icon: CalendarCheck },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const [state, formAction] = useActionState(logoutAction, null as ActionResult | null);

  useEffect(() => {
    if (state?.redirectTo) {
      window.location.href = state.redirectTo;
    }
  }, [state?.redirectTo]);

  const navLinkClass = (href: string) =>
    cn(
      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
      pathname === href
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    );

  return (
    <aside className="w-64 hidden md:flex flex-col border-r border-border bg-white">
      <nav className="flex-1 flex flex-col gap-1 p-4">
        <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          MODELING
        </p>
        {modelingItems.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={navLinkClass(href)}>
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        ))}
        <p className="mt-4 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          ACTUALS
        </p>
        {actualsItems.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={navLinkClass(href)}>
            <Icon className="size-4 shrink-0" />
            {label}
          </Link>
        ))}
        <div className="mt-4 pt-2 border-t border-border">
          <Link
            href="/settings"
            className={navLinkClass("/settings")}
          >
            <Settings className="size-4 shrink-0" />
            Settings
          </Link>
        </div>
      </nav>
      <div className="p-4 border-t border-border">
        <form action={formAction}>
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

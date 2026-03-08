"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Start" },
  { href: "/capture", label: "Erfassen" },
  { href: "/collection", label: "Sammlung" },
  { href: "/ersttagsbriefe", label: "Ersttagsbriefe" },
  { href: "/banknoten", label: "Banknoten" },
  { href: "/settings", label: "Einstellungen" },
];

export function AppNav() {
  const pathname = usePathname();
  const [pendingScanCount, setPendingScanCount] = useState(0);

  // Poll for pending scans
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/scanner/pending");
        const data = await res.json();
        setPendingScanCount(data.count);
      } catch {
        setPendingScanCount(0);
      }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [pathname, pendingScanCount]);

  return (
    <header className="border-b">
      <div className="container flex h-14 items-center px-4">
        <Link href="/" className="mr-8 text-lg font-semibold">
          Münzsammlung
        </Link>
        <nav className="flex items-center gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative text-sm font-medium transition-colors hover:text-foreground/80",
                pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                  ? "text-foreground"
                  : "text-foreground/60"
              )}
            >
              {item.label}
              {(item.href === "/ersttagsbriefe" || item.href === "/banknoten") && pendingScanCount > 0 && (
                <span className="absolute -right-3 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {pendingScanCount}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

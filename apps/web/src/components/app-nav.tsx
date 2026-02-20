"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Start" },
  { href: "/capture", label: "Erfassen" },
  { href: "/collection", label: "Sammlung" },
  { href: "/settings", label: "Einstellungen" },
];

export function AppNav() {
  const pathname = usePathname();

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
                "text-sm font-medium transition-colors hover:text-foreground/80",
                pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                  ? "text-foreground"
                  : "text-foreground/60"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

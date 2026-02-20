"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const CONDITION_OPTIONS = [
  { value: "s", label: "s" },
  { value: "ss", label: "ss" },
  { value: "vz", label: "vz" },
  { value: "st", label: "st" },
  { value: "stgl", label: "stgl" },
  { value: "PP", label: "PP" },
];

interface FilterBarProps {
  countries: string[];
  denominations: string[];
  currentFilters: Record<string, string | undefined>;
}

export function FilterBar({
  countries,
  denominations,
  currentFilters,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const updateFilter = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(currentFilters)) {
        if (v && k !== "page" && k !== key) params.set(k, v);
      }
      if (value) params.set(key, value);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [currentFilters, router, pathname]
  );

  const clearFilters = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  const hasFilters = Object.entries(currentFilters).some(
    ([k, v]) => v && k !== "page"
  );

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {/* Free-text search */}
        <div className="w-64">
          <Input
            placeholder="Suche..."
            defaultValue={currentFilters.q || ""}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateFilter("q", (e.target as HTMLInputElement).value || undefined);
              }
            }}
          />
        </div>

        {/* Country filter */}
        <Select
          value={currentFilters.country || "all"}
          onValueChange={(val) =>
            updateFilter("country", val === "all" ? undefined : val)
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Land" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Länder</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Denomination filter */}
        <Select
          value={currentFilters.denomination || "all"}
          onValueChange={(val) =>
            updateFilter("denomination", val === "all" ? undefined : val)
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Nominal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Nominale</SelectItem>
            {denominations.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Year filter */}
        <div className="w-28">
          <Input
            type="number"
            placeholder="Jahr"
            defaultValue={currentFilters.year || ""}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateFilter(
                  "year",
                  (e.target as HTMLInputElement).value || undefined
                );
              }
            }}
          />
        </div>

        {/* Condition filter */}
        <Select
          value={currentFilters.condition || "all"}
          onValueChange={(val) =>
            updateFilter("condition", val === "all" ? undefined : val)
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Erhaltung" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            {CONDITION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Filter zurücksetzen
          </Button>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
}

export function Pagination({
  currentPage,
  totalPages,
  searchParams,
}: PaginationProps) {
  const buildUrl = (page: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== "page") params.set(k, v);
    }
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `/collection?${qs}` : "/collection";
  };

  // Show at most 7 page buttons
  const pages: number[] = [];
  const start = Math.max(1, currentPage - 3);
  const end = Math.min(totalPages, start + 6);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="mt-8 flex items-center justify-center gap-1">
      {currentPage > 1 && (
        <Button variant="outline" size="sm" asChild>
          <Link href={buildUrl(currentPage - 1)}>Zurück</Link>
        </Button>
      )}

      {pages.map((p) => (
        <Button
          key={p}
          variant={p === currentPage ? "default" : "outline"}
          size="sm"
          asChild={p !== currentPage}
        >
          {p === currentPage ? (
            <span>{p}</span>
          ) : (
            <Link href={buildUrl(p)}>{p}</Link>
          )}
        </Button>
      ))}

      {currentPage < totalPages && (
        <Button variant="outline" size="sm" asChild>
          <Link href={buildUrl(currentPage + 1)}>Weiter</Link>
        </Button>
      )}
    </div>
  );
}

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Pagination } from "../collection/_components/pagination";

const PAGE_SIZE = 48;

interface BanknotenPageProps {
  searchParams: Promise<{
    page?: string;
    q?: string;
  }>;
}

export default async function BanknotenPage({
  searchParams,
}: BanknotenPageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1");

  const where: Record<string, unknown> = { itemType: "banknote" };

  if (params.q) {
    where.OR = [
      { description: { contains: params.q, mode: "insensitive" } },
      { denomination: { contains: params.q, mode: "insensitive" } },
      { country: { contains: params.q, mode: "insensitive" } },
      { notes: { contains: params.q, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.coin.findMany({
      where,
      include: { images: { take: 1, orderBy: { sortOrder: "asc" } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.coin.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Banknoten</h1>
          <p className="text-muted-foreground">
            {total} {total === 1 ? "Banknote" : "Banknoten"}
          </p>
        </div>
        <Link
          href="/banknoten/erfassen"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + Banknote erfassen
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-lg text-muted-foreground">
            Keine Banknoten gefunden.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Erfasse deine erste Banknote.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {items.map((item) => (
            <Link
              key={item.id}
              href={`/collection/${item.id}`}
              className="group rounded-lg border bg-card p-2 transition-colors hover:bg-accent"
            >
              <div className="aspect-[3/2] overflow-hidden rounded-md bg-muted">
                {item.images[0] ? (
                  <img
                    src={item.images[0].thumbnailUrl}
                    alt={item.denomination || item.description || "Banknote"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
                    Kein Bild
                  </div>
                )}
              </div>
              <div className="mt-2 space-y-0.5">
                <p className="truncate text-sm font-medium">
                  {item.denomination || item.description || "Banknote"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[item.country, item.year].filter(Boolean).join(" ")}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          searchParams={params}
        />
      )}
    </div>
  );
}

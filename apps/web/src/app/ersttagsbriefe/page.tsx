import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Pagination } from "../collection/_components/pagination";

const PAGE_SIZE = 48;

interface ErsttagsbriefePageProps {
  searchParams: Promise<{
    page?: string;
    q?: string;
    collectionId?: string;
  }>;
}

export default async function ErsttagsbriefePage({
  searchParams,
}: ErsttagsbriefePageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1");

  const where: Record<string, unknown> = { itemType: "ersttagsbrief" };

  if (params.collectionId) where.collectionId = params.collectionId;
  if (params.q) {
    where.OR = [
      { description: { contains: params.q, mode: "insensitive" } },
      { country: { contains: params.q, mode: "insensitive" } },
      { notes: { contains: params.q, mode: "insensitive" } },
    ];
  }

  const [items, total, collections] = await Promise.all([
    prisma.coin.findMany({
      where,
      include: {
        images: { take: 1, orderBy: { sortOrder: "asc" } },
        collection: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.coin.count({ where }),
    prisma.collection.findMany({
      where: { coins: { some: { itemType: "ersttagsbrief" } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ersttagsbriefe</h1>
          <p className="text-muted-foreground">
            {total} {total === 1 ? "Ersttagsbrief" : "Ersttagsbriefe"}
          </p>
        </div>
        <Link
          href="/ersttagsbriefe/erfassen"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + Ersttagsbrief erfassen
        </Link>
      </div>

      {/* Collection filter */}
      {collections.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/ersttagsbriefe"
            className={`rounded-full px-3 py-1 text-sm ${
              !params.collectionId
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Alle
          </Link>
          {collections.map((c) => (
            <Link
              key={c.id}
              href={`/ersttagsbriefe?collectionId=${c.id}`}
              className={`rounded-full px-3 py-1 text-sm ${
                params.collectionId === c.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-lg text-muted-foreground">
            Keine Ersttagsbriefe gefunden.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Erfasse deinen ersten Ersttagsbrief.
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
              <div className="aspect-[3/4] overflow-hidden rounded-md bg-muted">
                {item.images[0] ? (
                  <img
                    src={item.images[0].thumbnailUrl}
                    alt={item.description || "Ersttagsbrief"}
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
                  {item.description || item.denomination || "Ersttagsbrief"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[item.country, item.year].filter(Boolean).join(" ")}
                </p>
                {item.collection && (
                  <p className="truncate text-xs text-primary/70">
                    {item.collection.name}
                  </p>
                )}
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

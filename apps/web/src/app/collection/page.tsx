import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { CollectionGrid } from "./_components/collection-grid";
import { FilterBar } from "./_components/filter-bar";
import { Pagination } from "./_components/pagination";

const PAGE_SIZE = 48;

interface CollectionPageProps {
  searchParams: Promise<{
    page?: string;
    country?: string;
    denomination?: string;
    year?: string;
    mintMark?: string;
    condition?: string;
    q?: string;
  }>;
}

async function getFilterOptions() {
  const [countries, denominations] = await Promise.all([
    prisma.coin.findMany({
      select: { country: true },
      distinct: ["country"],
      orderBy: { country: "asc" },
    }),
    prisma.coin.findMany({
      select: { denomination: true },
      distinct: ["denomination"],
      orderBy: { denomination: "asc" },
    }),
  ]);

  return {
    countries: countries.map((c) => c.country),
    denominations: denominations.map((d) => d.denomination),
  };
}

export default async function CollectionPage({
  searchParams,
}: CollectionPageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const { country, denomination, year, mintMark, condition, q } = params;

  const where: Record<string, unknown> = {};

  if (country) where.country = country;
  if (denomination)
    where.denomination = { contains: denomination, mode: "insensitive" };
  if (year) where.year = parseInt(year);
  if (mintMark) where.mintMark = mintMark;
  if (condition) where.condition = condition;
  if (q) {
    where.OR = [
      { country: { contains: q, mode: "insensitive" } },
      { denomination: { contains: q, mode: "insensitive" } },
      { numistaTitle: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
    ];
  }

  const [coins, total, filterOptions] = await Promise.all([
    prisma.coin.findMany({
      where,
      include: { images: { where: { type: "obverse" }, take: 1 } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.coin.count({ where }),
    getFilterOptions(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sammlung</h1>
          <p className="text-muted-foreground">
            {total} {total === 1 ? "Münze" : "Münzen"}
          </p>
        </div>
      </div>

      <Suspense fallback={null}>
        <FilterBar
          countries={filterOptions.countries}
          denominations={filterOptions.denominations}
          currentFilters={params}
        />
      </Suspense>

      <CollectionGrid coins={coins} />

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

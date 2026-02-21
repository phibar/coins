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
    collectionId?: string;
    material?: string;
    series?: string;
    storageLocation?: string;
    isProof?: string;
    hasCase?: string;
    hasCertificate?: string;
    q?: string;
  }>;
}

async function getFilterOptions() {
  const [
    countries,
    denominations,
    collections,
    materials,
    mintMarks,
    seriesList,
    storageLocations,
  ] = await Promise.all([
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
    prisma.collection.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.coin.findMany({
      select: { material: true },
      distinct: ["material"],
      where: { material: { not: null } },
      orderBy: { material: "asc" },
    }),
    prisma.coin.findMany({
      select: { mintMark: true },
      distinct: ["mintMark"],
      where: { mintMark: { not: null } },
      orderBy: { mintMark: "asc" },
    }),
    prisma.coin.findMany({
      select: { series: true },
      distinct: ["series"],
      where: { series: { not: null } },
      orderBy: { series: "asc" },
    }),
    prisma.coin.findMany({
      select: { storageLocation: true },
      distinct: ["storageLocation"],
      where: { storageLocation: { not: null } },
      orderBy: { storageLocation: "asc" },
    }),
  ]);

  return {
    countries: countries.map((c) => c.country),
    denominations: denominations.map((d) => d.denomination),
    collections,
    materials: materials
      .map((m) => m.material)
      .filter((v): v is string => v !== null),
    mintMarks: mintMarks
      .map((m) => m.mintMark)
      .filter((v): v is string => v !== null),
    series: seriesList
      .map((s) => s.series)
      .filter((v): v is string => v !== null),
    storageLocations: storageLocations
      .map((s) => s.storageLocation)
      .filter((v): v is string => v !== null),
  };
}

export default async function CollectionPage({
  searchParams,
}: CollectionPageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const {
    country,
    denomination,
    year,
    mintMark,
    condition,
    collectionId,
    material,
    series,
    storageLocation,
    isProof,
    hasCase,
    hasCertificate,
    q,
  } = params;

  const where: Record<string, unknown> = {};

  if (country) where.country = country;
  if (denomination)
    where.denomination = { contains: denomination, mode: "insensitive" };
  if (year) where.year = parseInt(year);
  if (mintMark) where.mintMark = mintMark;
  if (condition) where.condition = condition;
  if (collectionId) where.collectionId = collectionId;
  if (material) where.material = material;
  if (series) where.series = { contains: series, mode: "insensitive" };
  if (storageLocation) where.storageLocation = storageLocation;
  if (isProof === "true") where.isProof = true;
  if (hasCase === "true") where.hasCase = true;
  if (hasCertificate === "true") where.hasCertificate = true;
  if (q) {
    where.OR = [
      { country: { contains: q, mode: "insensitive" } },
      { denomination: { contains: q, mode: "insensitive" } },
      { numistaTitle: { contains: q, mode: "insensitive" } },
      { notes: { contains: q, mode: "insensitive" } },
      { series: { contains: q, mode: "insensitive" } },
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
          collections={filterOptions.collections}
          materials={filterOptions.materials}
          mintMarks={filterOptions.mintMarks}
          series={filterOptions.series}
          storageLocations={filterOptions.storageLocations}
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

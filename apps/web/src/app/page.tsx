import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DonutChart } from "@/components/charts";

const CONDITION_LABELS: Record<string, string> = {
  s: "s - schön",
  ss: "ss - sehr schön",
  vz: "vz - vorzüglich",
  st: "st - Stempelglanz",
  stgl: "stgl - Stempelglanz",
  PP: "PP - Polierte Platte",
};

export default async function DashboardPage() {
  const [
    totalCoins,
    totalImages,
    countryStats,
    conditionStats,
    yearStats,
    recentCoins,
    proofCount,
    withCaseCount,
    withCertCount,
    materialStats,
    valueStats,
  ] = await Promise.all([
    prisma.coin.count(),
    prisma.coinImage.count(),
    prisma.coin.groupBy({
      by: ["country"],
      _count: { _all: true },
      orderBy: { _count: { country: "desc" } },
      take: 10,
    }),
    prisma.coin.groupBy({
      by: ["condition"],
      _count: { _all: true },
      orderBy: { _count: { condition: "desc" } },
    }),
    prisma.coin.groupBy({
      by: ["year"],
      _count: { _all: true },
      orderBy: { year: "asc" },
    }),
    prisma.coin.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        images: { where: { type: "obverse" }, take: 1 },
      },
    }),
    prisma.coin.count({ where: { isProof: true } }),
    prisma.coin.count({ where: { hasCase: true } }),
    prisma.coin.count({ where: { hasCertificate: true } }),
    prisma.coin.groupBy({
      by: ["material"],
      _count: { _all: true },
      orderBy: { _count: { material: "desc" } },
      take: 10,
    }),
    prisma.coin.aggregate({
      _sum: { estimatedValue: true },
      _avg: { estimatedValue: true },
      _count: { estimatedValue: true },
    }),
  ]);

  const uniqueCountries = countryStats.length;
  const minYear = yearStats.length > 0 ? yearStats[0].year : null;
  const maxYear = yearStats.length > 0 ? yearStats[yearStats.length - 1].year : null;

  // Group years into decades for the chart
  const decadeMap = new Map<string, number>();
  for (const ys of yearStats) {
    const decade = `${Math.floor(ys.year / 10) * 10}er`;
    decadeMap.set(decade, (decadeMap.get(decade) || 0) + ys._count._all);
  }
  const decadeData = Array.from(decadeMap.entries()).map(([name, value]) => ({
    name,
    value,
  }));

  // Country data for pie chart
  const countryData = countryStats.map((cs) => ({
    name: cs.country,
    value: cs._count._all,
  }));

  // Condition data for pie chart
  const conditionsWithData = conditionStats.filter((c) => c.condition !== null);
  const noConditionCount = conditionStats.find((c) => c.condition === null)?._count._all || 0;
  const conditionData = [
    ...conditionsWithData.map((cs) => ({
      name: CONDITION_LABELS[cs.condition!] || cs.condition!,
      value: cs._count._all,
    })),
    ...(noConditionCount > 0
      ? [{ name: "Nicht angegeben", value: noConditionCount }]
      : []),
  ];

  // Material data for pie chart
  const materialsWithData = materialStats.filter((m) => m.material !== null);
  const materialData = materialsWithData.map((ms) => ({
    name: ms.material!,
    value: ms._count._all,
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Münzsammlung</h1>
          <p className="text-muted-foreground">
            Übersicht deiner Sammlung
          </p>
        </div>
        <Link href="/capture">
          <Button size="lg">Münzen erfassen</Button>
        </Link>
      </div>

      {totalCoins === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Stat cards */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard
              title="Münzen gesamt"
              value={totalCoins.toLocaleString("de-DE")}
            />
            <StatCard
              title="Länder"
              value={String(uniqueCountries)}
            />
            <StatCard
              title="Zeitraum"
              value={minYear && maxYear ? `${minYear} – ${maxYear}` : "–"}
            />
            <StatCard
              title="Fotos"
              value={totalImages.toLocaleString("de-DE")}
            />
            <StatCard
              title="Gesamtwert"
              value={
                valueStats._sum.estimatedValue
                  ? `${valueStats._sum.estimatedValue.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} EUR`
                  : "–"
              }
              subtitle={
                valueStats._count.estimatedValue > 0
                  ? `${valueStats._count.estimatedValue} von ${totalCoins} bewertet`
                  : undefined
              }
            />
            <StatCard
              title="Durchschnitt"
              value={
                valueStats._avg.estimatedValue
                  ? `${valueStats._avg.estimatedValue.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`
                  : "–"
              }
            />
          </div>

          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            {/* Top countries - Donut */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Nach Land</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart data={countryData} />
              </CardContent>
            </Card>

            {/* Decades - Donut */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Nach Jahrzehnt
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart data={decadeData} />
              </CardContent>
            </Card>
          </div>

          <div className="mb-8 grid gap-6 lg:grid-cols-2">
            {/* Condition distribution - Donut */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Erhaltung</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart data={conditionData} />
              </CardContent>
            </Card>

            {/* Material distribution - Donut */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Material</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart data={materialData} />
              </CardContent>
            </Card>
          </div>

          {/* Special attributes */}
          <div className="mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Besonderheiten</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <AttributeCard label="Polierte Platte" count={proofCount} total={totalCoins} />
                  <AttributeCard label="Mit Etui" count={withCaseCount} total={totalCoins} />
                  <AttributeCard label="Mit Zertifikat" count={withCertCount} total={totalCoins} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent coins */}
          {recentCoins.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Zuletzt erfasst
                  </CardTitle>
                  <Link
                    href="/collection"
                    className="text-sm text-primary hover:underline"
                  >
                    Alle anzeigen
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                  {recentCoins.map((coin) => {
                    const thumb = coin.images[0];
                    return (
                      <Link
                        key={coin.id}
                        href={`/collection/${coin.id}`}
                        className="group rounded-lg border p-3 transition-colors hover:bg-accent"
                      >
                        {thumb ? (
                          <img
                            src={thumb.thumbnailUrl}
                            alt={coin.denomination}
                            className="mb-2 aspect-square w-full rounded object-cover"
                          />
                        ) : coin.numistaObverseThumbnail ? (
                          <img
                            src={coin.numistaObverseThumbnail}
                            alt={coin.denomination}
                            className="mb-2 aspect-square w-full rounded object-cover opacity-70"
                          />
                        ) : (
                          <div className="mb-2 flex aspect-square w-full items-center justify-center rounded bg-muted">
                            <span className="text-2xl text-muted-foreground">
                              ?
                            </span>
                          </div>
                        )}
                        <p className="truncate text-sm font-medium">
                          {coin.denomination}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {coin.country} {coin.year}
                          {coin.mintMark && ` (${coin.mintMark})`}
                        </p>
                        {coin.estimatedValue && (
                          <p className="text-xs font-medium text-green-600">
                            ~{coin.estimatedValue.toLocaleString("de-DE", { minimumFractionDigits: 2 })}{" "}
                            {coin.estimatedCurrency || "EUR"}
                          </p>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

function AttributeCard({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  if (count === 0) return null;
  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
  return (
    <div className="rounded-lg border p-4 text-center">
      <p className="text-2xl font-bold tabular-nums">{count}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{pct}%</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
      <p className="mb-2 text-lg font-medium">Noch keine Münzen erfasst</p>
      <p className="mb-6 text-sm text-muted-foreground">
        Starte mit der Erfassung deiner ersten Münze
      </p>
      <Link href="/capture">
        <Button>Erste Münze erfassen</Button>
      </Link>
    </div>
  );
}

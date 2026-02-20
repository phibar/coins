import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { DeleteCoinButton } from "./delete-button";
import type {
  NumistaFaceData,
  NumistaReference,
  NumistaMint,
  NumistaRulerEntry,
  NumistaIssueData,
  NumistaPriceData,
  NumistaRelatedType,
} from "@/types/capture";

const CONDITION_LABELS: Record<string, string> = {
  s: "s - schön",
  ss: "ss - sehr schön",
  vz: "vz - vorzüglich",
  st: "st - Stempelglanz",
  stgl: "stgl - Stempelglanz",
  PP: "PP - Polierte Platte",
};

interface DetailPageProps {
  params: Promise<{ id: string }>;
}

// Type-safe Json field parser
function json<T>(field: unknown): T | null {
  if (!field) return null;
  return field as T;
}

export default async function CoinDetailPage({ params }: DetailPageProps) {
  const { id } = await params;

  const coin = await prisma.coin.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });

  if (!coin) notFound();

  const obverse = coin.images.find((i) => i.type === "obverse");
  const reverse = coin.images.find((i) => i.type === "reverse");

  // Parse Json fields
  const prices = json<NumistaPriceData>(coin.numistaPrices);
  const issues = json<NumistaIssueData[]>(coin.numistaIssues);
  const references = json<NumistaReference[]>(coin.numistaReferences);
  const mints = json<NumistaMint[]>(coin.numistaMints);
  const ruler = json<NumistaRulerEntry[]>(coin.numistaRuler);
  const obverseData = json<NumistaFaceData>(coin.numistaObverse);
  const reverseData = json<NumistaFaceData>(coin.numistaReverse);
  const relatedTypes = json<NumistaRelatedType[]>(coin.numistaRelatedTypes);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/collection">&larr; Zurück zur Sammlung</Link>
        </Button>
        <DeleteCoinButton coinId={coin.id} />
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{coin.denomination}</h1>
        <p className="text-lg text-muted-foreground">
          {coin.country} {coin.year}
          {coin.mintMark && ` (${coin.mintMark})`}
        </p>
        {coin.numistaUrl && (
          <a
            href={coin.numistaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline"
          >
            Auf Numista ansehen &rarr;
          </a>
        )}
      </div>

      {/* Images */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <ImageSection
          label="Vorderseite"
          userImage={obverse?.url}
          numistaImage={coin.numistaObverseThumbnail}
          faceData={obverseData}
        />
        <ImageSection
          label="Rückseite"
          userImage={reverse?.url}
          numistaImage={coin.numistaReverseThumbnail}
          faceData={reverseData}
        />
      </div>

      {/* Price estimation */}
      {(prices?.prices?.length || coin.estimatedValue) && (
        <div className="mb-6 rounded-lg bg-green-50 dark:bg-green-950/30 p-4">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-3">
            Preisschätzung
            {prices?.currency && ` (${prices.currency})`}
          </h2>
          {prices?.prices?.length ? (
            <div className="flex flex-wrap gap-4 mb-3">
              {prices.prices.map((p) => (
                <div key={p.grade} className="text-sm">
                  <span className="text-muted-foreground">{p.grade}: </span>
                  <span className="font-semibold">
                    {p.price.toFixed(2)} {prices.currency}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {coin.estimatedValue && (
            <div className="text-base font-semibold">
              Geschätzter Wert:{" "}
              {coin.estimatedValue.toLocaleString("de-DE", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              {coin.estimatedCurrency || "EUR"}
            </div>
          )}
        </div>
      )}

      {/* Issues / Mintage */}
      {issues && issues.length > 0 && (
        <div className="mb-6 rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-3">
            Auflagen ({issues.length} Ausgaben)
          </h2>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="flex justify-between text-sm"
              >
                <span>
                  {issue.year}
                  {issue.mint_letter && ` ${issue.mint_letter}`}
                  {issue.comment && (
                    <span className="text-muted-foreground text-xs ml-1">
                      ({issue.comment})
                    </span>
                  )}
                </span>
                <span className="font-medium tabular-nums">
                  {issue.mintage
                    ? issue.mintage.toLocaleString("de-DE")
                    : "–"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two-column details */}
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* Coin details */}
        <div className="rounded-lg border p-4">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-3">
            Münzdetails
          </h2>
          <div className="space-y-2 text-sm">
            <DetailRow label="Land" value={coin.country} />
            <DetailRow label="Nominal" value={coin.denomination} />
            <DetailRow label="Prägejahr" value={String(coin.year)} />
            <DetailRow label="Prägeanstalt" value={coin.mintMark} />
            <DetailRow label="Material" value={coin.material} />
            <DetailRow
              label="Feingehalt"
              value={coin.fineness ? String(coin.fineness) : null}
            />
            <DetailRow
              label="Gewicht"
              value={coin.weight ? `${coin.weight} g` : null}
            />
            <DetailRow
              label="Durchmesser"
              value={coin.diameter ? `${coin.diameter} mm` : null}
            />
            <DetailRow
              label="Dicke"
              value={coin.thickness ? `${coin.thickness} mm` : null}
            />
            <DetailRow label="Randart" value={coin.edgeType} />
            <DetailRow
              label="Auflage"
              value={
                coin.mintage
                  ? coin.mintage.toLocaleString("de-DE")
                  : null
              }
            />
            <DetailRow
              label="Erhaltung"
              value={
                coin.condition
                  ? CONDITION_LABELS[coin.condition] || coin.condition
                  : null
              }
            />
            {coin.isProof && <DetailRow label="Polierte Platte" value="Ja" />}
            {coin.isFirstDay && <DetailRow label="Ersttag" value="Ja" />}
            {coin.hasCase && <DetailRow label="Etui" value="Ja" />}
            {coin.hasCertificate && (
              <DetailRow label="Zertifikat" value="Ja" />
            )}
          </div>
        </div>

        {/* Numista data */}
        <div className="rounded-lg border p-4">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-3">
            Numista-Daten
          </h2>
          <div className="space-y-2 text-sm">
            <DetailRow label="Serie" value={coin.series} />
            <DetailRow label="Thema" value={coin.commemoratedTopic} />
            <DetailRow
              label="Katalog"
              value={
                references
                  ?.map((r) => `${r.catalogue.code}# ${r.number}`)
                  .join(", ") || null
              }
            />
            <DetailRow label="Form" value={coin.shape} />
            <DetailRow
              label="Prägung"
              value={
                coin.orientation
                  ? coin.orientation === "medal"
                    ? "Medaillenprägung"
                    : "Münzprägung"
                  : null
              }
            />
            <DetailRow label="Technik" value={coin.technique} />
            <DetailRow
              label="Prägestätten"
              value={mints?.map((m) => m.name).join(", ") || null}
            />
            <DetailRow
              label="Herrscher"
              value={ruler?.map((r) => r.name).join(", ") || null}
            />
            {coin.isDemonetized && (
              <DetailRow
                label="Demonetisiert"
                value={coin.demonetizationDate || "Ja"}
              />
            )}
            {coin.comments && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Kommentare
                </p>
                <p className="text-sm whitespace-pre-line">{coin.comments}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Organization */}
      <div className="mb-6 rounded-lg border p-4">
        <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-3">
          Organisation
        </h2>
        <div className="space-y-2 text-sm">
          <DetailRow label="Lagerort" value={coin.storageLocation} />
          {coin.tags.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="font-medium text-muted-foreground w-28 shrink-0">
                Tags
              </span>
              <div className="flex flex-wrap gap-1">
                {coin.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-primary/10 px-2 py-0.5 text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          {coin.notes && (
            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Notizen
              </p>
              <p className="text-sm whitespace-pre-line">{coin.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Related types */}
      {relatedTypes && relatedTypes.length > 0 && (
        <div className="mb-6 rounded-lg border p-4">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-3">
            Verwandte Typen
          </h2>
          <div className="flex flex-wrap gap-2">
            {relatedTypes.map((rt) => (
              <span
                key={rt.id}
                className="rounded border px-2 py-1 text-xs text-muted-foreground"
              >
                {rt.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Timestamp */}
      <p className="text-xs text-muted-foreground">
        Erstellt:{" "}
        {coin.createdAt.toLocaleDateString("de-DE", {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}

function ImageSection({
  label,
  userImage,
  numistaImage,
  faceData,
}: {
  label: string;
  userImage?: string | null;
  numistaImage?: string | null;
  faceData: NumistaFaceData | null;
}) {
  const imageSrc = userImage || numistaImage;
  const isNumistaFallback = !userImage && numistaImage;

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-muted-foreground">
        {label}
        {isNumistaFallback && (
          <span className="ml-1 text-xs">(Numista-Referenz)</span>
        )}
      </p>
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={label}
          className="w-full rounded-lg border"
        />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-lg border bg-muted">
          <span className="text-muted-foreground text-sm">Kein Bild</span>
        </div>
      )}
      {faceData && (
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          {faceData.description && <p>{faceData.description}</p>}
          {faceData.lettering && (
            <p className="italic">{faceData.lettering}</p>
          )}
          {faceData.engravers?.length ? (
            <p>Graveur: {faceData.engravers.join(", ")}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="font-medium text-muted-foreground w-28 shrink-0">
        {label}
      </span>
      <span>{value}</span>
    </div>
  );
}

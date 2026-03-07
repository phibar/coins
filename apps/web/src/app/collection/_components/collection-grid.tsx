import Link from "next/link";

interface CoinWithImage {
  id: string;
  country: string | null;
  denomination: string | null;
  year: number | null;
  description: string | null;
  mintMark: string | null;
  condition: string | null;
  images: { thumbnailUrl: string }[];
}

interface CollectionGridProps {
  coins: CoinWithImage[];
}

export function CollectionGrid({ coins }: CollectionGridProps) {
  if (coins.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-lg text-muted-foreground">
          Keine Münzen gefunden.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Erfasse deine ersten Münzen über die Erfassungsseite.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
      {coins.map((coin) => (
        <Link
          key={coin.id}
          href={`/collection/${coin.id}`}
          className="group rounded-lg border bg-card p-2 transition-colors hover:bg-accent"
        >
          <div className="aspect-square overflow-hidden rounded-md bg-muted">
            {coin.images[0] ? (
              <img
                src={coin.images[0].thumbnailUrl}
                alt={`${coin.denomination} ${coin.year}`}
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
              {coin.denomination || coin.description || "–"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {[coin.country, coin.year, coin.mintMark].filter(Boolean).join(" ") || ""}
            </p>
            {coin.condition && (
              <p className="text-xs text-muted-foreground">
                {coin.condition}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

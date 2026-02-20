export default function CollectionLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="h-9 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-5 w-24 animate-pulse rounded bg-muted" />
      </div>

      <div className="mb-6 flex gap-3">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-10 w-36 animate-pulse rounded bg-muted"
          />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {[...Array(24)].map((_, i) => (
          <div key={i} className="space-y-2 rounded-lg border p-2">
            <div className="aspect-square animate-pulse rounded-md bg-muted" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

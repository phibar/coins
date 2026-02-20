"use client";

import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  NumistaTypePreview,
  NumistaTypeDetail,
  NumistaIssue,
  NumistaPriceResult,
} from "@/lib/numista";
import type { CoinFormData } from "@/types/capture";

// Extended type returned by our API route (detail + issues + prices)
interface NumistaDetailResponse extends NumistaTypeDetail {
  issues: NumistaIssue[];
  prices: NumistaPriceResult | null;
}

const ISSUER_OPTIONS = [
  { value: "", label: "Alle" },
  { value: "allemagne", label: "Deutschland" },
  { value: "autriche", label: "Österreich" },
  { value: "suisse", label: "Schweiz" },
  { value: "france", label: "Frankreich" },
  { value: "italie", label: "Italien" },
  { value: "pays-bas", label: "Niederlande" },
  { value: "belgique", label: "Belgien" },
  { value: "espagne", label: "Spanien" },
  { value: "portugal", label: "Portugal" },
  { value: "royaume-uni", label: "Großbritannien" },
  { value: "etats-unis", label: "USA" },
  { value: "grece", label: "Griechenland" },
  { value: "union-europeenne", label: "EU / Euro" },
] as const;

// Reverse lookup: Numista issuer code -> German country name
const ISSUER_TO_COUNTRY: Record<string, string> = {
  allemagne: "Deutschland",
  autriche: "Österreich",
  suisse: "Schweiz",
  france: "Frankreich",
  italie: "Italien",
  "pays-bas": "Niederlande",
  belgique: "Belgien",
  espagne: "Spanien",
  portugal: "Portugal",
  "royaume-uni": "Großbritannien",
  "etats-unis": "USA",
  grece: "Griechenland",
  "union-europeenne": "EU",
};

interface NumistaSearchDialogProps {
  currentFormData?: Partial<CoinFormData>;
  onSelect: (data: Partial<CoinFormData>) => void;
  children: React.ReactNode;
}

export function NumistaSearchDialog({
  currentFormData,
  onSelect,
  children,
}: NumistaSearchDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [issuer, setIssuer] = useState("");
  const [year, setYear] = useState("");
  const [results, setResults] = useState<NumistaTypePreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDetail, setSelectedDetail] =
    useState<NumistaDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Initialize search fields from current form data when dialog opens
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (isOpen && currentFormData) {
        if (currentFormData.denomination) setQuery(currentFormData.denomination);
        if (currentFormData.country) {
          // Find matching issuer code from country name
          const entry = ISSUER_OPTIONS.find(
            (o) => o.label.toLowerCase() === currentFormData.country!.toLowerCase()
          );
          setIssuer(entry?.value || "");
        }
        if (currentFormData.year) setYear(String(currentFormData.year));
      }
      if (!isOpen) {
        setResults([]);
        setSelectedDetail(null);
      }
    },
    [currentFormData]
  );

  const performSearch = useCallback(
    async (q: string, iss: string, yr: string) => {
      if (q.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams({ q });
        if (iss) params.set("issuer", iss);
        if (yr) params.set("year", yr);

        const response = await fetch(`/api/numista/search?${params}`);
        if (!response.ok) throw new Error("Search failed");

        const data = await response.json();
        setResults(data.types || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleSearchChange = useCallback(
    (q: string, iss: string, yr: string) => {
      setQuery(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        performSearch(q, iss, yr);
      }, 500);
    },
    [performSearch]
  );

  const handleSelectType = useCallback(async (typeId: number) => {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/numista/type/${typeId}`);
      if (!response.ok) throw new Error("Detail fetch failed");

      const detail: NumistaDetailResponse = await response.json();
      setSelectedDetail(detail);
    } catch {
      setSelectedDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleConfirmSelection = useCallback(() => {
    if (!selectedDetail) return;

    const data: Partial<CoinFormData> = {
      numistaTypeId: selectedDetail.id,
      numistaTitle: selectedDetail.title,
      numistaUrl: selectedDetail.url || "",
    };

    // Country from issuer
    const country =
      ISSUER_TO_COUNTRY[selectedDetail.issuer.code] ||
      selectedDetail.issuer.name;
    if (country) data.country = country;

    // Denomination: prefer value.text, fallback to title
    data.denomination =
      selectedDetail.value?.text || selectedDetail.title;

    // Year if specific (min === max)
    if (
      selectedDetail.min_year &&
      selectedDetail.min_year === selectedDetail.max_year
    ) {
      data.year = selectedDetail.min_year;
    }

    // Physical properties
    if (selectedDetail.weight) data.weight = String(selectedDetail.weight);
    if (selectedDetail.size) data.diameter = String(selectedDetail.size);
    if (selectedDetail.thickness) data.thickness = String(selectedDetail.thickness);
    if (selectedDetail.composition?.text)
      data.material = selectedDetail.composition.text;

    // Edge
    const edgeParts = [
      selectedDetail.edge?.description,
      selectedDetail.edge?.lettering,
    ].filter(Boolean);
    if (edgeParts.length > 0) data.edgeType = edgeParts.join(" - ");

    // Tags
    if (selectedDetail.tags?.length) data.tags = selectedDetail.tags;

    // Scalar Numista fields
    if (selectedDetail.shape) data.shape = selectedDetail.shape;
    if (selectedDetail.orientation) data.orientation = selectedDetail.orientation;
    if (selectedDetail.technique?.text) data.technique = selectedDetail.technique.text;
    if (selectedDetail.series) data.series = selectedDetail.series;
    if (selectedDetail.commemorated_topic)
      data.commemoratedTopic = selectedDetail.commemorated_topic;
    if (selectedDetail.demonetization?.is_demonetized) {
      data.isDemonetized = true;
      data.demonetizationDate =
        selectedDetail.demonetization.demonetization_date || "";
    }
    if (selectedDetail.comments) {
      data.comments = selectedDetail.comments.replace(/<[^>]*>/g, "");
    }

    // Numista reference images
    if (selectedDetail.obverse?.thumbnail)
      data.numistaObverseThumbnail = selectedDetail.obverse.thumbnail;
    if (selectedDetail.reverse?.thumbnail)
      data.numistaReverseThumbnail = selectedDetail.reverse.thumbnail;

    // Structured Json fields
    if (selectedDetail.obverse) {
      data.numistaObverse = {
        description: selectedDetail.obverse.description,
        lettering: selectedDetail.obverse.lettering,
        engravers: selectedDetail.obverse.engravers,
      };
    }
    if (selectedDetail.reverse) {
      data.numistaReverse = {
        description: selectedDetail.reverse.description,
        lettering: selectedDetail.reverse.lettering,
        engravers: selectedDetail.reverse.engravers,
      };
    }
    if (selectedDetail.references?.length)
      data.numistaReferences = selectedDetail.references;
    if (selectedDetail.mints?.length)
      data.numistaMints = selectedDetail.mints;
    if (selectedDetail.ruler?.length)
      data.numistaRuler = selectedDetail.ruler;
    if (selectedDetail.related_types?.length)
      data.numistaRelatedTypes = selectedDetail.related_types;

    // Issues + mintage
    if (selectedDetail.issues?.length) {
      data.numistaIssues = selectedDetail.issues;
      const firstIssue = selectedDetail.issues[0];
      if (firstIssue.mintage) data.mintage = String(firstIssue.mintage);
    }

    // Prices + estimated value
    if (selectedDetail.prices?.prices?.length) {
      data.numistaPrices = selectedDetail.prices;
      data.estimatedCurrency = selectedDetail.prices.currency;
      // Pick VF or XF price as default estimated value, or middle grade
      const vfPrice = selectedDetail.prices.prices.find(
        (p) => p.grade === "VF" || p.grade === "XF"
      );
      data.estimatedValue =
        vfPrice?.price ||
        selectedDetail.prices.prices[
          Math.floor(selectedDetail.prices.prices.length / 2)
        ]?.price ||
        null;
    }

    // notes is NOT populated with Numista data anymore — reserved for user notes only

    onSelect(data);
    setOpen(false);
  }, [selectedDetail, onSelect]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Numista-Suche</DialogTitle>
        </DialogHeader>

        {/* Search form */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
          <div>
            <Label htmlFor="numista-q" className="text-xs">
              Suche
            </Label>
            <Input
              id="numista-q"
              value={query}
              onChange={(e) =>
                handleSearchChange(e.target.value, issuer, year)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  performSearch(query, issuer, year);
                }
              }}
              placeholder="z.B. 5 Mark, 10 Euro"
            />
          </div>
          <div>
            <Label className="text-xs">Land</Label>
            <Select
              value={issuer}
              onValueChange={(val) => {
                const v = val === "__all__" ? "" : val;
                setIssuer(v);
                handleSearchChange(query, v, year);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Alle Länder" />
              </SelectTrigger>
              <SelectContent>
                {ISSUER_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value || "__all__"}
                    value={opt.value || "__all__"}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="numista-year" className="text-xs">
              Jahr
            </Label>
            <Input
              id="numista-year"
              value={year}
              onChange={(e) => {
                setYear(e.target.value);
                handleSearchChange(query, issuer, e.target.value);
              }}
              placeholder="z.B. 1970"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  performSearch(query, issuer, year);
                }
              }}
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => performSearch(query, issuer, year)}
            disabled={loading || query.length < 2}
          >
            Suchen
          </Button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="ml-2 text-sm">Suche...</span>
            </div>
          )}

          {!loading && results.length === 0 && query.length >= 2 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Keine Ergebnisse gefunden.
            </p>
          )}

          {!loading && results.length > 0 && !selectedDetail && (
            <div className="space-y-1">
              {results.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleSelectType(type.id)}
                  className="flex w-full items-center gap-3 rounded-lg border p-3 text-left hover:bg-accent transition-colors"
                >
                  {type.obverse_thumbnail && (
                    <img
                      src={type.obverse_thumbnail}
                      alt=""
                      className="h-12 w-12 rounded object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-sm">
                      {type.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {type.issuer.name} &middot; {type.min_year}
                      {type.max_year !== type.min_year &&
                        `-${type.max_year}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Detail view */}
          {detailLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="ml-2 text-sm">Lade Details...</span>
            </div>
          )}

          {selectedDetail && !detailLoading && (
            <div className="space-y-4">
              <button
                onClick={() => setSelectedDetail(null)}
                className="text-sm text-primary hover:underline"
              >
                &larr; Zurück zur Suche
              </button>

              <div className="rounded-lg border p-4 space-y-3">
                <h3 className="font-semibold">{selectedDetail.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedDetail.issuer.name} &middot;{" "}
                  {selectedDetail.min_year}
                  {selectedDetail.max_year !== selectedDetail.min_year &&
                    `-${selectedDetail.max_year}`}
                </p>

                <div className="flex gap-4">
                  {selectedDetail.obverse?.thumbnail && (
                    <img
                      src={selectedDetail.obverse.thumbnail}
                      alt="Vorderseite"
                      className="h-24 w-24 rounded object-cover"
                    />
                  )}
                  {selectedDetail.reverse?.thumbnail && (
                    <img
                      src={selectedDetail.reverse.thumbnail}
                      alt="Rückseite"
                      className="h-24 w-24 rounded object-cover"
                    />
                  )}
                </div>

                {/* Prices */}
                {selectedDetail.prices?.prices && selectedDetail.prices.prices.length > 0 && (
                  <div className="rounded bg-green-50 dark:bg-green-950/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                      Preisschätzung ({selectedDetail.prices.currency})
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {selectedDetail.prices.prices.map((p) => (
                        <div key={p.grade} className="text-sm">
                          <span className="text-muted-foreground">{p.grade}: </span>
                          <span className="font-medium">
                            {p.price.toFixed(2)} {selectedDetail.prices!.currency}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Issues / Mintage */}
                {selectedDetail.issues && selectedDetail.issues.length > 0 && (
                  <div className="rounded bg-blue-50 dark:bg-blue-950/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                      Auflagen ({selectedDetail.issues.length} Ausgaben)
                    </p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {selectedDetail.issues.map((issue) => (
                        <div key={issue.id} className="flex justify-between text-sm">
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

                <p className="text-xs font-medium text-muted-foreground uppercase">
                  Wird ins Formular übernommen:
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <DetailField
                    label="Land"
                    value={
                      ISSUER_TO_COUNTRY[selectedDetail.issuer.code] ||
                      selectedDetail.issuer.name
                    }
                  />
                  <DetailField
                    label="Nominal"
                    value={
                      selectedDetail.value?.text || selectedDetail.title
                    }
                  />
                  {selectedDetail.min_year === selectedDetail.max_year && (
                    <DetailField
                      label="Jahr"
                      value={String(selectedDetail.min_year)}
                    />
                  )}
                  <DetailField
                    label="Material"
                    value={selectedDetail.composition?.text}
                  />
                  <DetailField
                    label="Gewicht"
                    value={
                      selectedDetail.weight
                        ? `${selectedDetail.weight} g`
                        : undefined
                    }
                  />
                  <DetailField
                    label="Durchmesser"
                    value={
                      selectedDetail.size
                        ? `${selectedDetail.size} mm`
                        : undefined
                    }
                  />
                  <DetailField
                    label="Rand"
                    value={[
                      selectedDetail.edge?.description,
                      selectedDetail.edge?.lettering,
                    ]
                      .filter(Boolean)
                      .join(" - ") || undefined}
                  />
                  <DetailField
                    label="Serie"
                    value={selectedDetail.series}
                  />
                  <DetailField
                    label="Thema"
                    value={selectedDetail.commemorated_topic}
                  />
                  <DetailField
                    label="Tags"
                    value={selectedDetail.tags?.join(", ")}
                  />
                  <DetailField
                    label="Katalog"
                    value={selectedDetail.references
                      ?.map((r) => `${r.catalogue.code}# ${r.number}`)
                      .join(", ")}
                  />
                  <DetailField
                    label="Auflage"
                    value={
                      selectedDetail.issues?.[0]?.mintage
                        ? selectedDetail.issues[0].mintage.toLocaleString("de-DE")
                        : undefined
                    }
                  />
                  <DetailField
                    label="Dicke"
                    value={
                      selectedDetail.thickness
                        ? `${selectedDetail.thickness} mm`
                        : undefined
                    }
                  />
                  <DetailField label="Form" value={selectedDetail.shape} />
                  <DetailField
                    label="Technik"
                    value={selectedDetail.technique?.text}
                  />
                  <DetailField
                    label="Prägestätten"
                    value={selectedDetail.mints
                      ?.map((m) => m.name)
                      .join(", ")}
                  />
                  <DetailField
                    label="Herrscher"
                    value={selectedDetail.ruler
                      ?.map((r) => r.name)
                      .join(", ")}
                  />
                  {selectedDetail.demonetization?.is_demonetized && (
                    <DetailField
                      label="Demonetisiert"
                      value={
                        selectedDetail.demonetization.demonetization_date ||
                        "Ja"
                      }
                    />
                  )}
                </div>

                <Button onClick={handleConfirmSelection} className="w-full">
                  Daten übernehmen
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailField({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      {value}
    </div>
  );
}

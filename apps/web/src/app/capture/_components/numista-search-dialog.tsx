"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
  autoOpen?: boolean;
}

export function NumistaSearchDialog({
  currentFormData,
  onSelect,
  children,
  autoOpen = false,
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
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const resultsRef = useRef<HTMLDivElement>(null);
  const manuallyClosedRef = useRef(false);

  // Auto-open on mount
  useEffect(() => {
    if (autoOpen && !manuallyClosedRef.current) {
      setOpen(true);
      // Initialize fields from form data
      if (currentFormData) {
        if (currentFormData.denomination) setQuery(currentFormData.denomination);
        if (currentFormData.country) {
          const entry = ISSUER_OPTIONS.find(
            (o) => o.label.toLowerCase() === currentFormData.country!.toLowerCase()
          );
          setIssuer(entry?.value || "");
        }
        if (currentFormData.year) setYear(String(currentFormData.year));
      }
    }
  }, [autoOpen]); // Only on mount, not on currentFormData changes

  // Initialize search fields from current form data when dialog opens
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (isOpen && currentFormData) {
        if (currentFormData.denomination) setQuery(currentFormData.denomination);
        if (currentFormData.country) {
          const entry = ISSUER_OPTIONS.find(
            (o) => o.label.toLowerCase() === currentFormData.country!.toLowerCase()
          );
          setIssuer(entry?.value || "");
        }
        if (currentFormData.year) setYear(String(currentFormData.year));
      }
      if (!isOpen) {
        manuallyClosedRef.current = true;
        setResults([]);
        setSelectedDetail(null);
        setSelectedIndex(-1);
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
      setSelectedIndex(-1);
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

  const buildFormData = useCallback((detail: NumistaDetailResponse): Partial<CoinFormData> => {
    const data: Partial<CoinFormData> = {
      numistaTypeId: detail.id,
      numistaTitle: detail.title,
      numistaUrl: detail.url || "",
    };

    const country =
      ISSUER_TO_COUNTRY[detail.issuer.code] || detail.issuer.name;
    if (country) data.country = country;

    data.denomination = detail.value?.text || detail.title;

    if (detail.min_year && detail.min_year === detail.max_year) {
      data.year = detail.min_year;
    }

    if (detail.weight) data.weight = String(detail.weight);
    if (detail.size) data.diameter = String(detail.size);
    if (detail.thickness) data.thickness = String(detail.thickness);
    if (detail.composition?.text) data.material = detail.composition.text;

    const edgeParts = [detail.edge?.description, detail.edge?.lettering].filter(Boolean);
    if (edgeParts.length > 0) data.edgeType = edgeParts.join(" - ");

    if (detail.tags?.length) data.tags = detail.tags;

    if (detail.shape) data.shape = detail.shape;
    if (detail.orientation) data.orientation = detail.orientation;
    if (detail.technique?.text) data.technique = detail.technique.text;
    if (detail.series) data.series = detail.series;
    if (detail.commemorated_topic) data.commemoratedTopic = detail.commemorated_topic;
    if (detail.demonetization?.is_demonetized) {
      data.isDemonetized = true;
      data.demonetizationDate = detail.demonetization.demonetization_date || "";
    }
    if (detail.comments) {
      data.comments = detail.comments.replace(/<[^>]*>/g, "");
    }

    if (detail.obverse?.thumbnail) data.numistaObverseThumbnail = detail.obverse.thumbnail;
    if (detail.reverse?.thumbnail) data.numistaReverseThumbnail = detail.reverse.thumbnail;

    if (detail.obverse) {
      data.numistaObverse = {
        description: detail.obverse.description,
        lettering: detail.obverse.lettering,
        engravers: detail.obverse.engravers,
      };
    }
    if (detail.reverse) {
      data.numistaReverse = {
        description: detail.reverse.description,
        lettering: detail.reverse.lettering,
        engravers: detail.reverse.engravers,
      };
    }
    if (detail.references?.length) data.numistaReferences = detail.references;
    if (detail.mints?.length) data.numistaMints = detail.mints;
    if (detail.ruler?.length) data.numistaRuler = detail.ruler;
    if (detail.related_types?.length) data.numistaRelatedTypes = detail.related_types;

    if (detail.issues?.length) {
      data.numistaIssues = detail.issues;
      const firstIssue = detail.issues[0];
      if (firstIssue.mintage) data.mintage = String(firstIssue.mintage);
    }

    if (detail.prices?.prices?.length) {
      data.numistaPrices = detail.prices;
      data.estimatedCurrency = detail.prices.currency;

      const gradeOrder = ["G", "VG", "F", "VF", "XF", "AU", "UNC"];
      const lowestGrade = detail.prices.prices
        .map((p) => p.grade)
        .sort((a, b) => gradeOrder.indexOf(a) - gradeOrder.indexOf(b))[0];
      if (lowestGrade) {
        data.condition = lowestGrade;
        const lowestPrice = detail.prices.prices.find((p) => p.grade === lowestGrade);
        data.estimatedValue =
          lowestPrice?.price != null ? Math.round(lowestPrice.price * 100) / 100 : null;
      }
    }

    return data;
  }, []);

  const handleConfirmSelection = useCallback(() => {
    if (!selectedDetail) return;
    onSelect(buildFormData(selectedDetail));
    setOpen(false);
  }, [selectedDetail, onSelect, buildFormData]);

  // Quick-select: fetch detail + take data in one go (Cmd+Enter on result)
  const handleQuickSelect = useCallback(async (typeId: number) => {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/numista/type/${typeId}`);
      if (!response.ok) throw new Error("Detail fetch failed");
      const detail: NumistaDetailResponse = await response.json();
      onSelect(buildFormData(detail));
      setOpen(false);
    } catch {
      // Fall back to showing detail view
    } finally {
      setDetailLoading(false);
    }
  }, [onSelect, buildFormData]);

  // Keyboard navigation in results
  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      // In detail view
      if (selectedDetail && !detailLoading) {
        if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          handleConfirmSelection();
        } else if (e.key === "^" || e.key === "Dead") {
          e.preventDefault();
          setSelectedDetail(null);
        }
        return;
      }

      // In results list (not in input)
      if (results.length > 0 && !loading && !selectedDetail) {
        const tag = (e.target as HTMLElement)?.tagName;
        // Allow typing in inputs, but still handle arrows
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, -1));
        } else if (e.key === "Enter" && selectedIndex >= 0) {
          if (tag === "INPUT") {
            // Enter in input with selection → open details
            e.preventDefault();
            if (e.metaKey || e.ctrlKey) {
              handleQuickSelect(results[selectedIndex].id);
            } else {
              handleSelectType(results[selectedIndex].id);
            }
          } else {
            e.preventDefault();
            if (e.metaKey || e.ctrlKey) {
              handleQuickSelect(results[selectedIndex].id);
            } else {
              handleSelectType(results[selectedIndex].id);
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    open, results, selectedIndex, selectedDetail, detailLoading, loading,
    handleSelectType, handleQuickSelect, handleConfirmSelection,
  ]);

  // Scroll selected result into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const el = resultsRef.current.children[selectedIndex] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Numista-Suche</DialogTitle>
        </DialogHeader>

        {/* Search form */}
        <div className="space-y-2">
          <div>
            <Input
              id="numista-q"
              value={query}
              onChange={(e) =>
                handleSearchChange(e.target.value, issuer, year)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && selectedIndex < 0) {
                  e.preventDefault();
                  performSearch(query, issuer, year);
                }
              }}
              placeholder="z.B. 5 Mark, 10 Euro, 1 Pfennig..."
              autoFocus
            />
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
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
                placeholder="1970"
                className="w-24"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && selectedIndex < 0) {
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
            <div className="space-y-1" ref={resultsRef}>
              {results.map((type, idx) => (
                <button
                  key={type.id}
                  onClick={() => handleSelectType(type.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    idx === selectedIndex
                      ? "bg-accent border-primary"
                      : "hover:bg-accent"
                  }`}
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
              {selectedIndex >= 0 && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  ↵ Details &middot; ⌘↵ Direkt übernehmen
                </p>
              )}
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
                &larr; Zurück zur Suche <kbd className="ml-1 text-[10px] text-muted-foreground border rounded px-1">^</kbd>
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
                  Daten übernehmen <kbd className="ml-1 text-[10px] opacity-60 border rounded px-1">↵</kbd>
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

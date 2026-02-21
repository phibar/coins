"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type {
  NumistaTypePreview,
  NumistaTypeDetail,
  NumistaIssue,
  NumistaPriceResult,
} from "@/lib/numista";
import type { CoinFormData } from "@/types/capture";

interface NumistaDetailResponse extends NumistaTypeDetail {
  issues: NumistaIssue[];
  prices: NumistaPriceResult | null;
}

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

// Canonical grade order (lowest to highest) — matches Numista price grades
const GRADE_ORDER = ["G", "VG", "F", "VF", "XF", "AU", "UNC"];

interface NumistaImageSearchDialogProps {
  frontImageUrl?: string;
  backImageUrl?: string;
  onSelect: (data: Partial<CoinFormData>) => void;
  children: React.ReactNode;
}

async function blobUrlToFile(url: string, name: string): Promise<File> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}

export function NumistaImageSearchDialog({
  frontImageUrl,
  backImageUrl,
  onSelect,
  children,
}: NumistaImageSearchDialogProps) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<NumistaTypePreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tentativeYear, setTentativeYear] = useState<number | null>(null);
  const [tentativeGrade, setTentativeGrade] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] =
    useState<NumistaDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const performImageSearch = useCallback(async () => {
    if (!frontImageUrl) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setTentativeYear(null);
    setTentativeGrade(null);

    try {
      const formData = new FormData();
      const frontFile = await blobUrlToFile(frontImageUrl, "front.jpg");
      formData.append("front", frontFile);

      if (backImageUrl) {
        const backFile = await blobUrlToFile(backImageUrl, "back.jpg");
        formData.append("back", backFile);
      }

      const response = await fetch("/api/numista/search-by-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setResults(data.types || []);
      setTentativeYear(data.experimental_tentative_year ?? null);
      setTentativeGrade(data.experimental_tentative_grade ?? null);

      if ((data.types || []).length === 0) {
        setError("Keine Übereinstimmung gefunden.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Bilderkennung fehlgeschlagen"
      );
    } finally {
      setLoading(false);
    }
  }, [frontImageUrl, backImageUrl]);

  // Auto-search when dialog opens
  useEffect(() => {
    if (open && frontImageUrl) {
      performImageSearch();
    }
    if (!open) {
      setResults([]);
      setSelectedDetail(null);
      setError(null);
      setTentativeYear(null);
      setTentativeGrade(null);
    }
  }, [open, frontImageUrl, performImageSearch]);

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

    // Denomination
    data.denomination = selectedDetail.value?.text || selectedDetail.title;

    // Year: prefer experimental tentative year, then type year if specific
    if (tentativeYear) {
      data.year = tentativeYear;
    } else if (
      selectedDetail.min_year &&
      selectedDetail.min_year === selectedDetail.max_year
    ) {
      data.year = selectedDetail.min_year;
    }

    // Condition from experimental grade (uppercase to match dropdown values)
    if (tentativeGrade) {
      data.condition = tentativeGrade.toUpperCase();
    }

    // Physical properties
    if (selectedDetail.weight) data.weight = String(selectedDetail.weight);
    if (selectedDetail.size) data.diameter = String(selectedDetail.size);
    if (selectedDetail.thickness)
      data.thickness = String(selectedDetail.thickness);
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
    if (selectedDetail.orientation)
      data.orientation = selectedDetail.orientation;
    if (selectedDetail.technique?.text)
      data.technique = selectedDetail.technique.text;
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
      // If we have a tentative year, find matching issue for mintage
      const matchingIssue = tentativeYear
        ? selectedDetail.issues.find((i) => i.year === tentativeYear)
        : null;
      const issueForMintage = matchingIssue || selectedDetail.issues[0];
      if (issueForMintage?.mintage)
        data.mintage = String(issueForMintage.mintage);
    }

    // Prices + estimated value + condition default
    if (selectedDetail.prices?.prices?.length) {
      data.numistaPrices = selectedDetail.prices;
      data.estimatedCurrency = selectedDetail.prices.currency;

      // Set condition to lowest available grade from prices (unless experimental grade already set)
      const lowestGrade = selectedDetail.prices.prices
        .map((p) => p.grade)
        .sort((a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b))[0];
      if (lowestGrade && !data.condition) {
        data.condition = lowestGrade;
      }

      // Use the condition's price as estimated value
      const conditionGrade = data.condition || lowestGrade;
      const matchingPrice = selectedDetail.prices.prices.find(
        (p) => p.grade === conditionGrade
      );
      const rawPrice = matchingPrice?.price ?? null;
      data.estimatedValue =
        rawPrice != null ? Math.round(rawPrice * 100) / 100 : null;
    }

    onSelect(data);
    setOpen(false);
  }, [selectedDetail, tentativeYear, tentativeGrade, onSelect]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Numista Bilderkennung</DialogTitle>
        </DialogHeader>

        {/* Experimental data banner */}
        {(tentativeYear || tentativeGrade) && !selectedDetail && (
          <div className="rounded bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Experimentelle Erkennung:
            </p>
            <div className="flex gap-4 mt-1">
              {tentativeYear && (
                <span>
                  Jahr:{" "}
                  <span className="font-medium">{tentativeYear}</span>
                </span>
              )}
              {tentativeGrade && (
                <span>
                  Erhaltung:{" "}
                  <span className="font-medium uppercase">
                    {tentativeGrade}
                  </span>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="ml-2 text-sm">Bilderkennung läuft...</span>
            </div>
          )}

          {error && !loading && (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={performImageSearch}
              >
                Nochmal versuchen
              </Button>
            </div>
          )}

          {!loading && !error && results.length > 0 && !selectedDetail && (
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
                &larr; Zurück zur Ergebnisliste
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
                {selectedDetail.prices?.prices &&
                  selectedDetail.prices.prices.length > 0 && (
                    <div className="rounded bg-green-50 dark:bg-green-950/30 p-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                        Preisschätzung ({selectedDetail.prices.currency})
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {selectedDetail.prices.prices.map((p) => (
                          <div key={p.grade} className="text-sm">
                            <span className="text-muted-foreground">
                              {p.grade}:{" "}
                            </span>
                            <span className="font-medium">
                              {p.price.toFixed(2)}{" "}
                              {selectedDetail.prices!.currency}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Experimental year/grade info */}
                {(tentativeYear || tentativeGrade) && (
                  <div className="rounded bg-amber-50 dark:bg-amber-950/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                      Experimentelle Erkennung
                    </p>
                    <div className="flex gap-4 text-sm">
                      {tentativeYear && (
                        <span>
                          Jahr:{" "}
                          <span className="font-medium">{tentativeYear}</span>
                        </span>
                      )}
                      {tentativeGrade && (
                        <span>
                          Erhaltung:{" "}
                          <span className="font-medium uppercase">
                            {tentativeGrade}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                )}

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

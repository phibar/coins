"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const CONDITION_OPTIONS = [
  { value: "G", label: "G - Good" },
  { value: "VG", label: "VG - Very Good" },
  { value: "F", label: "F - Fine" },
  { value: "VF", label: "VF - Very Fine" },
  { value: "XF", label: "XF - Extra Fine" },
  { value: "AU", label: "AU - About Unc." },
  { value: "UNC", label: "UNC - Uncirculated" },
  { value: "PROOF", label: "PROOF - Pol. Platte" },
];

interface FilterBarProps {
  countries: string[];
  denominations: string[];
  collections: { id: string; name: string }[];
  materials: string[];
  mintMarks: string[];
  series: string[];
  storageLocations: string[];
  currentFilters: Record<string, string | undefined>;
}

export function FilterBar({
  countries,
  denominations,
  collections,
  materials,
  mintMarks,
  series,
  storageLocations,
  currentFilters,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [showAdvanced, setShowAdvanced] = useState(() =>
    Boolean(
      currentFilters.material ||
        currentFilters.mintMark ||
        currentFilters.series ||
        currentFilters.storageLocation ||
        currentFilters.isProof ||
        currentFilters.hasCase ||
        currentFilters.hasCertificate
    )
  );
  const [manageOpen, setManageOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const updateFilter = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(currentFilters)) {
        if (v && k !== "page" && k !== key) params.set(k, v);
      }
      if (value) params.set(key, value);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [currentFilters, router, pathname]
  );

  const clearFilters = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  const hasFilters = Object.entries(currentFilters).some(
    ([k, v]) => v && k !== "page"
  );

  const advancedFilterCount = [
    currentFilters.material,
    currentFilters.mintMark,
    currentFilters.series,
    currentFilters.storageLocation,
    currentFilters.isProof,
    currentFilters.hasCase,
    currentFilters.hasCertificate,
  ].filter(Boolean).length;

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCollectionName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Anlegen");
        return;
      }
      toast.success("Sammlung angelegt");
      setNewCollectionName("");
      router.refresh();
    } catch {
      toast.error("Fehler beim Anlegen");
    }
  };

  const handleRenameCollection = async (id: string) => {
    if (!editingName.trim()) return;
    try {
      const res = await fetch(`/api/collections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Umbenennen");
        return;
      }
      toast.success("Sammlung umbenannt");
      setEditingId(null);
      router.refresh();
    } catch {
      toast.error("Fehler beim Umbenennen");
    }
  };

  const handleDeleteCollection = async (id: string, name: string) => {
    if (!confirm(`Sammlung "${name}" wirklich löschen? Münzen bleiben erhalten.`))
      return;
    try {
      const res = await fetch(`/api/collections/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Fehler beim Löschen");
        return;
      }
      toast.success("Sammlung gelöscht");
      if (currentFilters.collectionId === id) {
        updateFilter("collectionId", undefined);
      }
      router.refresh();
    } catch {
      toast.error("Fehler beim Löschen");
    }
  };

  return (
    <div className="mb-6 space-y-3">
      {/* Row 1: Main filters */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Free-text search */}
        <div className="w-64">
          <Input
            placeholder="Suche..."
            defaultValue={currentFilters.q || ""}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateFilter(
                  "q",
                  (e.target as HTMLInputElement).value || undefined
                );
              }
            }}
          />
        </div>

        {/* Country filter */}
        <Select
          value={currentFilters.country || "all"}
          onValueChange={(val) =>
            updateFilter("country", val === "all" ? undefined : val)
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Land" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Länder</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Denomination filter */}
        <Select
          value={currentFilters.denomination || "all"}
          onValueChange={(val) =>
            updateFilter("denomination", val === "all" ? undefined : val)
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Nominal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Nominale</SelectItem>
            {denominations.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Year filter */}
        <div className="w-28">
          <Input
            type="number"
            placeholder="Jahr"
            defaultValue={currentFilters.year || ""}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                updateFilter(
                  "year",
                  (e.target as HTMLInputElement).value || undefined
                );
              }
            }}
          />
        </div>

        {/* Condition filter */}
        <Select
          value={currentFilters.condition || "all"}
          onValueChange={(val) =>
            updateFilter("condition", val === "all" ? undefined : val)
          }
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Erhaltung" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Erhaltungen</SelectItem>
            {CONDITION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Collection filter */}
        <div className="flex items-end gap-1">
          <Select
            value={currentFilters.collectionId || "all"}
            onValueChange={(val) =>
              updateFilter("collectionId", val === "all" ? undefined : val)
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Sammlung" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Sammlungen</SelectItem>
              {collections.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={manageOpen} onOpenChange={setManageOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0" title="Sammlungen verwalten">
                ...
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Sammlungen verwalten</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Create new */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Neue Sammlung..."
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateCollection();
                    }}
                  />
                  <Button
                    onClick={handleCreateCollection}
                    disabled={!newCollectionName.trim()}
                    className="shrink-0"
                  >
                    Anlegen
                  </Button>
                </div>

                {/* List */}
                {collections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Noch keine Sammlungen vorhanden.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {collections.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 rounded-md border px-3 py-2"
                      >
                        {editingId === c.id ? (
                          <>
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameCollection(c.id);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              className="h-8"
                              autoFocus
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 shrink-0"
                              onClick={() => handleRenameCollection(c.id)}
                            >
                              OK
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 shrink-0"
                              onClick={() => setEditingId(null)}
                            >
                              X
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm">{c.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                setEditingId(c.id);
                                setEditingName(c.name);
                              }}
                            >
                              Umbenennen
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                              onClick={() => handleDeleteCollection(c.id, c.name)}
                            >
                              Löschen
                            </Button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Advanced toggle + reset */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          Erweitert
          {advancedFilterCount > 0 && ` (${advancedFilterCount})`}
        </Button>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Filter zurücksetzen
          </Button>
        )}
      </div>

      {/* Row 2: Advanced filters */}
      {showAdvanced && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
          {/* Material */}
          {materials.length > 0 && (
            <Select
              value={currentFilters.material || "all"}
              onValueChange={(val) =>
                updateFilter("material", val === "all" ? undefined : val)
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Material" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Materialien</SelectItem>
                {materials.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Mint Mark */}
          {mintMarks.length > 0 && (
            <Select
              value={currentFilters.mintMark || "all"}
              onValueChange={(val) =>
                updateFilter("mintMark", val === "all" ? undefined : val)
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Prägeanstalt" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Prägeanstalten</SelectItem>
                {mintMarks.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Series */}
          {series.length > 0 && (
            <Select
              value={currentFilters.series || "all"}
              onValueChange={(val) =>
                updateFilter("series", val === "all" ? undefined : val)
              }
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Serie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Serien</SelectItem>
                {series.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Storage Location */}
          {storageLocations.length > 0 && (
            <Select
              value={currentFilters.storageLocation || "all"}
              onValueChange={(val) =>
                updateFilter(
                  "storageLocation",
                  val === "all" ? undefined : val
                )
              }
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Lagerort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Lagerorte</SelectItem>
                {storageLocations.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Boolean filters */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Checkbox
                id="filter-proof"
                checked={currentFilters.isProof === "true"}
                onCheckedChange={(checked) =>
                  updateFilter("isProof", checked ? "true" : undefined)
                }
              />
              <Label htmlFor="filter-proof" className="text-sm">
                PP
              </Label>
            </div>
            <div className="flex items-center gap-1.5">
              <Checkbox
                id="filter-case"
                checked={currentFilters.hasCase === "true"}
                onCheckedChange={(checked) =>
                  updateFilter("hasCase", checked ? "true" : undefined)
                }
              />
              <Label htmlFor="filter-case" className="text-sm">
                Etui
              </Label>
            </div>
            <div className="flex items-center gap-1.5">
              <Checkbox
                id="filter-cert"
                checked={currentFilters.hasCertificate === "true"}
                onCheckedChange={(checked) =>
                  updateFilter("hasCertificate", checked ? "true" : undefined)
                }
              />
              <Label htmlFor="filter-cert" className="text-sm">
                Dokumente
              </Label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

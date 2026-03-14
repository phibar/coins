"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GERMAN_MINT_MARKS } from "@/types/coin-set";
import type { CoinSetSessionConfig, CoinSetType } from "@/types/coin-set";
import { loadLastConfig } from "@/hooks/use-coin-set-session";
import type { CollectionWithImages } from "./coin-form";

const CONDITION_OPTIONS = [
  { value: "G", label: "G - Good" },
  { value: "VG", label: "VG - Very Good" },
  { value: "F", label: "F - Fine" },
  { value: "VF", label: "VF - Very Fine" },
  { value: "XF", label: "XF - Extra Fine" },
  { value: "AU", label: "AU - About Uncirculated" },
  { value: "UNC", label: "UNC - Uncirculated" },
  { value: "PROOF", label: "PROOF - Polierte Platte" },
];

interface CoinSetSetupProps {
  collections: CollectionWithImages[];
  onStart: (config: CoinSetSessionConfig) => void;
  onCancel: () => void;
}

export function CoinSetSetup({
  collections,
  onStart,
  onCancel,
}: CoinSetSetupProps) {
  const lastConfig = loadLastConfig();

  const [year, setYear] = useState<number | "">(lastConfig?.year ?? "");
  const [country, setCountry] = useState(lastConfig?.country ?? "Deutschland");
  const [selectedMints, setSelectedMints] = useState<Set<string>>(
    new Set(lastConfig?.mintMarks ?? GERMAN_MINT_MARKS)
  );
  const [condition, setCondition] = useState(lastConfig?.condition ?? "UNC");
  const [isProof, setIsProof] = useState(lastConfig?.isProof ?? false);
  const [hasCase, setHasCase] = useState(lastConfig?.hasCase ?? false);
  const [collectionId, setCollectionId] = useState<string | null>(
    lastConfig?.collectionId ?? null
  );
  const [storageLocation, setStorageLocation] = useState(
    lastConfig?.storageLocation ?? ""
  );

  const setType: CoinSetType | null =
    year !== "" ? (year < 2002 ? "dm" : "euro") : null;
  const isGerman = country === "Deutschland";
  const showMintMarks = isGerman;

  // When proof is toggled, sync condition
  useEffect(() => {
    if (isProof && condition !== "PROOF") setCondition("PROOF");
    if (!isProof && condition === "PROOF") setCondition("UNC");
  }, [isProof, condition]);

  const toggleMint = useCallback((mark: string) => {
    setSelectedMints((prev) => {
      const next = new Set(prev);
      if (next.has(mark)) next.delete(mark);
      else next.add(mark);
      return next;
    });
  }, []);

  const handleStart = useCallback(() => {
    if (year === "") return;
    const mintMarks = showMintMarks
      ? GERMAN_MINT_MARKS.filter((m) => selectedMints.has(m))
      : [""];
    if (mintMarks.length === 0) return;

    const config: CoinSetSessionConfig = {
      year,
      setType: setType!,
      country,
      isGerman,
      mintMarks,
      condition,
      isProof,
      hasCase,
      collectionId,
      storageLocation,
    };
    onStart(config);
  }, [
    year,
    setType,
    country,
    isGerman,
    showMintMarks,
    selectedMints,
    condition,
    isProof,
    hasCase,
    collectionId,
    storageLocation,
    onStart,
  ]);

  const canStart = year !== "" && (showMintMarks ? selectedMints.size > 0 : true);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Kursmünzsatz</h2>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Abbrechen
        </Button>
      </div>

      {/* Year + auto-detection */}
      <div className="space-y-2">
        <Label htmlFor="kms-year">Jahr</Label>
        <div className="flex items-center gap-3">
          <Input
            id="kms-year"
            type="number"
            value={year}
            onChange={(e) =>
              setYear(e.target.value ? parseInt(e.target.value) : "")
            }
            placeholder="z.B. 1998"
            className="w-32"
            autoFocus
          />
          {setType && (
            <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium">
              {setType === "dm" ? "DM-Satz" : "Euro-Satz"}
            </span>
          )}
        </div>
      </div>

      {/* Country (only for Euro) */}
      {setType === "euro" && (
        <div className="space-y-2">
          <Label htmlFor="kms-country">Land</Label>
          <Input
            id="kms-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="z.B. Deutschland"
          />
        </div>
      )}

      {/* Mint marks (only for Germany) */}
      {showMintMarks && (
        <div className="space-y-2">
          <Label>Prägezeichen</Label>
          <div className="flex gap-2">
            {GERMAN_MINT_MARKS.map((mark) => (
              <button
                key={mark}
                type="button"
                onClick={() => toggleMint(mark)}
                className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-bold transition-colors ${
                  selectedMints.has(mark)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {mark}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Condition + Proof + Case */}
      <div className="space-y-3">
        <div>
          <Label>Erhaltung</Label>
          <Select
            value={condition}
            onValueChange={(val) => {
              setCondition(val);
              setIsProof(val === "PROOF");
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="kms-proof"
              checked={isProof}
              onCheckedChange={(checked) => {
                const val = checked === true;
                setIsProof(val);
                if (val) setCondition("PROOF");
                else if (condition === "PROOF") setCondition("UNC");
              }}
            />
            <Label htmlFor="kms-proof">Polierte Platte</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="kms-case"
              checked={hasCase}
              onCheckedChange={(checked) => setHasCase(checked === true)}
            />
            <Label htmlFor="kms-case">Etui</Label>
          </div>
        </div>
      </div>

      {/* Collection */}
      <div className="space-y-2">
        <Label>Sammlung</Label>
        <Select
          value={collectionId || "none"}
          onValueChange={(val) => setCollectionId(val === "none" ? null : val)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Keine Sammlung" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Keine Sammlung</SelectItem>
            {collections.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Storage location */}
      <div className="space-y-2">
        <Label htmlFor="kms-storage">Lagerort</Label>
        <Input
          id="kms-storage"
          value={storageLocation}
          onChange={(e) => setStorageLocation(e.target.value)}
          placeholder="z.B. Ordner 3, Seite 7"
        />
      </div>

      {/* Start button */}
      <Button onClick={handleStart} disabled={!canStart} className="w-full">
        Starten
        {canStart && showMintMarks && (
          <span className="ml-2 text-xs opacity-75">
            ({selectedMints.size} Prägezeichen)
          </span>
        )}
      </Button>
    </div>
  );
}

"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { GridConfig, FlipMode } from "@/types/capture";

interface GridConfigPanelProps {
  config: GridConfig;
  flipMode: FlipMode;
  onConfigChange: (config: GridConfig) => void;
  onFlipModeChange: (mode: FlipMode) => void;
  onConfirm: () => void;
  onCancel: () => void;
  coinCount: number;
}

export function GridConfigPanel({
  config,
  flipMode,
  onConfigChange,
  onFlipModeChange,
  onConfirm,
  onCancel,
  coinCount,
}: GridConfigPanelProps) {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <h3 className="font-semibold">Grid-Konfiguration</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="grid-rows">Zeilen</Label>
          <Input
            id="grid-rows"
            type="number"
            min={1}
            max={20}
            value={config.rows}
            onChange={(e) =>
              onConfigChange({
                ...config,
                rows: Math.max(1, parseInt(e.target.value) || 1),
                emptySlots: [],
              })
            }
          />
        </div>
        <div>
          <Label htmlFor="grid-cols">Spalten</Label>
          <Input
            id="grid-cols"
            type="number"
            min={1}
            max={20}
            value={config.cols}
            onChange={(e) =>
              onConfigChange({
                ...config,
                cols: Math.max(1, parseInt(e.target.value) || 1),
                emptySlots: [],
              })
            }
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Wendemodus</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={flipMode === "book" ? "default" : "outline"}
            onClick={() => onFlipModeChange("book")}
          >
            Buch-Flip
          </Button>
          <Button
            type="button"
            size="sm"
            variant={flipMode === "turn" ? "default" : "outline"}
            onClick={() => onFlipModeChange("turn")}
          >
            Nur drehen
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {flipMode === "book"
            ? "Seite wird wie ein Buch umgeblättert (horizontal gespiegelt)."
            : "Jede Münze wird einzeln gedreht (keine Spiegelung)."}
        </p>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>
          {config.rows} × {config.cols} = {config.rows * config.cols} Felder
        </p>
        {config.emptySlots.length > 0 && (
          <p>{config.emptySlots.length} leer markiert</p>
        )}
        <p className="font-medium text-foreground">
          {coinCount} Münzen werden erkannt
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Klicke auf ein Feld im Grid um es als leer zu markieren.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onConfirm} disabled={coinCount === 0}>
          Bestätigen
          <kbd className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded border border-border/50 bg-muted/50 px-1 text-[10px] font-mono text-muted-foreground">
            ↵
          </kbd>
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Neu aufnehmen
          <kbd className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded border border-border/50 bg-muted/50 px-1 text-[10px] font-mono text-muted-foreground">
            ^
          </kbd>
        </Button>
      </div>
    </div>
  );
}

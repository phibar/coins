"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { GridConfig } from "@/types/capture";

interface GridConfigPanelProps {
  config: GridConfig;
  onConfigChange: (config: GridConfig) => void;
  onConfirm: () => void;
  onCancel: () => void;
  coinCount: number;
}

export function GridConfigPanel({
  config,
  onConfigChange,
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

      <div className="flex gap-2">
        <Button onClick={onConfirm} disabled={coinCount === 0}>
          Vorderseite bestätigen
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}

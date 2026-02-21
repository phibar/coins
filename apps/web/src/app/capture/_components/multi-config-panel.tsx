"use client";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { FlipMode } from "@/types/capture";

interface MultiConfigPanelProps {
  cropCount: number;
  flipMode: FlipMode;
  onFlipModeChange: (mode: FlipMode) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onAutoDetect?: () => void;
  autoDetecting?: boolean;
  onDeleteSelected: () => void;
  hasSelection: boolean;
}

export function MultiConfigPanel({
  cropCount,
  flipMode,
  onFlipModeChange,
  onConfirm,
  onCancel,
  onAutoDetect,
  autoDetecting,
  onDeleteSelected,
  hasSelection,
}: MultiConfigPanelProps) {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <h3 className="font-semibold">Multi-Auswahl</h3>

      <div className="text-sm text-muted-foreground">
        <p className="font-medium text-foreground">
          {cropCount} {cropCount === 1 ? "Münze" : "Münzen"} markiert
        </p>
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

      <p className="text-xs text-muted-foreground">
        Zeichne Ausschnitte um jede Münze. Klicke zum Auswählen, Entf zum
        Löschen.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onConfirm} disabled={cropCount === 0}>
          Bestätigen
          <kbd className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded border border-border/50 bg-muted/50 px-1 text-[10px] font-mono text-muted-foreground">
            ↵
          </kbd>
        </Button>
        {onAutoDetect && (
          <Button
            variant="secondary"
            onClick={onAutoDetect}
            disabled={autoDetecting}
          >
            {autoDetecting ? (
              "Erkennung..."
            ) : (
              <>
                Auto-Erkennung
                <kbd className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded border border-border/50 bg-muted/50 px-1 text-[10px] font-mono text-muted-foreground">
                  A
                </kbd>
              </>
            )}
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={onDeleteSelected}
          disabled={!hasSelection}
        >
          Löschen
          <kbd className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded border border-border/50 bg-muted/50 px-1 text-[10px] font-mono text-muted-foreground">
            Entf
          </kbd>
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Neu aufnehmen
          <kbd className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded border border-border/50 bg-muted/50 px-1 text-[10px] font-mono text-muted-foreground">
            Esc
          </kbd>
        </Button>
      </div>
    </div>
  );
}

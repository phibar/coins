"use client";

import { Button } from "@/components/ui/button";
import type { CoinSetSessionState } from "@/types/coin-set";

interface CoinSetProgressProps {
  state: CoinSetSessionState;
  onSkip: () => void;
  onCancel: () => void;
}

export function CoinSetProgress({ state, onSkip, onCancel }: CoinSetProgressProps) {
  if (!state.config) return null;

  const { config, currentMintIndex, completedMints } = state;
  const setLabel = config.setType === "dm" ? "DM-Satz" : "Euro-Satz";
  const allDone = currentMintIndex >= config.mintMarks.length;

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2">
      <span className="text-sm font-semibold">
        {config.year} {setLabel}
      </span>

      {/* Mint mark badges */}
      {config.mintMarks.length > 1 && (
        <div className="flex gap-1">
          {config.mintMarks.map((mark, idx) => {
            const isCompleted = completedMints.includes(mark);
            const isCurrent = idx === currentMintIndex && !allDone;
            return (
              <span
                key={mark}
                className={`flex h-7 w-7 items-center justify-center rounded text-xs font-bold ${
                  isCompleted
                    ? "bg-green-500/20 text-green-700 dark:text-green-400"
                    : isCurrent
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {mark}
              </span>
            );
          })}
        </div>
      )}

      <div className="ml-auto flex gap-2">
        {!allDone && config.mintMarks.length > 1 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onSkip}>
            Überspringen
            <kbd className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded border border-border/50 bg-muted/50 px-0.5 text-[9px] font-mono text-muted-foreground">
              ⇥
            </kbd>
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancel}>
          Abbrechen
          <kbd className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded border border-border/50 bg-muted/50 px-0.5 text-[9px] font-mono text-muted-foreground">
            Esc
          </kbd>
        </Button>
      </div>
    </div>
  );
}

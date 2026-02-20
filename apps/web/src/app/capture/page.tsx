"use client";

import { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCaptureSession } from "@/hooks/use-capture-session";
import { PhotoCanvas } from "./_components/photo-canvas";
import { GridCanvas } from "./_components/grid-canvas";
import { GridConfigPanel } from "./_components/grid-config-panel";
import { CoinForm } from "./_components/coin-form";
import type { CoinFormData, CropRect } from "@/types/capture";
import { toast } from "sonner";

export default function CapturePage() {
  const { state, dispatch, capturePhoto, captureBackPhoto, loadTestImage } = useCaptureSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) loadTestImage(file);
    },
    [loadTestImage]
  );

  const handleBackFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (state.mode === "single") {
        // Single coin: load directly without flipping, need dimensions
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          dispatch({
            type: "SINGLE_BACK_COMPLETE",
            photo: url,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        };
        img.src = url;
        return;
      }

      // Grid mode: flip the back image for grid alignment
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const arrayBuffer = reader.result as ArrayBuffer;
          const response = await fetch("/api/images/flip", {
            method: "POST",
            body: arrayBuffer,
            headers: { "Content-Type": "application/octet-stream" },
          });

          if (!response.ok) throw new Error("Flip failed");

          const flippedBlob = await response.blob();
          const url = URL.createObjectURL(flippedBlob);

          dispatch({ type: "BACK_CAPTURE_COMPLETE", photo: url });
          toast.success("Rückseite geladen und gespiegelt");
        } catch {
          toast.error("Fehler beim Laden der Rückseite");
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [dispatch, state.mode]
  );

  const handleCaptureBack = useCallback(async () => {
    dispatch({ type: "START_BACK_CAPTURE" });
    try {
      const response = await fetch("/api/camera/capture", { method: "POST" });
      if (!response.ok) throw new Error("Capture failed");

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      // Flip the back image
      const flipResponse = await fetch("/api/images/flip", {
        method: "POST",
        body: arrayBuffer,
        headers: { "Content-Type": "application/octet-stream" },
      });

      if (!flipResponse.ok) throw new Error("Flip failed");

      const flippedBlob = await flipResponse.blob();
      const url = URL.createObjectURL(flippedBlob);

      dispatch({ type: "BACK_CAPTURE_COMPLETE", photo: url });
    } catch {
      toast.error("Fehler beim Aufnehmen der Rückseite");
      dispatch({ type: "CAPTURE_FAILED" });
    }
  }, [dispatch]);

  const handleCropChange = useCallback(
    (crop: CropRect) => {
      dispatch({ type: "SET_SINGLE_CROP", crop });
    },
    [dispatch]
  );

  const handleBackCropChange = useCallback(
    (crop: CropRect) => {
      dispatch({ type: "SET_SINGLE_BACK_CROP", crop });
    },
    [dispatch]
  );

  const handleSaveCoin = useCallback(
    async (formData: CoinFormData) => {
      dispatch({ type: "SAVE_COIN" });

      try {
        const currentCoin = state.coins[state.currentCoinIndex];
        let frontImageBase64: string | null = null;
        let backImageBase64: string | null = null;

        if (state.frontPhoto) {
          const response = await fetch(state.frontPhoto);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          frontImageBase64 = btoa(
            new Uint8Array(arrayBuffer).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              ""
            )
          );
        }

        if (state.backPhoto) {
          const response = await fetch(state.backPhoto);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          backImageBase64 = btoa(
            new Uint8Array(arrayBuffer).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              ""
            )
          );
        }

        const res = await fetch("/api/coins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            formData,
            frontImageBase64,
            backImageBase64,
            frontCrop: currentCoin?.frontCrop,
            backCrop: currentCoin?.backCrop,
          }),
        });

        if (!res.ok) throw new Error("Save failed");

        toast.success("Münze gespeichert!");
        dispatch({ type: "SET_SESSION_DEFAULTS", defaults: formData });
        dispatch({ type: "COIN_SAVED" });
      } catch {
        toast.error("Fehler beim Speichern");
        dispatch({ type: "CAPTURE_FAILED" });
      }
    },
    [state, dispatch]
  );

  const gridCoinCount =
    state.gridConfig
      ? state.gridConfig.rows * state.gridConfig.cols -
        state.gridConfig.emptySlots.length
      : 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Münzen erfassen</h1>

      {/* Step: Idle */}
      {state.step === "idle" && (
        <div className="flex gap-4">
          <Button size="lg" onClick={capturePhoto}>
            Foto aufnehmen
          </Button>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              size="lg"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Bild laden (Test)
            </Button>
          </div>
        </div>
      )}

      {/* Step: Capturing */}
      {state.step === "capturing" && (
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Foto wird aufgenommen...</span>
        </div>
      )}

      {/* Step: Select mode */}
      {state.step === "select_mode" && (
        <div className="space-y-6">
          <div className="flex gap-4">
            <Button
              size="lg"
              onClick={() =>
                dispatch({ type: "SELECT_MODE", mode: "single" })
              }
            >
              Einzelmünze
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() =>
                dispatch({ type: "SELECT_MODE", mode: "grid" })
              }
            >
              Grid / Münzseite
            </Button>
          </div>
          {state.frontPhoto && (
            <img
              src={state.frontPhoto}
              alt="Aufnahme"
              className="max-h-96 rounded-lg border"
            />
          )}
        </div>
      )}

      {/* Step: Single crop */}
      {state.step === "single_crop" &&
        state.frontPhoto &&
        state.singleCrop && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ausschnitt wählen</h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => dispatch({ type: "RESET" })}
                >
                  Abbrechen
                </Button>
                <Button
                  onClick={() =>
                    dispatch({ type: "CONFIRM_SINGLE_CROP" })
                  }
                >
                  Bestätigen
                </Button>
              </div>
            </div>
            <PhotoCanvas
              imageSrc={state.frontPhoto}
              imageWidth={state.imageWidth}
              imageHeight={state.imageHeight}
              crop={state.singleCrop}
              onCropChange={handleCropChange}
            />
            <p className="text-sm text-muted-foreground">
              Ziehe den Ausschnitt über die Münze. Ecken zum
              Vergrößern/Verkleinern.
            </p>
          </div>
        )}

      {/* Step: Single back capture */}
      {state.step === "single_back_capture" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Rückseite aufnehmen</h2>
          <p className="text-muted-foreground">
            Drehe die Münze um und nehme ein Foto der Rückseite auf.
          </p>
          <div className="flex gap-4">
            <Button size="lg" onClick={captureBackPhoto}>
              Rückseite fotografieren
            </Button>
            <div>
              <input
                ref={backFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleBackFileUpload}
                className="hidden"
              />
              <Button
                size="lg"
                variant="outline"
                onClick={() => backFileInputRef.current?.click()}
              >
                Bild laden (Test)
              </Button>
            </div>
            <Button
              variant="ghost"
              onClick={() => dispatch({ type: "SKIP_SINGLE_BACK" })}
            >
              Ohne Rückseite fortfahren
            </Button>
          </div>
          {state.frontPhoto && (
            <div>
              <p className="mb-2 text-sm text-muted-foreground">
                Vorderseite (Referenz):
              </p>
              <img
                src={state.frontPhoto}
                alt="Vorderseite"
                className="max-h-64 rounded-lg border"
              />
            </div>
          )}
        </div>
      )}

      {/* Step: Single back crop */}
      {state.step === "single_back_crop" &&
        state.backPhoto &&
        state.singleBackCrop && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Rückseite: Ausschnitt wählen
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => dispatch({ type: "SKIP_SINGLE_BACK" })}
                >
                  Ohne Rückseite
                </Button>
                <Button
                  onClick={() =>
                    dispatch({ type: "CONFIRM_SINGLE_BACK_CROP" })
                  }
                >
                  Bestätigen
                </Button>
              </div>
            </div>
            <PhotoCanvas
              imageSrc={state.backPhoto}
              imageWidth={state.backImageWidth}
              imageHeight={state.backImageHeight}
              crop={state.singleBackCrop}
              onCropChange={handleBackCropChange}
            />
            <p className="text-sm text-muted-foreground">
              Ziehe den Ausschnitt über die Rückseite der Münze.
            </p>
          </div>
        )}

      {/* Step: Grid config */}
      {state.step === "grid_config" &&
        state.frontPhoto &&
        state.gridConfig &&
        state.gridOverlay && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Grid platzieren</h2>
            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
              <GridCanvas
                imageSrc={state.frontPhoto}
                imageWidth={state.imageWidth}
                imageHeight={state.imageHeight}
                gridConfig={state.gridConfig}
                overlay={state.gridOverlay}
                onOverlayChange={(overlay) =>
                  dispatch({ type: "SET_GRID_OVERLAY", overlay })
                }
                onToggleEmptySlot={(slotIndex) =>
                  dispatch({ type: "TOGGLE_GRID_EMPTY_SLOT", slotIndex })
                }
              />
              <GridConfigPanel
                config={state.gridConfig}
                onConfigChange={(config) =>
                  dispatch({ type: "SET_GRID_CONFIG", config })
                }
                onConfirm={() => dispatch({ type: "CONFIRM_GRID_FRONT" })}
                onCancel={() => dispatch({ type: "RESET" })}
                coinCount={gridCoinCount}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Verschiebe und skaliere das Grid. Klicke auf leere Felder um sie
              zu markieren.
            </p>
          </div>
        )}

      {/* Step: Grid back capture */}
      {state.step === "grid_back_capture" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">
            Rückseite aufnehmen
          </h2>
          <p className="text-muted-foreground">
            Drehe die Münzseite wie ein Buch um und nehme ein Foto der
            Rückseiten auf. Das Bild wird automatisch gespiegelt, damit die
            Positionen übereinstimmen.
          </p>
          <div className="flex gap-4">
            <Button size="lg" onClick={handleCaptureBack}>
              Rückseite fotografieren
            </Button>
            <div>
              <input
                ref={backFileInputRef}
                type="file"
                accept="image/*"
                onChange={handleBackFileUpload}
                className="hidden"
              />
              <Button
                size="lg"
                variant="outline"
                onClick={() => backFileInputRef.current?.click()}
              >
                Bild laden (Test)
              </Button>
            </div>
            <Button
              variant="ghost"
              onClick={() => dispatch({ type: "SKIP_BACK_CAPTURE" })}
            >
              Ohne Rückseite fortfahren
            </Button>
          </div>
          {state.frontPhoto && (
            <div>
              <p className="mb-2 text-sm text-muted-foreground">
                Vorderseite (Referenz):
              </p>
              <img
                src={state.frontPhoto}
                alt="Vorderseite"
                className="max-h-64 rounded-lg border"
              />
            </div>
          )}
        </div>
      )}

      {/* Step: Grid back crop (confirm back side matches) */}
      {state.step === "grid_back_crop" && state.backPhoto && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Rückseite überprüfen
          </h2>
          <p className="text-muted-foreground">
            Das Bild wurde gespiegelt. Überprüfe, ob die Positionen zur
            Vorderseite passen.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">Vorderseite</p>
              {state.frontPhoto && (
                <img
                  src={state.frontPhoto}
                  alt="Vorderseite"
                  className="max-h-80 rounded-lg border"
                />
              )}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">
                Rückseite (gespiegelt)
              </p>
              <img
                src={state.backPhoto}
                alt="Rückseite"
                className="max-h-80 rounded-lg border"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => dispatch({ type: "CONFIRM_GRID_BACK" })}>
              Bestätigen & Münzen bearbeiten
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                dispatch({ type: "RETAKE_BACK" })
              }
            >
              Nochmal aufnehmen
            </Button>
          </div>
        </div>
      )}

      {/* Step: Coin entry */}
      {state.step === "coin_entry" && (
        <div className="grid gap-8 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>
                Münzdaten erfassen
                {state.coins.length > 1 && (
                  <span className="ml-2 text-base font-normal text-muted-foreground">
                    ({state.currentCoinIndex + 1} / {state.coins.length})
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CoinForm
                key={state.currentCoinIndex}
                defaults={state.sessionDefaults}
                onSave={handleSaveCoin}
                onSkip={
                  state.coins.length > 1
                    ? () => dispatch({ type: "COIN_SAVED" })
                    : undefined
                }
                coinIndex={state.currentCoinIndex}
                totalCoins={state.coins.length}
                saving={false}
              />
            </CardContent>
          </Card>
          <div className="space-y-4">
            {state.frontPhoto && (
              <div>
                <p className="mb-2 text-sm font-medium">Vorderseite</p>
                <img
                  src={state.frontPhoto}
                  alt="Vorderseite"
                  className="rounded-lg border"
                  style={{ maxHeight: 300 }}
                />
              </div>
            )}
            {state.backPhoto && (
              <div>
                <p className="mb-2 text-sm font-medium">Rückseite</p>
                <img
                  src={state.backPhoto}
                  alt="Rückseite"
                  className="rounded-lg border"
                  style={{ maxHeight: 300 }}
                />
              </div>
            )}
            {state.coins.length > 1 && state.coins[state.currentCoinIndex] && (
              <div className="text-sm text-muted-foreground">
                Position: Zeile{" "}
                {(state.coins[state.currentCoinIndex].gridRow ?? 0) + 1},
                Spalte{" "}
                {(state.coins[state.currentCoinIndex].gridCol ?? 0) + 1}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step: Saving */}
      {state.step === "saving" && (
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Münze wird gespeichert...</span>
        </div>
      )}

      {/* Step: Saved */}
      {state.step === "saved" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-green-600">
            {state.mode === "grid"
              ? "Alle Münzen erfolgreich gespeichert!"
              : "Münze erfolgreich gespeichert!"}
          </h2>
          <div className="flex gap-4">
            <Button
              onClick={() =>
                dispatch({ type: "CONTINUE_WITH_SESSION" })
              }
            >
              Weiter mit gleichen Einstellungen
            </Button>
            <Button
              variant="outline"
              onClick={() => dispatch({ type: "START_FRESH" })}
            >
              Neu (leere Eingabe)
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

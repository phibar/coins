"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCaptureSession } from "@/hooks/use-capture-session";
import { PhotoCanvas } from "./_components/photo-canvas";
import { GridCanvas } from "./_components/grid-canvas";
import { GridConfigPanel } from "./_components/grid-config-panel";
import { MultiCropCanvas } from "./_components/multi-crop-canvas";
import { MultiConfigPanel } from "./_components/multi-config-panel";
import { CoinForm } from "./_components/coin-form";
import type { CollectionWithImages } from "./_components/coin-form";
import type { CoinFormData, CropRect, MultiCropItem } from "@/types/capture";
import { toast } from "sonner";
import { generateCropPreviewUrl, rotateImage90 } from "@/lib/crop-preview";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded border border-border/50 bg-muted/50 px-1 text-[10px] font-mono text-muted-foreground">
      {children}
    </kbd>
  );
}

export default function CapturePage() {
  const { state, dispatch, capturePhoto, captureBackPhoto, loadTestImage } = useCaptureSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backFileInputRef = useRef<HTMLInputElement>(null);

  // Camera status polling
  const [cameraConnected, setCameraConnected] = useState(false);
  const [collections, setCollections] = useState<CollectionWithImages[]>([]);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/camera/status");
        const data = await res.json();
        setCameraConnected(data.connected);
      } catch {
        setCameraConnected(false);
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch("/api/collections")
      .then((r) => r.json())
      .then((data) => setCollections(data))
      .catch(() => {});
  }, []);

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

      if (state.mode === "single" || state.mode === "numisbrief") {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          dispatch({
            type: state.mode === "numisbrief" ? "NUMISBRIEF_BACK_COMPLETE" : "SINGLE_BACK_COMPLETE",
            photo: url,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        };
        img.src = url;
        return;
      }

      // Grid/Multi mode: optionally flip, then load dimensions
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const arrayBuffer = reader.result as ArrayBuffer;
          let finalUrl: string;

          if (state.flipMode === "book") {
            const response = await fetch("/api/images/flip", {
              method: "POST",
              body: arrayBuffer,
              headers: { "Content-Type": "application/octet-stream" },
            });
            if (!response.ok) throw new Error("Flip failed");
            const flippedBlob = await response.blob();
            finalUrl = URL.createObjectURL(flippedBlob);
            toast.success("Rückseite geladen und gespiegelt");
          } else {
            const blob = new Blob([arrayBuffer], { type: file.type });
            finalUrl = URL.createObjectURL(blob);
            toast.success("Rückseite geladen");
          }

          const img = new window.Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Image load failed"));
            img.src = finalUrl;
          });

          dispatch({
            type: state.mode === "multi" ? "MULTI_BACK_COMPLETE" : "BACK_CAPTURE_COMPLETE",
            photo: finalUrl,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        } catch {
          toast.error("Fehler beim Laden der Rückseite");
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [dispatch, state.mode, state.flipMode]
  );

  const handleCaptureBack = useCallback(async () => {
    dispatch({ type: "START_BACK_CAPTURE" });
    try {
      const response = await fetch("/api/camera/capture", { method: "POST" });
      if (!response.ok) throw new Error("Capture failed");

      const blob = await response.blob();
      let finalUrl: string;

      if (state.flipMode === "book") {
        // Flip the back image horizontally (book-flip)
        const arrayBuffer = await blob.arrayBuffer();
        const flipResponse = await fetch("/api/images/flip", {
          method: "POST",
          body: arrayBuffer,
          headers: { "Content-Type": "application/octet-stream" },
        });
        if (!flipResponse.ok) throw new Error("Flip failed");
        const flippedBlob = await flipResponse.blob();
        finalUrl = URL.createObjectURL(flippedBlob);
      } else {
        // "turn" mode: no flipping
        finalUrl = URL.createObjectURL(blob);
      }

      // Load dimensions
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = finalUrl;
      });

      dispatch({
        type: state.mode === "multi" ? "MULTI_BACK_COMPLETE" : "BACK_CAPTURE_COMPLETE",
        photo: finalUrl,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    } catch {
      toast.error("Fehler beim Aufnehmen der Rückseite");
      dispatch({ type: "CAPTURE_FAILED" });
    }
  }, [dispatch, state.flipMode, state.mode]);

  const captureNumisbriefBack = useCallback(async () => {
    dispatch({ type: "START_BACK_CAPTURE" });
    try {
      const response = await fetch("/api/camera/capture", { method: "POST" });
      if (!response.ok) throw new Error("Capture failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = url;
      });
      dispatch({
        type: "NUMISBRIEF_BACK_COMPLETE",
        photo: url,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
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

  const handleNumisbriefCropChange = useCallback(
    (crop: CropRect) => {
      dispatch({ type: "SET_NUMISBRIEF_CROP", crop });
    },
    [dispatch]
  );

  const handleNumisbriefBackCropChange = useCallback(
    (crop: CropRect) => {
      dispatch({ type: "SET_NUMISBRIEF_BACK_CROP", crop });
    },
    [dispatch]
  );

  const [rotating, setRotating] = useState(false);

  const handleRotateFront = useCallback(async () => {
    if (!state.frontPhoto || rotating) return;
    setRotating(true);
    try {
      const result = await rotateImage90(
        state.frontPhoto,
        state.imageWidth,
        state.imageHeight
      );
      dispatch({
        type: "ROTATE_FRONT",
        photo: result.url,
        width: result.width,
        height: result.height,
      });
    } catch {
      toast.error("Rotation fehlgeschlagen");
    } finally {
      setRotating(false);
    }
  }, [state.frontPhoto, state.imageWidth, state.imageHeight, rotating, dispatch]);

  const handleRotateBack = useCallback(async () => {
    if (!state.backPhoto || rotating) return;
    setRotating(true);
    try {
      const result = await rotateImage90(
        state.backPhoto,
        state.backImageWidth,
        state.backImageHeight
      );
      dispatch({
        type: "ROTATE_BACK",
        photo: result.url,
        width: result.width,
        height: result.height,
      });
    } catch {
      toast.error("Rotation fehlgeschlagen");
    } finally {
      setRotating(false);
    }
  }, [state.backPhoto, state.backImageWidth, state.backImageHeight, rotating, dispatch]);

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
            documentImagesBase64: formData.documentImagesBase64 || [],
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

  // Crop preview URLs for coin_entry step
  const [frontPreviewUrl, setFrontPreviewUrl] = useState<string | null>(null);
  const [backPreviewUrl, setBackPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (state.step !== "coin_entry") {
      setFrontPreviewUrl(null);
      setBackPreviewUrl(null);
      return;
    }
    const currentCoin = state.coins[state.currentCoinIndex];
    if (!currentCoin) return;

    let cancelled = false;
    const urls: string[] = [];

    if (state.frontPhoto && currentCoin.frontCrop) {
      generateCropPreviewUrl(state.frontPhoto, currentCoin.frontCrop).then((url) => {
        if (!cancelled) {
          urls.push(url);
          setFrontPreviewUrl(url);
        } else {
          URL.revokeObjectURL(url);
        }
      });
    }

    if (state.backPhoto && currentCoin.backCrop) {
      generateCropPreviewUrl(state.backPhoto, currentCoin.backCrop).then((url) => {
        if (!cancelled) {
          urls.push(url);
          setBackPreviewUrl(url);
        } else {
          URL.revokeObjectURL(url);
        }
      });
    } else {
      setBackPreviewUrl(null);
    }

    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [state.step, state.currentCoinIndex, state.frontPhoto, state.backPhoto, state.coins]);

  // Auto-detection
  const [detecting, setDetecting] = useState(false);

  const runDetection = useCallback(async (): Promise<{
    coins: { x: number; y: number; width: number; height: number; centerX: number; centerY: number }[];
    suggestedGrid?: { rows: number; cols: number; overlay: { x: number; y: number; width: number; height: number } };
  } | null> => {
    if (!state.frontPhoto) return null;
    const response = await fetch(state.frontPhoto);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const detectResponse = await fetch("/api/images/detect", {
      method: "POST",
      body: arrayBuffer,
      headers: { "Content-Type": "application/octet-stream" },
    });
    if (!detectResponse.ok) throw new Error("Detection failed");
    return detectResponse.json();
  }, [state.frontPhoto]);

  const handleAutoDetect = useCallback(async () => {
    setDetecting(true);
    try {
      const result = await runDetection();
      if (!result || result.coins.length === 0) {
        toast.info("Keine Münzen erkannt. Bitte manuell positionieren.");
        return;
      }

      if (result.coins.length === 1) {
        const coin = result.coins[0];
        const size = Math.max(coin.width, coin.height) * 1.1;
        dispatch({ type: "SELECT_MODE", mode: "single" });
        dispatch({
          type: "SET_SINGLE_CROP",
          crop: {
            x: Math.max(0, coin.centerX - size / 2),
            y: Math.max(0, coin.centerY - size / 2),
            width: size,
            height: size,
          },
        });
        toast.success("Münze erkannt!");
      } else if (result.suggestedGrid) {
        dispatch({ type: "SELECT_MODE", mode: "grid" });
        dispatch({
          type: "SET_GRID_CONFIG",
          config: {
            rows: result.suggestedGrid.rows,
            cols: result.suggestedGrid.cols,
            emptySlots: [],
          },
        });
        dispatch({
          type: "SET_GRID_OVERLAY",
          overlay: result.suggestedGrid.overlay,
        });
        toast.success(
          `${result.coins.length} Münzen erkannt (${result.suggestedGrid.rows}×${result.suggestedGrid.cols} Grid)`
        );
      } else {
        // Multiple coins without clear grid → multi mode
        dispatch({ type: "SELECT_MODE", mode: "multi" });
        for (const coin of result.coins) {
          const size = Math.max(coin.width, coin.height) * 1.1;
          dispatch({
            type: "ADD_MULTI_CROP",
            crop: {
              id: crypto.randomUUID(),
              crop: {
                x: Math.max(0, coin.centerX - size / 2),
                y: Math.max(0, coin.centerY - size / 2),
                width: size,
                height: size,
              },
            },
          });
        }
        toast.success(
          `${result.coins.length} Münzen erkannt (Multi-Modus)`
        );
      }
    } catch {
      toast.error("Auto-Erkennung fehlgeschlagen");
    } finally {
      setDetecting(false);
    }
  }, [runDetection, dispatch]);

  const handleAutoDetectSingle = useCallback(async () => {
    setDetecting(true);
    try {
      const result = await runDetection();
      if (!result || result.coins.length === 0) {
        toast.info("Keine Münze erkannt.");
        return;
      }
      // Pick the largest detected coin
      const coin = result.coins.reduce((a, b) =>
        b.width * b.height > a.width * a.height ? b : a
      );
      const size = Math.max(coin.width, coin.height) * 1.1;
      dispatch({
        type: "SET_SINGLE_CROP",
        crop: {
          x: Math.max(0, coin.centerX - size / 2),
          y: Math.max(0, coin.centerY - size / 2),
          width: size,
          height: size,
        },
      });
      toast.success("Münze erkannt!");
    } catch {
      toast.error("Auto-Erkennung fehlgeschlagen");
    } finally {
      setDetecting(false);
    }
  }, [runDetection, dispatch]);

  const handleAutoDetectGrid = useCallback(async () => {
    setDetecting(true);
    try {
      const result = await runDetection();
      if (!result || result.coins.length === 0) {
        toast.info("Keine Münzen erkannt.");
        return;
      }
      if (result.suggestedGrid) {
        dispatch({
          type: "SET_GRID_CONFIG",
          config: {
            rows: result.suggestedGrid.rows,
            cols: result.suggestedGrid.cols,
            emptySlots: [],
          },
        });
        dispatch({
          type: "SET_GRID_OVERLAY",
          overlay: result.suggestedGrid.overlay,
        });
        toast.success(
          `${result.coins.length} Münzen erkannt (${result.suggestedGrid.rows}×${result.suggestedGrid.cols})`
        );
      } else {
        toast.info("Kein klares Grid erkannt. Bitte manuell konfigurieren.");
      }
    } catch {
      toast.error("Auto-Erkennung fehlgeschlagen");
    } finally {
      setDetecting(false);
    }
  }, [runDetection, dispatch]);

  const handleAutoDetectMulti = useCallback(async () => {
    setDetecting(true);
    try {
      const result = await runDetection();
      if (!result || result.coins.length === 0) {
        toast.info("Keine Münzen erkannt.");
        return;
      }
      for (const coin of result.coins) {
        const size = Math.max(coin.width, coin.height) * 1.1;
        dispatch({
          type: "ADD_MULTI_CROP",
          crop: {
            id: crypto.randomUUID(),
            crop: {
              x: Math.max(0, coin.centerX - size / 2),
              y: Math.max(0, coin.centerY - size / 2),
              width: size,
              height: size,
            },
          },
        });
      }
      toast.success(`${result.coins.length} Münzen erkannt!`);
    } catch {
      toast.error("Auto-Erkennung fehlgeschlagen");
    } finally {
      setDetecting(false);
    }
  }, [runDetection, dispatch]);

  // Front-side preview for multi back-align step
  const [multiBackPreview, setMultiBackPreview] = useState<string | null>(null);

  useEffect(() => {
    if (
      state.step !== "multi_back_align" ||
      !state.selectedMultiCropId ||
      !state.frontPhoto
    ) {
      setMultiBackPreview(null);
      return;
    }
    const frontItem = state.multiCrops.find(
      (c) => c.id === state.selectedMultiCropId
    );
    if (!frontItem) {
      setMultiBackPreview(null);
      return;
    }

    let cancelled = false;
    generateCropPreviewUrl(state.frontPhoto, frontItem.crop, 200).then(
      (url) => {
        if (!cancelled) setMultiBackPreview(url);
        else URL.revokeObjectURL(url);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [
    state.step,
    state.selectedMultiCropId,
    state.frontPhoto,
    state.multiCrops,
  ]);

  const gridCoinCount =
    state.gridConfig
      ? state.gridConfig.rows * state.gridConfig.cols -
        state.gridConfig.emptySlots.length
      : 0;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      // Skip if a dialog is open
      if (document.querySelector("[role=dialog]")) return;

      const step = state.step;

      if (step === "idle") {
        if ((e.key === " " || e.key === "Enter") && cameraConnected) {
          e.preventDefault();
          capturePhoto();
        } else if ((e.key === "l" || e.key === "L") && !cameraConnected) {
          e.preventDefault();
          fileInputRef.current?.click();
        }
      } else if (step === "select_mode") {
        if (e.key === "b" || e.key === "B") {
          e.preventDefault();
          dispatch({ type: "MARK_AS_BACK" });
        } else if (e.key === "a" || e.key === "A") {
          e.preventDefault();
          if (!detecting) handleAutoDetect();
        } else if (e.key === "1") {
          e.preventDefault();
          dispatch({ type: "SELECT_MODE", mode: "single" });
        } else if (e.key === "2") {
          e.preventDefault();
          dispatch({ type: "SELECT_MODE", mode: "grid" });
        } else if (e.key === "3") {
          e.preventDefault();
          dispatch({ type: "SELECT_MODE", mode: "multi" });
        } else if (e.key === "n" || e.key === "N") {
          e.preventDefault();
          dispatch({ type: "SELECT_MODE", mode: "numisbrief" });
        } else if (e.key === "Escape") {
          e.preventDefault();
          dispatch({ type: "RESET" });
        }
      } else if (step === "numisbrief_crop") {
        if (e.key === "Enter") {
          e.preventDefault();
          dispatch({ type: "CONFIRM_NUMISBRIEF_CROP" });
        } else if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          if (!rotating) handleRotateFront();
        } else if (e.key === "Escape") {
          e.preventDefault();
          dispatch({ type: "RESET" });
        }
      } else if (step === "numisbrief_back_capture") {
        if ((e.key === " " || e.key === "Enter") && cameraConnected) {
          e.preventDefault();
          captureNumisbriefBack();
        } else if ((e.key === "l" || e.key === "L") && !cameraConnected) {
          e.preventDefault();
          backFileInputRef.current?.click();
        } else if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          dispatch({ type: "SKIP_NUMISBRIEF_BACK" });
        } else if (e.key === "Escape") {
          e.preventDefault();
          dispatch({ type: "RESET" });
        }
      } else if (step === "numisbrief_back_crop") {
        if (e.key === "Enter") {
          e.preventDefault();
          dispatch({ type: "CONFIRM_NUMISBRIEF_BACK_CROP" });
        } else if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          if (!rotating) handleRotateBack();
        } else if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          dispatch({ type: "SKIP_NUMISBRIEF_BACK" });
        } else if (e.key === "Escape") {
          e.preventDefault();
          dispatch({ type: "RETAKE_NUMISBRIEF_BACK" });
        }
      } else if (step === "single_crop") {
        if (e.key === "Enter") {
          e.preventDefault();
          dispatch({ type: "CONFIRM_SINGLE_CROP" });
        } else if (e.key === "a" || e.key === "A") {
          e.preventDefault();
          if (!detecting) handleAutoDetectSingle();
        } else if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          if (!rotating) handleRotateFront();
        } else if (e.key === "Escape") {
          e.preventDefault();
          dispatch({ type: "RESET" });
        }
      } else if (step === "single_back_capture") {
        if ((e.key === " " || e.key === "Enter") && cameraConnected) {
          e.preventDefault();
          captureBackPhoto();
        } else if ((e.key === "l" || e.key === "L") && !cameraConnected) {
          e.preventDefault();
          backFileInputRef.current?.click();
        } else if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          dispatch({ type: "SKIP_SINGLE_BACK" });
        } else if (e.key === "Escape") {
          e.preventDefault();
          dispatch({ type: "RESET" });
        }
      } else if (step === "single_back_crop") {
        if (e.key === "Enter") {
          e.preventDefault();
          dispatch({ type: "CONFIRM_SINGLE_BACK_CROP" });
        } else if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          if (!rotating) handleRotateBack();
        } else if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          dispatch({ type: "SKIP_SINGLE_BACK" });
        } else if (e.key === "Escape") {
          e.preventDefault();
          dispatch({ type: "RETAKE_SINGLE_BACK" });
        }
      } else if (step === "grid_config") {
        if (e.key === "Enter") {
          e.preventDefault();
          if (gridCoinCount > 0) dispatch({ type: "CONFIRM_GRID_FRONT" });
        } else if (e.key === "a" || e.key === "A") {
          e.preventDefault();
          if (!detecting) handleAutoDetectGrid();
        } else if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          if (!rotating) handleRotateFront();
        } else if (e.key === "Escape") {
          e.preventDefault();
          dispatch({ type: "RESET" });
        }
      } else if (step === "multi_crop") {
        if (e.key === "Enter") {
          e.preventDefault();
          if (state.multiCrops.length > 0)
            dispatch({ type: "CONFIRM_MULTI_FRONT" });
        } else if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          if (state.selectedMultiCropId)
            dispatch({
              type: "DELETE_MULTI_CROP",
              id: state.selectedMultiCropId,
            });
        } else if (e.key === "a" || e.key === "A") {
          e.preventDefault();
          if (!detecting) handleAutoDetectMulti();
        } else if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          if (!rotating) handleRotateFront();
        } else if (e.key === "Escape") {
          e.preventDefault();
          dispatch({ type: "RESET" });
        }
      } else if (step === "multi_back_capture") {
        if ((e.key === " " || e.key === "Enter") && cameraConnected) {
          e.preventDefault();
          handleCaptureBack();
        } else if ((e.key === "l" || e.key === "L") && !cameraConnected) {
          e.preventDefault();
          backFileInputRef.current?.click();
        } else if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          dispatch({ type: "SKIP_MULTI_BACK" });
        } else if (e.key === "Escape") {
          e.preventDefault();
          dispatch({ type: "RESET" });
        }
      } else if (step === "multi_back_align") {
        if (e.key === "Enter") {
          e.preventDefault();
          dispatch({ type: "CONFIRM_MULTI_BACK_ALIGN" });
        } else if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          if (!rotating) handleRotateBack();
        } else if (e.key === "Tab") {
          e.preventDefault();
          // Cycle through multi back crops
          const crops = state.multiBackCrops;
          if (crops.length > 0) {
            const currentIdx = crops.findIndex(
              (c) => c.id === state.selectedMultiCropId
            );
            const nextIdx = e.shiftKey
              ? (currentIdx - 1 + crops.length) % crops.length
              : (currentIdx + 1) % crops.length;
            dispatch({
              type: "SELECT_MULTI_BACK_CROP",
              id: crops[nextIdx].id,
            });
          }
        } else if (e.key === "Escape") {
          e.preventDefault();
          dispatch({ type: "RETAKE_MULTI_BACK" });
        }
      } else if (step === "grid_back_capture") {
        if ((e.key === " " || e.key === "Enter") && cameraConnected) {
          e.preventDefault();
          handleCaptureBack();
        } else if ((e.key === "l" || e.key === "L") && !cameraConnected) {
          e.preventDefault();
          backFileInputRef.current?.click();
        } else if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          dispatch({ type: "SKIP_BACK_CAPTURE" });
        } else if (e.key === "Escape") {
          e.preventDefault();
          dispatch({ type: "RESET" });
        }
      } else if (step === "grid_back_align") {
        if (e.key === "Enter") {
          e.preventDefault();
          dispatch({ type: "CONFIRM_BACK_GRID_ALIGN" });
        } else if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          if (!rotating) handleRotateBack();
        } else if (e.key === "Escape") {
          e.preventDefault();
          dispatch({ type: "RETAKE_BACK" });
        }
      } else if (step === "saved") {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          dispatch({ type: "CONTINUE_WITH_SESSION" });
        } else if (e.key === "n" || e.key === "N") {
          e.preventDefault();
          dispatch({ type: "START_FRESH" });
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    state.step, state.multiCrops, state.multiBackCrops,
    state.selectedMultiCropId, detecting, rotating, gridCoinCount,
    cameraConnected, capturePhoto, captureBackPhoto, captureNumisbriefBack, handleAutoDetect,
    handleAutoDetectSingle, handleAutoDetectGrid, handleAutoDetectMulti,
    handleRotateFront, handleRotateBack, handleCaptureBack,
    dispatch,
  ]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">Münzen erfassen</h1>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
      <input
        ref={backFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleBackFileUpload}
        className="hidden"
      />

      {/* Step: Idle */}
      {state.step === "idle" && (
        <div className="flex gap-4">
          {cameraConnected ? (
            <Button size="lg" onClick={capturePhoto}>
              Foto aufnehmen<Kbd>↵</Kbd>
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() => fileInputRef.current?.click()}
            >
              Bild laden<Kbd>L</Kbd>
            </Button>
          )}
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
          {state.backOnly && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-600 dark:text-blue-400">
              Rückseiten-Modus — Vorderseite wird übersprungen
            </div>
          )}
          <div className="flex flex-wrap gap-4">
            <Button
              size="lg"
              onClick={handleAutoDetect}
              disabled={detecting}
            >
              {detecting ? "Erkennung..." : <>Auto-Erkennung<Kbd>A</Kbd></>}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() =>
                dispatch({ type: "SELECT_MODE", mode: "single" })
              }
            >
              Einzelmünze<Kbd>1</Kbd>
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() =>
                dispatch({ type: "SELECT_MODE", mode: "grid" })
              }
            >
              Grid / Münzseite<Kbd>2</Kbd>
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() =>
                dispatch({ type: "SELECT_MODE", mode: "multi" })
              }
            >
              Multi-Auswahl<Kbd>3</Kbd>
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() =>
                dispatch({ type: "SELECT_MODE", mode: "numisbrief" })
              }
            >
              Numisbrief<Kbd>N</Kbd>
            </Button>
            <Button
              size="lg"
              variant={state.backOnly ? "default" : "outline"}
              onClick={() => dispatch({ type: "MARK_AS_BACK" })}
            >
              Dies ist die Rückseite<Kbd>B</Kbd>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => dispatch({ type: "RESET" })}
            >
              Neu aufnehmen<Kbd>Esc</Kbd>
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

      {/* Step: Numisbrief crop */}
      {state.step === "numisbrief_crop" &&
        state.frontPhoto &&
        state.numisbriefCrop && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Numisbrief — Ausschnitt wählen</h2>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRotateFront}
                  disabled={rotating}
                >
                  Drehen<Kbd>R</Kbd>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => dispatch({ type: "RESET" })}
                >
                  Neu aufnehmen<Kbd>Esc</Kbd>
                </Button>
                <Button
                  onClick={() =>
                    dispatch({ type: "CONFIRM_NUMISBRIEF_CROP" })
                  }
                >
                  Bestätigen<Kbd>↵</Kbd>
                </Button>
              </div>
            </div>
            <PhotoCanvas
              imageSrc={state.frontPhoto}
              imageWidth={state.imageWidth}
              imageHeight={state.imageHeight}
              crop={state.numisbriefCrop}
              onCropChange={handleNumisbriefCropChange}
              freeAspect
            />
            <p className="text-sm text-muted-foreground">
              Ziehe den Ausschnitt über den Numisbrief. Ecken zum
              Vergrößern/Verkleinern.
            </p>
          </div>
        )}

      {/* Step: Numisbrief back capture */}
      {state.step === "numisbrief_back_capture" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Rückseite aufnehmen</h2>
          <p className="text-muted-foreground">
            Drehe den Numisbrief um und nehme ein Foto der Rückseite auf.
          </p>
          <div className="flex flex-wrap gap-3">
            {cameraConnected ? (
              <Button size="lg" onClick={captureNumisbriefBack}>
                Rückseite aufnehmen<Kbd>↵</Kbd>
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => backFileInputRef.current?.click()}
                >
                  Bild laden<Kbd>L</Kbd>
                </Button>
              </>
            )}
            <Button
              size="lg"
              variant="ghost"
              onClick={() =>
                dispatch({ type: "SKIP_NUMISBRIEF_BACK" })
              }
            >
              Überspringen<Kbd>S</Kbd>
            </Button>
          </div>
        </div>
      )}

      {/* Step: Numisbrief back crop */}
      {state.step === "numisbrief_back_crop" &&
        state.backPhoto &&
        state.numisbriefBackCrop && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Numisbrief Rückseite — Ausschnitt wählen</h2>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRotateBack}
                  disabled={rotating}
                >
                  Drehen<Kbd>R</Kbd>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    dispatch({ type: "SKIP_NUMISBRIEF_BACK" })
                  }
                >
                  Überspringen<Kbd>S</Kbd>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    dispatch({ type: "RETAKE_NUMISBRIEF_BACK" })
                  }
                >
                  Neu aufnehmen<Kbd>Esc</Kbd>
                </Button>
                <Button
                  onClick={() =>
                    dispatch({ type: "CONFIRM_NUMISBRIEF_BACK_CROP" })
                  }
                >
                  Bestätigen<Kbd>↵</Kbd>
                </Button>
              </div>
            </div>
            <PhotoCanvas
              imageSrc={state.backPhoto}
              imageWidth={state.backImageWidth}
              imageHeight={state.backImageHeight}
              crop={state.numisbriefBackCrop}
              onCropChange={handleNumisbriefBackCropChange}
              freeAspect
            />
            <p className="text-sm text-muted-foreground">
              Ziehe den Ausschnitt über die Rückseite des Numisbriefs.
            </p>
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
                  variant="secondary"
                  size="sm"
                  onClick={handleAutoDetectSingle}
                  disabled={detecting}
                >
                  {detecting ? "..." : <>Auto<Kbd>A</Kbd></>}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRotateFront}
                  disabled={rotating}
                >
                  Drehen<Kbd>R</Kbd>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => dispatch({ type: "RESET" })}
                >
                  Neu aufnehmen<Kbd>Esc</Kbd>
                </Button>
                <Button
                  onClick={() =>
                    dispatch({ type: "CONFIRM_SINGLE_CROP" })
                  }
                >
                  Bestätigen<Kbd>↵</Kbd>
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
            {cameraConnected ? (
              <Button size="lg" onClick={captureBackPhoto}>
                Rückseite fotografieren<Kbd>↵</Kbd>
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => backFileInputRef.current?.click()}
              >
                Bild laden<Kbd>L</Kbd>
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => dispatch({ type: "SKIP_SINGLE_BACK" })}
            >
              Überspringen<Kbd>S</Kbd>
            </Button>
            <Button
              variant="ghost"
              onClick={() => dispatch({ type: "RESET" })}
            >
              Neu aufnehmen<Kbd>Esc</Kbd>
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
                  variant="secondary"
                  size="sm"
                  onClick={handleRotateBack}
                  disabled={rotating}
                >
                  Drehen<Kbd>R</Kbd>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    dispatch({ type: "RETAKE_SINGLE_BACK" })
                  }
                >
                  Rückseite neu<Kbd>Esc</Kbd>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => dispatch({ type: "SKIP_SINGLE_BACK" })}
                >
                  Ohne Rückseite<Kbd>S</Kbd>
                </Button>
                <Button
                  onClick={() =>
                    dispatch({ type: "CONFIRM_SINGLE_BACK_CROP" })
                  }
                >
                  Bestätigen<Kbd>↵</Kbd>
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
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Grid platzieren</h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRotateFront}
                disabled={rotating}
              >
                Drehen<Kbd>R</Kbd>
              </Button>
            </div>
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
                flipMode={state.flipMode}
                onConfigChange={(config) =>
                  dispatch({ type: "SET_GRID_CONFIG", config })
                }
                onFlipModeChange={(flipMode) =>
                  dispatch({ type: "SET_FLIP_MODE", flipMode })
                }
                onConfirm={() => dispatch({ type: "CONFIRM_GRID_FRONT" })}
                onCancel={() => dispatch({ type: "RESET" })}
                onAutoDetect={handleAutoDetectGrid}
                autoDetecting={detecting}
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
            {state.flipMode === "book"
              ? "Drehe die Münzseite wie ein Buch um und nehme ein Foto der Rückseiten auf. Das Bild wird automatisch gespiegelt."
              : "Drehe alle Münzen einzeln um und nehme ein Foto der Rückseiten auf."}
          </p>
          <div className="flex gap-4">
            {cameraConnected ? (
              <Button size="lg" onClick={handleCaptureBack}>
                Rückseite fotografieren<Kbd>↵</Kbd>
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => backFileInputRef.current?.click()}
              >
                Bild laden<Kbd>L</Kbd>
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => dispatch({ type: "SKIP_BACK_CAPTURE" })}
            >
              Überspringen<Kbd>S</Kbd>
            </Button>
            <Button
              variant="ghost"
              onClick={() => dispatch({ type: "RESET" })}
            >
              Neu aufnehmen<Kbd>Esc</Kbd>
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

      {/* Step: Grid back alignment */}
      {state.step === "grid_back_align" &&
        state.backPhoto &&
        state.gridConfig &&
        state.backGridOverlay && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Rückseite: Grid ausrichten
              </h2>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleRotateBack}
                disabled={rotating}
              >
                Drehen<Kbd>R</Kbd>
              </Button>
            </div>
            <p className="text-muted-foreground">
              Positioniere das Grid auf der Rückseite. Zeilen, Spalten und leere
              Felder bleiben gleich.
            </p>
            <div className="grid gap-6 lg:grid-cols-[1fr_250px]">
              <GridCanvas
                imageSrc={state.backPhoto}
                imageWidth={state.backImageWidth}
                imageHeight={state.backImageHeight}
                gridConfig={state.gridConfig}
                overlay={state.backGridOverlay}
                onOverlayChange={(overlay) =>
                  dispatch({ type: "SET_BACK_GRID_OVERLAY", overlay })
                }
                onToggleEmptySlot={() => {}}
                readOnly
              />
              <div className="space-y-4 rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">
                  Verschiebe und skaliere das Grid, damit es zur Rückseite
                  passt.
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() =>
                      dispatch({ type: "CONFIRM_BACK_GRID_ALIGN" })
                    }
                  >
                    Bestätigen<Kbd>↵</Kbd>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => dispatch({ type: "RETAKE_BACK" })}
                  >
                    Rückseite neu<Kbd>Esc</Kbd>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Step: Multi crop */}
      {state.step === "multi_crop" && state.frontPhoto && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Münzen markieren</h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRotateFront}
              disabled={rotating}
            >
              Drehen<Kbd>R</Kbd>
            </Button>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <MultiCropCanvas
              imageSrc={state.frontPhoto}
              imageWidth={state.imageWidth}
              imageHeight={state.imageHeight}
              crops={state.multiCrops}
              selectedCropId={state.selectedMultiCropId}
              onAddCrop={(crop: MultiCropItem) =>
                dispatch({ type: "ADD_MULTI_CROP", crop })
              }
              onUpdateCrop={(id: string, crop: CropRect) =>
                dispatch({ type: "UPDATE_MULTI_CROP", id, crop })
              }
              onDeleteCrop={(id: string) =>
                dispatch({ type: "DELETE_MULTI_CROP", id })
              }
              onSelectCrop={(id: string | null) =>
                dispatch({ type: "SELECT_MULTI_CROP", id })
              }
            />
            <MultiConfigPanel
              cropCount={state.multiCrops.length}
              flipMode={state.flipMode}
              onFlipModeChange={(flipMode) =>
                dispatch({ type: "SET_FLIP_MODE", flipMode })
              }
              onConfirm={() => dispatch({ type: "CONFIRM_MULTI_FRONT" })}
              onCancel={() => dispatch({ type: "RESET" })}
              onAutoDetect={handleAutoDetectMulti}
              autoDetecting={detecting}
              onDeleteSelected={() => {
                if (state.selectedMultiCropId)
                  dispatch({
                    type: "DELETE_MULTI_CROP",
                    id: state.selectedMultiCropId,
                  });
              }}
              hasSelection={!!state.selectedMultiCropId}
            />
          </div>
        </div>
      )}

      {/* Step: Multi back capture */}
      {state.step === "multi_back_capture" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Rückseite aufnehmen</h2>
          <p className="text-muted-foreground">
            {state.flipMode === "book"
              ? "Drehe die Münzen wie ein Buch um. Das Bild wird automatisch gespiegelt."
              : "Drehe alle Münzen einzeln um und nehme ein Foto der Rückseiten auf."}
          </p>
          <div className="flex gap-4">
            {cameraConnected ? (
              <Button size="lg" onClick={handleCaptureBack}>
                Rückseite fotografieren<Kbd>↵</Kbd>
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => backFileInputRef.current?.click()}
              >
                Bild laden<Kbd>L</Kbd>
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => dispatch({ type: "SKIP_MULTI_BACK" })}
            >
              Überspringen<Kbd>S</Kbd>
            </Button>
            <Button
              variant="ghost"
              onClick={() => dispatch({ type: "RESET" })}
            >
              Neu aufnehmen<Kbd>Esc</Kbd>
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

      {/* Step: Multi back alignment */}
      {state.step === "multi_back_align" && state.backPhoto && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Rückseite: Ausschnitte positionieren
            </h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRotateBack}
              disabled={rotating}
            >
              Drehen<Kbd>R</Kbd>
            </Button>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_250px]">
            <MultiCropCanvas
              imageSrc={state.backPhoto}
              imageWidth={state.backImageWidth}
              imageHeight={state.backImageHeight}
              crops={state.multiBackCrops}
              selectedCropId={state.selectedMultiCropId}
              onAddCrop={() => {}}
              onUpdateCrop={(id: string, crop: CropRect) =>
                dispatch({ type: "UPDATE_MULTI_BACK_CROP", id, crop })
              }
              onDeleteCrop={() => {}}
              onSelectCrop={(id: string | null) =>
                dispatch({ type: "SELECT_MULTI_BACK_CROP", id })
              }
              readOnly
              previewImageSrc={state.frontPhoto ?? undefined}
              previewCrops={state.multiCrops}
            />
            <div className="space-y-4 rounded-lg border bg-card p-4">
              {multiBackPreview && (
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">
                    Vorderseite:
                  </p>
                  <img
                    src={multiBackPreview}
                    alt="Vorderseite-Vorschau"
                    className="w-full rounded border"
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Klicke auf einen Ausschnitt und verschiebe ihn auf die passende
                Rückseite. <strong>Tab</strong> wechselt zwischen Ausschnitten.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() =>
                    dispatch({ type: "CONFIRM_MULTI_BACK_ALIGN" })
                  }
                >
                  Bestätigen<Kbd>↵</Kbd>
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    dispatch({ type: "RETAKE_MULTI_BACK" })
                  }
                >
                  Rückseite neu<Kbd>Esc</Kbd>
                </Button>
              </div>
            </div>
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
                frontImageUrl={frontPreviewUrl ?? undefined}
                backImageUrl={backPreviewUrl ?? undefined}
                onSave={handleSaveCoin}
                onSkip={
                  state.coins.length > 1
                    ? () => dispatch({ type: "COIN_SAVED" })
                    : undefined
                }
                coinIndex={state.currentCoinIndex}
                totalCoins={state.coins.length}
                saving={false}
                cameraConnected={cameraConnected}
                collections={collections}
                onCollectionsChange={setCollections}
              />
            </CardContent>
          </Card>
          <div className="space-y-4">
            {state.mode === "grid" &&
              state.coins.length > 1 &&
              state.coins[state.currentCoinIndex] && (
                <div className="text-sm text-muted-foreground">
                  Position: Zeile{" "}
                  {(state.coins[state.currentCoinIndex].gridRow ?? 0) + 1},
                  Spalte{" "}
                  {(state.coins[state.currentCoinIndex].gridCol ?? 0) + 1}
                </div>
              )}
            {state.mode === "multi" && state.coins.length > 1 && (
              <div className="text-sm text-muted-foreground">
                Münze {state.currentCoinIndex + 1} von {state.coins.length}
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
            {state.mode === "grid" || state.mode === "multi"
              ? "Alle Münzen erfolgreich gespeichert!"
              : "Münze erfolgreich gespeichert!"}
          </h2>
          <div className="flex gap-4">
            <Button
              onClick={() =>
                dispatch({ type: "CONTINUE_WITH_SESSION" })
              }
            >
              Weiter mit gleichen Einstellungen<Kbd>↵</Kbd>
            </Button>
            <Button
              variant="outline"
              onClick={() => dispatch({ type: "START_FRESH" })}
            >
              Neu (leere Eingabe)<Kbd>N</Kbd>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

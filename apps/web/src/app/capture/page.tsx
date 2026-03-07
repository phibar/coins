"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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

/** Apply saved camera rotation to a captured image */
async function applyCameraRotation(
  url: string,
  width: number,
  height: number
): Promise<{ url: string; width: number; height: number }> {
  const savedRotation = parseInt(localStorage.getItem("camera-rotation") || "0");
  if (savedRotation <= 0) return { url, width, height };
  let finalUrl = url;
  let finalWidth = width;
  let finalHeight = height;
  const rotations = savedRotation / 90;
  for (let i = 0; i < rotations; i++) {
    const result = await rotateImage90(finalUrl, finalWidth, finalHeight);
    if (finalUrl !== url) URL.revokeObjectURL(finalUrl);
    finalUrl = result.url;
    finalWidth = result.width;
    finalHeight = result.height;
  }
  URL.revokeObjectURL(url);
  return { url: finalUrl, width: finalWidth, height: finalHeight };
}

export default function CapturePage() {
  const { state, dispatch, capturePhoto, captureBackPhoto, loadTestImage } = useCaptureSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backFileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Camera status polling
  const [cameraConnected, setCameraConnected] = useState(false);
  const [collections, setCollections] = useState<CollectionWithImages[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedCoinIndices, setSavedCoinIndices] = useState<Set<number>>(new Set());
  const [skippedCoinIndices, setSkippedCoinIndices] = useState<Set<number>>(new Set());

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

  // Auto-capture on page load when camera connected
  const autoCaptured = useRef(false);
  useEffect(() => {
    if (cameraConnected && state.step === "idle" && !autoCaptured.current) {
      autoCaptured.current = true;
      capturePhoto();
    }
  }, [cameraConnected, state.step, capturePhoto]);

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

      // Grid/Multi mode
      const url = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        toast.success("Rückseite geladen");
        dispatch({
          type: state.mode === "multi" ? "MULTI_BACK_COMPLETE" : "BACK_CAPTURE_COMPLETE",
          photo: url,
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.onerror = () => toast.error("Fehler beim Laden der Rückseite");
      img.src = url;
    },
    [dispatch, state.mode]
  );

  const handleCaptureBack = useCallback(async () => {
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

      const rotated = await applyCameraRotation(url, img.naturalWidth, img.naturalHeight);

      dispatch({
        type: state.mode === "multi" ? "MULTI_BACK_COMPLETE" : "BACK_CAPTURE_COMPLETE",
        photo: rotated.url,
        width: rotated.width,
        height: rotated.height,
      });
    } catch {
      toast.error("Fehler beim Aufnehmen der Rückseite");
      dispatch({ type: "CAPTURE_FAILED" });
    }
  }, [dispatch, state.mode]);

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
      const rotated = await applyCameraRotation(url, img.naturalWidth, img.naturalHeight);
      dispatch({
        type: "NUMISBRIEF_BACK_COMPLETE",
        photo: rotated.url,
        width: rotated.width,
        height: rotated.height,
      });
    } catch {
      toast.error("Fehler beim Aufnehmen der Rückseite");
      dispatch({ type: "CAPTURE_FAILED" });
    }
  }, [dispatch]);

  // Retake front: capture new photo and replace in-place
  const [retaking, setRetaking] = useState(false);

  const retakeFront = useCallback(async () => {
    if (retaking) return;
    setRetaking(true);
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
      const rotated = await applyCameraRotation(url, img.naturalWidth, img.naturalHeight);
      dispatch({
        type: "RETAKE_FRONT",
        photo: rotated.url,
        width: rotated.width,
        height: rotated.height,
      });
    } catch {
      toast.error("Aufnahme fehlgeschlagen");
    } finally {
      setRetaking(false);
    }
  }, [retaking, dispatch]);

  const retakeBack = useCallback(async () => {
    if (retaking) return;
    setRetaking(true);
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
      const rotated = await applyCameraRotation(url, img.naturalWidth, img.naturalHeight);
      dispatch({
        type: "RETAKE_BACK_PHOTO",
        photo: rotated.url,
        width: rotated.width,
        height: rotated.height,
      });
    } catch {
      toast.error("Aufnahme fehlgeschlagen");
    } finally {
      setRetaking(false);
    }
  }, [retaking, dispatch]);

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

  // Save coin handler with three modes
  const doSaveCoin = useCallback(
    async (formData: CoinFormData): Promise<boolean> => {
      dispatch({ type: "SAVE_COIN" });
      setSaving(true);

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
        return true;
      } catch {
        toast.error("Fehler beim Speichern");
        dispatch({ type: "CAPTURE_FAILED" });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [state, dispatch]
  );

  const handleSaveAndContinue = useCallback(
    async (formData: CoinFormData) => {
      const ok = await doSaveCoin(formData);
      if (!ok) return;
      setSavedCoinIndices((prev) => new Set(prev).add(state.currentCoinIndex));
      setSkippedCoinIndices((prev) => { const n = new Set(prev); n.delete(state.currentCoinIndex); return n; });
      const isLastCoin = state.currentCoinIndex >= state.coins.length - 1;
      if (isLastCoin) {
        dispatch({ type: "CONTINUE_WITH_SESSION" });
        autoCaptured.current = false;
        if (cameraConnected) {
          setTimeout(() => capturePhoto(), 100);
        }
      } else {
        dispatch({ type: "COIN_SAVED" });
      }
    },
    [doSaveCoin, dispatch, state.currentCoinIndex, state.coins.length, cameraConnected, capturePhoto]
  );

  const handleSaveAndNew = useCallback(
    async (formData: CoinFormData) => {
      const ok = await doSaveCoin(formData);
      if (!ok) return;
      setSavedCoinIndices((prev) => new Set(prev).add(state.currentCoinIndex));
      setSkippedCoinIndices((prev) => { const n = new Set(prev); n.delete(state.currentCoinIndex); return n; });
      dispatch({ type: "START_FRESH" });
      autoCaptured.current = false;
      if (cameraConnected) {
        setTimeout(() => capturePhoto(), 100);
      }
    },
    [doSaveCoin, dispatch, state.currentCoinIndex, cameraConnected, capturePhoto]
  );

  const handleSaveAndExit = useCallback(
    async (formData: CoinFormData) => {
      const ok = await doSaveCoin(formData);
      if (!ok) return;
      setSavedCoinIndices((prev) => new Set(prev).add(state.currentCoinIndex));
      setSkippedCoinIndices((prev) => { const n = new Set(prev); n.delete(state.currentCoinIndex); return n; });
      router.push("/collection");
    },
    [doSaveCoin, router, state.currentCoinIndex]
  );

  // Check if all coins are handled (saved or skipped) after saving the current one
  const allHandledAfterSave = state.coins.length <= 1 || state.coins.every((_, idx) =>
    idx === state.currentCoinIndex || savedCoinIndices.has(idx) || skippedCoinIndices.has(idx)
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

  // Coin list thumbnails for multi-coin navigation
  const [coinThumbnails, setCoinThumbnails] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    if (state.step !== "coin_entry" || state.coins.length <= 1 || !state.frontPhoto) {
      return;
    }
    let cancelled = false;
    const urls: string[] = [];

    state.coins.forEach((coin, idx) => {
      if (coin.frontCrop) {
        generateCropPreviewUrl(state.frontPhoto!, coin.frontCrop, 60).then((url) => {
          if (!cancelled) {
            urls.push(url);
            setCoinThumbnails((prev) => new Map(prev).set(idx, url));
          } else {
            URL.revokeObjectURL(url);
          }
        });
      }
    });

    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
      setCoinThumbnails(new Map());
    };
  }, [state.step, state.coins, state.frontPhoto]);

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
        if (e.key === "1") {
          e.preventDefault();
          dispatch({ type: "SELECT_MODE", mode: "single" });
        } else if (e.key === "2") {
          e.preventDefault();
          dispatch({ type: "SELECT_MODE", mode: "grid" });
        } else if (e.key === "3") {
          e.preventDefault();
          dispatch({ type: "SELECT_MODE", mode: "multi" });
        } else if (e.key === "4") {
          e.preventDefault();
          dispatch({ type: "SELECT_MODE", mode: "numisbrief" });
        } else if (e.key === "5") {
          e.preventDefault();
          dispatch({ type: "MARK_AS_BACK" });
        } else if (e.key === " ") {
          e.preventDefault();
          // Space = default = Einzelmünze
          dispatch({ type: "SELECT_MODE", mode: "single" });
        } else if (e.key === "^" || e.key === "Dead") {
          e.preventDefault();
          if (cameraConnected && !retaking) retakeFront();
        }
      } else if (step === "single_crop") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (state.singleCrop) dispatch({ type: "CONFIRM_SINGLE_CROP" });
        } else if (e.key === "1") {
          e.preventDefault();
          if (!rotating) handleRotateFront();
        } else if (e.key === "^" || e.key === "Dead") {
          e.preventDefault();
          if (cameraConnected && !retaking) retakeFront();
        }
      } else if (step === "numisbrief_crop") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (state.numisbriefCrop) dispatch({ type: "CONFIRM_NUMISBRIEF_CROP" });
        } else if (e.key === "1") {
          e.preventDefault();
          if (!rotating) handleRotateFront();
        } else if (e.key === "^" || e.key === "Dead") {
          e.preventDefault();
          if (cameraConnected && !retaking) retakeFront();
        }
      } else if (step === "single_back_capture") {
        if ((e.key === " " || e.key === "Enter") && cameraConnected) {
          e.preventDefault();
          captureBackPhoto();
        } else if ((e.key === "l" || e.key === "L") && !cameraConnected) {
          e.preventDefault();
          backFileInputRef.current?.click();
        } else if (e.key === "1") {
          e.preventDefault();
          dispatch({ type: "SKIP_SINGLE_BACK" });
        }
      } else if (step === "numisbrief_back_capture") {
        if ((e.key === " " || e.key === "Enter") && cameraConnected) {
          e.preventDefault();
          captureNumisbriefBack();
        } else if ((e.key === "l" || e.key === "L") && !cameraConnected) {
          e.preventDefault();
          backFileInputRef.current?.click();
        } else if (e.key === "1") {
          e.preventDefault();
          dispatch({ type: "SKIP_NUMISBRIEF_BACK" });
        }
      } else if (step === "single_back_crop") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (state.singleBackCrop) dispatch({ type: "CONFIRM_SINGLE_BACK_CROP" });
        } else if (e.key === "1") {
          e.preventDefault();
          if (!rotating) handleRotateBack();
        } else if (e.key === "^" || e.key === "Dead") {
          e.preventDefault();
          if (cameraConnected && !retaking) retakeBack();
        }
      } else if (step === "numisbrief_back_crop") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (state.numisbriefBackCrop) dispatch({ type: "CONFIRM_NUMISBRIEF_BACK_CROP" });
        } else if (e.key === "1") {
          e.preventDefault();
          if (!rotating) handleRotateBack();
        } else if (e.key === "^" || e.key === "Dead") {
          e.preventDefault();
          if (cameraConnected && !retaking) retakeBack();
        }
      } else if (step === "grid_config") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          if (gridCoinCount > 0) dispatch({ type: "CONFIRM_GRID_FRONT" });
        } else if (e.key === "1") {
          e.preventDefault();
          if (!rotating) handleRotateFront();
        } else if (e.key === "^" || e.key === "Dead") {
          e.preventDefault();
          if (cameraConnected && !retaking) retakeFront();
        }
      } else if (step === "multi_crop") {
        if (e.key === " " || e.key === "Enter") {
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
        } else if (e.key === "1") {
          e.preventDefault();
          if (!rotating) handleRotateFront();
        } else if (e.key === "^" || e.key === "Dead") {
          e.preventDefault();
          if (cameraConnected && !retaking) retakeFront();
        }
      } else if (step === "grid_back_capture") {
        if ((e.key === " " || e.key === "Enter") && cameraConnected) {
          e.preventDefault();
          handleCaptureBack();
        } else if ((e.key === "l" || e.key === "L") && !cameraConnected) {
          e.preventDefault();
          backFileInputRef.current?.click();
        } else if (e.key === "1") {
          e.preventDefault();
          dispatch({ type: "SKIP_BACK_CAPTURE" });
        }
      } else if (step === "multi_back_capture") {
        if ((e.key === " " || e.key === "Enter") && cameraConnected) {
          e.preventDefault();
          handleCaptureBack();
        } else if ((e.key === "l" || e.key === "L") && !cameraConnected) {
          e.preventDefault();
          backFileInputRef.current?.click();
        } else if (e.key === "1") {
          e.preventDefault();
          dispatch({ type: "SKIP_MULTI_BACK" });
        }
      } else if (step === "grid_back_align") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          dispatch({ type: "CONFIRM_BACK_GRID_ALIGN" });
        } else if (e.key === "1") {
          e.preventDefault();
          if (!rotating) handleRotateBack();
        } else if (e.key === "^" || e.key === "Dead") {
          e.preventDefault();
          dispatch({ type: "RETAKE_BACK" });
        }
      } else if (step === "multi_back_align") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          dispatch({ type: "CONFIRM_MULTI_BACK_ALIGN" });
        } else if (e.key === "1") {
          e.preventDefault();
          if (!rotating) handleRotateBack();
        } else if (e.key === "Tab") {
          e.preventDefault();
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
        } else if (e.key === "^" || e.key === "Dead") {
          e.preventDefault();
          dispatch({ type: "RETAKE_MULTI_BACK" });
        }
      } else if (step === "coin_entry" && state.coins.length > 1) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (e.key === "ArrowUp" && state.currentCoinIndex > 0) {
          e.preventDefault();
          dispatch({ type: "GO_TO_COIN", index: state.currentCoinIndex - 1 });
        } else if (e.key === "ArrowDown" && state.currentCoinIndex < state.coins.length - 1) {
          e.preventDefault();
          dispatch({ type: "GO_TO_COIN", index: state.currentCoinIndex + 1 });
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    state.step, state.multiCrops, state.multiBackCrops,
    state.selectedMultiCropId, state.currentCoinIndex, state.coins.length,
    rotating, retaking, gridCoinCount,
    cameraConnected, capturePhoto, captureBackPhoto, captureNumisbriefBack,
    handleRotateFront, handleRotateBack, handleCaptureBack,
    retakeFront, retakeBack, dispatch,
  ]);

  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-8">
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
              Numisbrief<Kbd>4</Kbd>
            </Button>
            <Button
              size="lg"
              variant={state.backOnly ? "default" : "outline"}
              onClick={() => dispatch({ type: "MARK_AS_BACK" })}
            >
              Dies ist die Rückseite<Kbd>5</Kbd>
            </Button>
            {cameraConnected && (
              <Button
                size="lg"
                variant="ghost"
                onClick={retakeFront}
                disabled={retaking}
              >
                {retaking ? "Aufnahme..." : <>Neu aufnehmen<Kbd>^</Kbd></>}
              </Button>
            )}
          </div>
          {state.frontPhoto && (
            <div className="flex justify-center">
              <img
                src={state.frontPhoto}
                alt="Aufnahme"
                className="max-h-[70vh] w-auto rounded-lg border object-contain"
              />
            </div>
          )}
        </div>
      )}

      {/* Step: Single crop */}
      {state.step === "single_crop" &&
        state.frontPhoto && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {state.singleCrop ? "Ausschnitt wählen" : "Zeichne einen Ausschnitt"}
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRotateFront}
                  disabled={rotating}
                >
                  Drehen<Kbd>1</Kbd>
                </Button>
                {cameraConnected && (
                  <Button
                    variant="ghost"
                    onClick={retakeFront}
                    disabled={retaking}
                  >
                    {retaking ? "..." : <>Neu aufnehmen<Kbd>^</Kbd></>}
                  </Button>
                )}
                <Button
                  onClick={() =>
                    dispatch({ type: "CONFIRM_SINGLE_CROP" })
                  }
                  disabled={!state.singleCrop}
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
              Zeichne einen Ausschnitt um die Münze. Shift halten für quadratisch.
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
              Überspringen<Kbd>1</Kbd>
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
                className="max-h-[40vh] w-auto rounded-lg border object-contain"
              />
            </div>
          )}
        </div>
      )}

      {/* Step: Single back crop */}
      {state.step === "single_back_crop" &&
        state.backPhoto && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {state.singleBackCrop ? "Rückseite: Ausschnitt wählen" : "Zeichne einen Ausschnitt"}
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRotateBack}
                  disabled={rotating}
                >
                  Drehen<Kbd>1</Kbd>
                </Button>
                {cameraConnected && (
                  <Button
                    variant="ghost"
                    onClick={retakeBack}
                    disabled={retaking}
                  >
                    {retaking ? "..." : <>Neu aufnehmen<Kbd>^</Kbd></>}
                  </Button>
                )}
                <Button
                  onClick={() =>
                    dispatch({ type: "CONFIRM_SINGLE_BACK_CROP" })
                  }
                  disabled={!state.singleBackCrop}
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
              Zeichne einen Ausschnitt um die Rückseite. Shift halten für quadratisch.
            </p>
          </div>
        )}

      {/* Step: Numisbrief crop */}
      {state.step === "numisbrief_crop" &&
        state.frontPhoto && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {state.numisbriefCrop ? "Numisbrief — Ausschnitt wählen" : "Zeichne einen Ausschnitt"}
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRotateFront}
                  disabled={rotating}
                >
                  Drehen<Kbd>1</Kbd>
                </Button>
                {cameraConnected && (
                  <Button
                    variant="ghost"
                    onClick={retakeFront}
                    disabled={retaking}
                  >
                    {retaking ? "..." : <>Neu aufnehmen<Kbd>^</Kbd></>}
                  </Button>
                )}
                <Button
                  onClick={() =>
                    dispatch({ type: "CONFIRM_NUMISBRIEF_CROP" })
                  }
                  disabled={!state.numisbriefCrop}
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
            />
            <p className="text-sm text-muted-foreground">
              Zeichne einen Ausschnitt um den Numisbrief. Shift halten für quadratisch.
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
              <Button
                size="lg"
                variant="outline"
                onClick={() => backFileInputRef.current?.click()}
              >
                Bild laden<Kbd>L</Kbd>
              </Button>
            )}
            <Button
              size="lg"
              variant="ghost"
              onClick={() =>
                dispatch({ type: "SKIP_NUMISBRIEF_BACK" })
              }
            >
              Überspringen<Kbd>1</Kbd>
            </Button>
          </div>
        </div>
      )}

      {/* Step: Numisbrief back crop */}
      {state.step === "numisbrief_back_crop" &&
        state.backPhoto && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {state.numisbriefBackCrop ? "Numisbrief Rückseite — Ausschnitt wählen" : "Zeichne einen Ausschnitt"}
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRotateBack}
                  disabled={rotating}
                >
                  Drehen<Kbd>1</Kbd>
                </Button>
                {cameraConnected && (
                  <Button
                    variant="ghost"
                    onClick={retakeBack}
                    disabled={retaking}
                  >
                    {retaking ? "..." : <>Neu aufnehmen<Kbd>^</Kbd></>}
                  </Button>
                )}
                <Button
                  onClick={() =>
                    dispatch({ type: "CONFIRM_NUMISBRIEF_BACK_CROP" })
                  }
                  disabled={!state.numisbriefBackCrop}
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
            />
            <p className="text-sm text-muted-foreground">
              Zeichne einen Ausschnitt um die Rückseite des Numisbriefs. Shift halten für quadratisch.
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
                Drehen<Kbd>1</Kbd>
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
                onCancel={() => {
                  if (cameraConnected) retakeFront();
                  else dispatch({ type: "RESET" });
                }}
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
            Drehe die Münzen um und nehme ein Foto der Rückseiten auf.
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
              Überspringen<Kbd>1</Kbd>
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
                className="max-h-[40vh] w-auto rounded-lg border object-contain"
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
                Drehen<Kbd>1</Kbd>
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
                    Neu aufnehmen<Kbd>^</Kbd>
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
              Drehen<Kbd>1</Kbd>
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
              onCancel={() => {
                if (cameraConnected) retakeFront();
                else dispatch({ type: "RESET" });
              }}
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
            Drehe die Münzen um und nehme ein Foto der Rückseiten auf.
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
              Überspringen<Kbd>1</Kbd>
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
                className="max-h-[40vh] w-auto rounded-lg border object-contain"
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
              Drehen<Kbd>1</Kbd>
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
                  Neu aufnehmen<Kbd>^</Kbd>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step: Coin entry */}
      {state.step === "coin_entry" && (
        <div className={state.coins.length > 1 ? "flex gap-6" : ""}>
          {/* Coin sidebar for multi-coin */}
          {state.coins.length > 1 && (
            <div className="w-48 shrink-0 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Münzen</h3>
                <span className="text-xs text-muted-foreground">
                  {state.currentCoinIndex + 1}/{state.coins.length}
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={state.currentCoinIndex === 0}
                  onClick={() => dispatch({ type: "PREV_COIN" })}
                >
                  ←
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={state.currentCoinIndex >= state.coins.length - 1}
                  onClick={() => dispatch({ type: "NEXT_COIN" })}
                >
                  →
                </Button>
              </div>
              <div className="space-y-1 max-h-[70vh] overflow-y-auto">
                {state.coins.map((coin, idx) => {
                  const isCurrent = idx === state.currentCoinIndex;
                  const isSaved = savedCoinIndices.has(idx);
                  const isSkipped = skippedCoinIndices.has(idx);
                  const thumb = coinThumbnails.get(idx);
                  return (
                    <button
                      key={idx}
                      onClick={() => dispatch({ type: "GO_TO_COIN", index: idx })}
                      className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors ${
                        isCurrent
                          ? "border-primary bg-primary/10 font-medium"
                          : isSaved
                            ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20"
                            : isSkipped
                              ? "border-transparent opacity-60"
                              : "border-transparent hover:bg-muted"
                      }`}
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={`Münze ${idx + 1}`}
                          className="h-8 w-8 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-muted text-xs">
                          {idx + 1}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <span>Münze {idx + 1}</span>
                        {state.mode === "grid" && coin.gridRow != null && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            Z{(coin.gridRow ?? 0) + 1}S{(coin.gridCol ?? 0) + 1}
                          </span>
                        )}
                      </div>
                      {isSaved && (
                        <span className="text-xs text-green-600">✓</span>
                      )}
                      {isSkipped && (
                        <span className="text-xs text-muted-foreground">–</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Main form area */}
          <div className="min-w-0 flex-1">
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
                  onSaveAndContinue={handleSaveAndContinue}
                  onSaveAndNew={handleSaveAndNew}
                  onSaveAndExit={handleSaveAndExit}
                  onSkip={
                    state.coins.length > 1
                      ? () => {
                          setSkippedCoinIndices(prev => new Set(prev).add(state.currentCoinIndex));
                          dispatch({ type: "COIN_SAVED" });
                        }
                      : undefined
                  }
                  coinIndex={state.currentCoinIndex}
                  totalCoins={state.coins.length}
                  saving={saving}
                  cameraConnected={cameraConnected}
                  collections={collections}
                  onCollectionsChange={setCollections}
                  allCoinsHandled={allHandledAfterSave}
                />
              </CardContent>
            </Card>
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
    </div>
  );
}

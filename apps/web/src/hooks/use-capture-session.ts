"use client";

import { useReducer, useCallback } from "react";
import { toast } from "sonner";
import type {
  CaptureState,
  CaptureAction,
  CropRect,
  GridConfig,
  GridOverlayState,
  CapturedCoin,
  CoinFormData,
  FlipMode,
} from "@/types/capture";

const initialState: CaptureState = {
  step: "idle",
  mode: null,
  frontPhoto: null,
  backPhoto: null,
  imageWidth: 0,
  imageHeight: 0,
  backImageWidth: 0,
  backImageHeight: 0,
  gridConfig: null,
  gridOverlay: null,
  singleCrop: null,
  singleBackCrop: null,
  flipMode: "book" as FlipMode,
  backGridOverlay: null,
  coins: [],
  currentCoinIndex: 0,
  sessionDefaults: {},
};

function extractGridCoins(
  gridConfig: GridConfig,
  gridOverlay: GridOverlayState
): CapturedCoin[] {
  const coins: CapturedCoin[] = [];
  const cellWidth = gridOverlay.width / gridConfig.cols;
  const cellHeight = gridOverlay.height / gridConfig.rows;

  for (let row = 0; row < gridConfig.rows; row++) {
    for (let col = 0; col < gridConfig.cols; col++) {
      const slotIndex = row * gridConfig.cols + col;
      if (gridConfig.emptySlots.includes(slotIndex)) continue;

      coins.push({
        index: coins.length,
        gridRow: row,
        gridCol: col,
        frontCrop: {
          x: gridOverlay.x + col * cellWidth,
          y: gridOverlay.y + row * cellHeight,
          width: cellWidth,
          height: cellHeight,
        },
      });
    }
  }
  return coins;
}

function captureReducer(
  state: CaptureState,
  action: CaptureAction
): CaptureState {
  switch (action.type) {
    case "START_CAPTURE":
      return { ...state, step: "capturing" };

    case "CAPTURE_COMPLETE":
      return {
        ...state,
        step: "select_mode",
        frontPhoto: action.photo,
        imageWidth: action.width,
        imageHeight: action.height,
      };

    case "CAPTURE_FAILED":
      // If we were capturing the back side, go back to the back capture step
      if (state.mode === "single" && state.coins.length > 0 && !state.backPhoto) {
        return { ...state, step: "single_back_capture" };
      }
      if (state.step === "capturing" && state.mode === "grid" && state.coins.length > 0) {
        return { ...state, step: "grid_back_capture" };
      }
      return { ...state, step: "idle" };

    case "SELECT_MODE":
      if (action.mode === "single") {
        return {
          ...state,
          step: "single_crop",
          mode: "single",
          singleCrop: {
            x: state.imageWidth * 0.25,
            y: state.imageHeight * 0.25,
            width: Math.min(state.imageWidth, state.imageHeight) * 0.5,
            height: Math.min(state.imageWidth, state.imageHeight) * 0.5,
          },
        };
      }
      return {
        ...state,
        step: "grid_config",
        mode: "grid",
        gridConfig: { rows: 3, cols: 3, emptySlots: [] },
        gridOverlay: {
          x: state.imageWidth * 0.1,
          y: state.imageHeight * 0.1,
          width: state.imageWidth * 0.8,
          height: state.imageHeight * 0.8,
        },
      };

    case "SET_SINGLE_CROP":
      return { ...state, singleCrop: action.crop };

    case "CONFIRM_SINGLE_CROP":
      return {
        ...state,
        step: "single_back_capture",
        coins: [
          {
            index: 0,
            frontCrop: state.singleCrop!,
          },
        ],
        currentCoinIndex: 0,
      };

    case "SINGLE_BACK_COMPLETE":
      return {
        ...state,
        step: "single_back_crop",
        backPhoto: action.photo,
        backImageWidth: action.width,
        backImageHeight: action.height,
        singleBackCrop: {
          x: action.width * 0.25,
          y: action.height * 0.25,
          width: Math.min(action.width, action.height) * 0.5,
          height: Math.min(action.width, action.height) * 0.5,
        },
      };

    case "SET_SINGLE_BACK_CROP":
      return { ...state, singleBackCrop: action.crop };

    case "CONFIRM_SINGLE_BACK_CROP": {
      const coinsWithBack = state.coins.map((coin) => ({
        ...coin,
        backCrop: state.singleBackCrop!,
      }));
      return {
        ...state,
        step: "coin_entry",
        coins: coinsWithBack,
      };
    }

    case "SKIP_SINGLE_BACK":
      return {
        ...state,
        step: "coin_entry",
      };

    case "SET_GRID_CONFIG":
      return { ...state, gridConfig: action.config };

    case "SET_GRID_OVERLAY":
      return { ...state, gridOverlay: action.overlay };

    case "TOGGLE_GRID_EMPTY_SLOT": {
      if (!state.gridConfig) return state;
      const emptySlots = state.gridConfig.emptySlots.includes(
        action.slotIndex
      )
        ? state.gridConfig.emptySlots.filter((s) => s !== action.slotIndex)
        : [...state.gridConfig.emptySlots, action.slotIndex];
      return {
        ...state,
        gridConfig: { ...state.gridConfig, emptySlots },
      };
    }

    case "CONFIRM_GRID_FRONT": {
      const coins = extractGridCoins(state.gridConfig!, state.gridOverlay!);
      return {
        ...state,
        step: "grid_back_capture",
        coins,
      };
    }

    case "SET_FLIP_MODE":
      return { ...state, flipMode: action.flipMode };

    case "START_BACK_CAPTURE":
      return { ...state, step: "capturing" };

    case "BACK_CAPTURE_COMPLETE":
      return {
        ...state,
        step: "grid_back_align",
        backPhoto: action.photo,
        backImageWidth: action.width,
        backImageHeight: action.height,
        // Initialize back grid overlay from front grid as starting point
        backGridOverlay: state.gridOverlay ? { ...state.gridOverlay } : null,
      };

    case "SET_BACK_GRID_OVERLAY":
      return { ...state, backGridOverlay: action.overlay };

    case "CONFIRM_BACK_GRID_ALIGN": {
      // Extract back crops from the re-aligned back grid overlay
      const backOverlay = state.backGridOverlay!;
      const gridCfg = state.gridConfig!;
      const cellW = backOverlay.width / gridCfg.cols;
      const cellH = backOverlay.height / gridCfg.rows;

      const coinsWithBack = state.coins.map((coin) => ({
        ...coin,
        backCrop:
          coin.gridRow !== undefined && coin.gridCol !== undefined
            ? {
                x: backOverlay.x + coin.gridCol * cellW,
                y: backOverlay.y + coin.gridRow * cellH,
                width: cellW,
                height: cellH,
              }
            : coin.frontCrop,
      }));
      return {
        ...state,
        step: "coin_entry",
        coins: coinsWithBack,
        currentCoinIndex: 0,
      };
    }

    case "ROTATE_FRONT":
      return {
        ...state,
        frontPhoto: action.photo,
        imageWidth: action.width,
        imageHeight: action.height,
        // Reset crop to center of rotated image
        singleCrop: state.singleCrop
          ? {
              x: action.width * 0.25,
              y: action.height * 0.25,
              width: Math.min(action.width, action.height) * 0.5,
              height: Math.min(action.width, action.height) * 0.5,
            }
          : null,
        // Reset grid overlay for rotated image
        gridOverlay: state.gridOverlay
          ? {
              x: action.width * 0.1,
              y: action.height * 0.1,
              width: action.width * 0.8,
              height: action.height * 0.8,
            }
          : null,
      };

    case "ROTATE_BACK":
      return {
        ...state,
        backPhoto: action.photo,
        backImageWidth: action.width,
        backImageHeight: action.height,
        singleBackCrop: state.singleBackCrop
          ? {
              x: action.width * 0.25,
              y: action.height * 0.25,
              width: Math.min(action.width, action.height) * 0.5,
              height: Math.min(action.width, action.height) * 0.5,
            }
          : null,
        backGridOverlay: state.backGridOverlay
          ? {
              x: action.width * 0.1,
              y: action.height * 0.1,
              width: action.width * 0.8,
              height: action.height * 0.8,
            }
          : null,
      };

    case "SKIP_BACK_CAPTURE":
      return {
        ...state,
        step: "coin_entry",
        currentCoinIndex: 0,
      };

    case "RETAKE_BACK":
      return {
        ...state,
        step: "grid_back_capture",
        backPhoto: null,
        backGridOverlay: null,
      };

    case "NEXT_COIN":
      if (state.currentCoinIndex < state.coins.length - 1) {
        return {
          ...state,
          currentCoinIndex: state.currentCoinIndex + 1,
        };
      }
      return state;

    case "PREV_COIN":
      if (state.currentCoinIndex > 0) {
        return {
          ...state,
          currentCoinIndex: state.currentCoinIndex - 1,
        };
      }
      return state;

    case "SAVE_COIN":
      return { ...state, step: "saving" };

    case "COIN_SAVED": {
      const isLastCoin =
        state.currentCoinIndex >= state.coins.length - 1;
      if (isLastCoin) {
        return { ...state, step: "saved" };
      }
      return {
        ...state,
        step: "coin_entry",
        currentCoinIndex: state.currentCoinIndex + 1,
      };
    }

    case "SET_SESSION_DEFAULTS":
      return { ...state, sessionDefaults: action.defaults };

    case "CONTINUE_WITH_SESSION":
      return {
        ...initialState,
        sessionDefaults: state.sessionDefaults,
      };

    case "START_FRESH":
      return initialState;

    case "RESET":
      return { ...initialState, sessionDefaults: state.sessionDefaults };

    default:
      return state;
  }
}

export function useCaptureSession() {
  const [state, dispatch] = useReducer(captureReducer, initialState);

  const capturePhoto = useCallback(async () => {
    dispatch({ type: "START_CAPTURE" });
    try {
      console.log("[capture] Fetching /api/camera/capture...");
      const response = await fetch("/api/camera/capture", { method: "POST" });
      console.log("[capture] Response:", response.status, response.headers.get("content-type"));

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status}: ${body}`);
      }

      console.log("[capture] Reading blob...");
      const blob = await response.blob();
      console.log("[capture] Blob size:", blob.size, "type:", blob.type);

      const url = URL.createObjectURL(blob);

      // Get image dimensions
      console.log("[capture] Loading image...");
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          console.log("[capture] Image loaded:", img.naturalWidth, "x", img.naturalHeight);
          resolve();
        };
        img.onerror = (e) => {
          console.error("[capture] Image load error:", e);
          reject(new Error("Bild konnte nicht geladen werden"));
        };
        img.src = url;
      });

      dispatch({
        type: "CAPTURE_COMPLETE",
        photo: url,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    } catch (error) {
      console.error("[capture] Failed:", error);
      const msg = error instanceof Error
        ? error.message
        : String(error);
      toast.error(`Aufnahme fehlgeschlagen: ${msg}`);
      dispatch({ type: "CAPTURE_FAILED" });
    }
  }, []);

  const loadTestImage = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      dispatch({
        type: "CAPTURE_COMPLETE",
        photo: url,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.src = url;
  }, []);

  const captureBackPhoto = useCallback(async () => {
    dispatch({ type: "START_BACK_CAPTURE" });
    try {
      const response = await fetch("/api/camera/capture", { method: "POST" });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status}: ${body}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
        img.src = url;
      });

      dispatch({
        type: "SINGLE_BACK_COMPLETE",
        photo: url,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Rückseite fehlgeschlagen: ${msg}`);
      dispatch({ type: "CAPTURE_FAILED" });
    }
  }, []);

  return { state, dispatch, capturePhoto, captureBackPhoto, loadTestImage };
}

"use client";

import { useReducer, useCallback } from "react";
import { toast } from "sonner";
import { rotateImage90 } from "@/lib/crop-preview";
import type {
  CaptureState,
  CaptureAction,
  CropRect,
  GridConfig,
  GridOverlayState,
  CapturedCoin,
  CoinFormData,
  FlipMode,
  MultiCropItem,
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
  multiCrops: [],
  multiBackCrops: [],
  selectedMultiCropId: null,
  numisbriefCrop: null,
  numisbriefBackCrop: null,
  backOnly: false,
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

function extractMultiCoins(
  front: MultiCropItem[],
  back: MultiCropItem[]
): CapturedCoin[] {
  return front.map((item, index) => ({
    index,
    frontCrop: item.crop,
    backCrop: back.find((b) => b.id === item.id)?.crop,
  }));
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
      if (state.mode === "numisbrief" && state.coins.length > 0 && !state.backPhoto) {
        return { ...state, step: "numisbrief_back_capture" };
      }
      if (state.step === "capturing" && state.mode === "grid" && state.coins.length > 0) {
        return { ...state, step: "grid_back_capture" };
      }
      if (state.step === "capturing" && state.mode === "multi" && state.multiCrops.length > 0) {
        return { ...state, step: "multi_back_capture" };
      }
      return { ...state, step: "idle" };

    case "MARK_AS_BACK":
      return { ...state, backOnly: true };

    case "SELECT_MODE":
      if (action.mode === "single") {
        return {
          ...state,
          step: "single_crop",
          mode: "single",
          singleCrop: null,
        };
      }
      if (action.mode === "numisbrief") {
        return {
          ...state,
          step: "numisbrief_crop",
          mode: "numisbrief",
          numisbriefCrop: null,
        };
      }
      if (action.mode === "multi") {
        return {
          ...state,
          step: "multi_crop",
          mode: "multi",
          multiCrops: [],
          multiBackCrops: [],
          selectedMultiCropId: null,
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
      if (state.backOnly) {
        return {
          ...state,
          step: "coin_entry",
          mode: "single",
          backPhoto: state.frontPhoto,
          backImageWidth: state.imageWidth,
          backImageHeight: state.imageHeight,
          frontPhoto: null,
          imageWidth: 0,
          imageHeight: 0,
          coins: [{ index: 0, backCrop: state.singleCrop! }],
          currentCoinIndex: 0,
        };
      }
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
        singleBackCrop: null,
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
      if (state.backOnly) {
        const backCoins = coins.map((c) => ({
          ...c,
          backCrop: c.frontCrop,
          frontCrop: undefined,
        }));
        return {
          ...state,
          step: "coin_entry",
          coins: backCoins,
          backPhoto: state.frontPhoto,
          backImageWidth: state.imageWidth,
          backImageHeight: state.imageHeight,
          frontPhoto: null,
          imageWidth: 0,
          imageHeight: 0,
          currentCoinIndex: 0,
        };
      }
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

    case "ADD_MULTI_CROP":
      return {
        ...state,
        multiCrops: [...state.multiCrops, action.crop],
        selectedMultiCropId: action.crop.id,
      };

    case "UPDATE_MULTI_CROP":
      return {
        ...state,
        multiCrops: state.multiCrops.map((c) =>
          c.id === action.id ? { ...c, crop: action.crop } : c
        ),
      };

    case "DELETE_MULTI_CROP": {
      const remaining = state.multiCrops.filter((c) => c.id !== action.id);
      return {
        ...state,
        multiCrops: remaining,
        selectedMultiCropId:
          state.selectedMultiCropId === action.id
            ? remaining.length > 0
              ? remaining[remaining.length - 1].id
              : null
            : state.selectedMultiCropId,
      };
    }

    case "SELECT_MULTI_CROP":
      return { ...state, selectedMultiCropId: action.id };

    case "CONFIRM_MULTI_FRONT": {
      if (state.backOnly) {
        const coins = state.multiCrops.map((item, index) => ({
          index,
          backCrop: item.crop,
        }));
        return {
          ...state,
          step: "coin_entry",
          coins,
          backPhoto: state.frontPhoto,
          backImageWidth: state.imageWidth,
          backImageHeight: state.imageHeight,
          frontPhoto: null,
          imageWidth: 0,
          imageHeight: 0,
          currentCoinIndex: 0,
        };
      }
      const coins = extractMultiCoins(state.multiCrops, []);
      return {
        ...state,
        step: "multi_back_capture",
        coins,
      };
    }

    case "MULTI_BACK_COMPLETE": {
      // Initialize back crops from front crops, mirrored if book-flip
      const backCrops: MultiCropItem[] = state.multiCrops.map((item) => ({
        id: item.id,
        crop:
          state.flipMode === "book"
            ? {
                x: action.width - item.crop.x - item.crop.width,
                y: item.crop.y,
                width: item.crop.width,
                height: item.crop.height,
              }
            : { ...item.crop },
      }));
      return {
        ...state,
        step: "multi_back_align",
        backPhoto: action.photo,
        backImageWidth: action.width,
        backImageHeight: action.height,
        multiBackCrops: backCrops,
        selectedMultiCropId: backCrops.length > 0 ? backCrops[0].id : null,
      };
    }

    case "UPDATE_MULTI_BACK_CROP":
      return {
        ...state,
        multiBackCrops: state.multiBackCrops.map((c) =>
          c.id === action.id ? { ...c, crop: action.crop } : c
        ),
      };

    case "SELECT_MULTI_BACK_CROP":
      return { ...state, selectedMultiCropId: action.id };

    case "CONFIRM_MULTI_BACK_ALIGN": {
      const coinsWithBack = extractMultiCoins(
        state.multiCrops,
        state.multiBackCrops
      );
      return {
        ...state,
        step: "coin_entry",
        coins: coinsWithBack,
        currentCoinIndex: 0,
      };
    }

    case "SKIP_MULTI_BACK":
      return {
        ...state,
        step: "coin_entry",
        coins: extractMultiCoins(state.multiCrops, []),
        currentCoinIndex: 0,
      };

    case "RETAKE_MULTI_BACK":
      return {
        ...state,
        step: "multi_back_capture",
        backPhoto: null,
        multiBackCrops: [],
      };

    case "SET_NUMISBRIEF_CROP":
      return { ...state, numisbriefCrop: action.crop };

    case "CONFIRM_NUMISBRIEF_CROP":
      if (state.backOnly) {
        return {
          ...state,
          step: "coin_entry",
          mode: "numisbrief",
          backPhoto: state.frontPhoto,
          backImageWidth: state.imageWidth,
          backImageHeight: state.imageHeight,
          frontPhoto: null,
          imageWidth: 0,
          imageHeight: 0,
          coins: [{ index: 0, backCrop: state.numisbriefCrop! }],
          currentCoinIndex: 0,
        };
      }
      return {
        ...state,
        step: "numisbrief_back_capture",
        coins: [{ index: 0, frontCrop: state.numisbriefCrop! }],
        currentCoinIndex: 0,
      };

    case "NUMISBRIEF_BACK_COMPLETE":
      return {
        ...state,
        step: "numisbrief_back_crop",
        backPhoto: action.photo,
        backImageWidth: action.width,
        backImageHeight: action.height,
        numisbriefBackCrop: null,
      };

    case "SET_NUMISBRIEF_BACK_CROP":
      return { ...state, numisbriefBackCrop: action.crop };

    case "CONFIRM_NUMISBRIEF_BACK_CROP": {
      const coinsWithBack = state.coins.map((coin) => ({
        ...coin,
        backCrop: state.numisbriefBackCrop!,
      }));
      return {
        ...state,
        step: "coin_entry",
        coins: coinsWithBack,
      };
    }

    case "SKIP_NUMISBRIEF_BACK":
      return {
        ...state,
        step: "coin_entry",
      };

    case "RETAKE_NUMISBRIEF_BACK":
      return {
        ...state,
        step: "numisbrief_back_capture",
        backPhoto: null,
        numisbriefBackCrop: null,
      };

    case "RETAKE_FRONT": {
      // Replace front photo, stay in current step, reset mode-specific crops
      const retakeState: CaptureState = {
        ...state,
        frontPhoto: action.photo,
        imageWidth: action.width,
        imageHeight: action.height,
      };
      // Reset crops based on current mode/step
      if (state.step === "single_crop" || state.mode === "single") {
        retakeState.singleCrop = {
          x: action.width * 0.25,
          y: action.height * 0.25,
          width: Math.min(action.width, action.height) * 0.5,
          height: Math.min(action.width, action.height) * 0.5,
        };
      }
      if (state.step === "numisbrief_crop" || state.mode === "numisbrief") {
        retakeState.numisbriefCrop = {
          x: action.width * 0.1,
          y: action.height * 0.1,
          width: action.width * 0.8,
          height: action.height * 0.8,
        };
      }
      if (state.step === "grid_config" || state.mode === "grid") {
        retakeState.gridOverlay = {
          x: action.width * 0.1,
          y: action.height * 0.1,
          width: action.width * 0.8,
          height: action.height * 0.8,
        };
      }
      if (state.step === "multi_crop" || state.mode === "multi") {
        retakeState.multiCrops = [];
        retakeState.selectedMultiCropId = null;
      }
      return retakeState;
    }

    case "RETAKE_BACK_PHOTO": {
      // Replace back photo in back-crop steps
      const retakeBackState: CaptureState = {
        ...state,
        backPhoto: action.photo,
        backImageWidth: action.width,
        backImageHeight: action.height,
      };
      if (state.mode === "single") {
        retakeBackState.singleBackCrop = {
          x: action.width * 0.25,
          y: action.height * 0.25,
          width: Math.min(action.width, action.height) * 0.5,
          height: Math.min(action.width, action.height) * 0.5,
        };
      }
      if (state.mode === "numisbrief") {
        retakeBackState.numisbriefBackCrop = {
          x: action.width * 0.1,
          y: action.height * 0.1,
          width: action.width * 0.8,
          height: action.height * 0.8,
        };
      }
      return retakeBackState;
    }

    case "ROTATE_FRONT": {
      const oldFrontH = state.imageHeight;
      return {
        ...state,
        frontPhoto: action.photo,
        imageWidth: action.width,
        imageHeight: action.height,
        singleCrop: null,
        numisbriefCrop: null,
        gridOverlay: state.gridOverlay
          ? {
              x: oldFrontH - state.gridOverlay.y - state.gridOverlay.height,
              y: state.gridOverlay.x,
              width: state.gridOverlay.height,
              height: state.gridOverlay.width,
            }
          : null,
        multiCrops:
          state.mode === "multi"
            ? state.multiCrops.map((item) => ({
                id: item.id,
                crop: {
                  x: oldFrontH - item.crop.y - item.crop.height,
                  y: item.crop.x,
                  width: item.crop.height,
                  height: item.crop.width,
                },
              }))
            : state.multiCrops,
      };
    }

    case "ROTATE_BACK": {
      const oldBackH = state.backImageHeight;
      return {
        ...state,
        backPhoto: action.photo,
        backImageWidth: action.width,
        backImageHeight: action.height,
        singleBackCrop: null,
        numisbriefBackCrop: null,
        backGridOverlay: state.backGridOverlay
          ? {
              x: oldBackH - state.backGridOverlay.y - state.backGridOverlay.height,
              y: state.backGridOverlay.x,
              width: state.backGridOverlay.height,
              height: state.backGridOverlay.width,
            }
          : null,
        multiBackCrops:
          state.mode === "multi"
            ? state.multiBackCrops.map((item) => ({
                id: item.id,
                crop: {
                  x: oldBackH - item.crop.y - item.crop.height,
                  y: item.crop.x,
                  width: item.crop.height,
                  height: item.crop.width,
                },
              }))
            : state.multiBackCrops,
      };
    }

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

    case "RETAKE_SINGLE_BACK":
      return {
        ...state,
        step: "single_back_capture",
        backPhoto: null,
        singleBackCrop: null,
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

    case "GO_TO_COIN":
      if (action.index >= 0 && action.index < state.coins.length) {
        return { ...state, currentCoinIndex: action.index };
      }
      return state;

    case "SAVE_COIN":
      return { ...state, step: "saving" };

    case "COIN_SAVED": {
      const isLastCoin =
        state.currentCoinIndex >= state.coins.length - 1;
      if (isLastCoin) {
        // No more "saved" step — handled by save modes in page.tsx
        return state;
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

      let finalUrl = URL.createObjectURL(blob);

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
        img.src = finalUrl;
      });

      let finalWidth = img.naturalWidth;
      let finalHeight = img.naturalHeight;

      // Apply saved camera rotation
      const savedRotation = parseInt(localStorage.getItem("camera-rotation") || "0");
      if (savedRotation > 0) {
        const rotations = savedRotation / 90;
        for (let i = 0; i < rotations; i++) {
          const result = await rotateImage90(finalUrl, finalWidth, finalHeight);
          URL.revokeObjectURL(finalUrl);
          finalUrl = result.url;
          finalWidth = result.width;
          finalHeight = result.height;
        }
      }

      dispatch({
        type: "CAPTURE_COMPLETE",
        photo: finalUrl,
        width: finalWidth,
        height: finalHeight,
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
      let finalUrl = URL.createObjectURL(blob);

      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
        img.src = finalUrl;
      });

      let finalWidth = img.naturalWidth;
      let finalHeight = img.naturalHeight;

      // Apply saved camera rotation
      const savedRotation = parseInt(localStorage.getItem("camera-rotation") || "0");
      if (savedRotation > 0) {
        const rotations = savedRotation / 90;
        for (let i = 0; i < rotations; i++) {
          const result = await rotateImage90(finalUrl, finalWidth, finalHeight);
          URL.revokeObjectURL(finalUrl);
          finalUrl = result.url;
          finalWidth = result.width;
          finalHeight = result.height;
        }
      }

      dispatch({
        type: "SINGLE_BACK_COMPLETE",
        photo: finalUrl,
        width: finalWidth,
        height: finalHeight,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Rückseite fehlgeschlagen: ${msg}`);
      dispatch({ type: "CAPTURE_FAILED" });
    }
  }, []);

  return { state, dispatch, capturePhoto, captureBackPhoto, loadTestImage };
}

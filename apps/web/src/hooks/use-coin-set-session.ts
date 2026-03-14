"use client";

import { useReducer, useCallback, useMemo } from "react";
import type { CropRect } from "@/types/capture";
import type {
  CoinSetSessionConfig,
  CoinSetSessionState,
  CoinSetAction,
} from "@/types/coin-set";

const STORAGE_KEY_CROPS = "kms-saved-crops";
const STORAGE_KEY_CONFIG = "kms-last-config";

function loadSavedCrops(): {
  front: CropRect | null;
  back: CropRect | null;
} {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CROPS);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return { front: null, back: null };
}

function persistCrops(front: CropRect | null, back: CropRect | null) {
  try {
    localStorage.setItem(STORAGE_KEY_CROPS, JSON.stringify({ front, back }));
  } catch {
    // ignore
  }
}

export function loadLastConfig(): Partial<CoinSetSessionConfig> | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return null;
}

function persistConfig(config: CoinSetSessionConfig) {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch {
    // ignore
  }
}

const initialState: CoinSetSessionState = {
  active: false,
  config: null,
  currentMintIndex: 0,
  completedMints: [],
  savedFrontCrop: null,
  savedBackCrop: null,
};

function coinSetReducer(
  state: CoinSetSessionState,
  action: CoinSetAction
): CoinSetSessionState {
  switch (action.type) {
    case "START_SESSION": {
      const saved = loadSavedCrops();
      persistConfig(action.config);
      return {
        active: true,
        config: action.config,
        currentMintIndex: 0,
        completedMints: [],
        savedFrontCrop: saved.front,
        savedBackCrop: saved.back,
      };
    }

    case "SAVE_CROPS": {
      persistCrops(action.frontCrop, action.backCrop);
      return {
        ...state,
        savedFrontCrop: action.frontCrop,
        savedBackCrop: action.backCrop,
      };
    }

    case "COMPLETE_MINT": {
      if (!state.config) return state;
      const currentMark = state.config.mintMarks[state.currentMintIndex];
      return {
        ...state,
        completedMints: [...state.completedMints, currentMark],
        currentMintIndex: state.currentMintIndex + 1,
      };
    }

    case "SKIP_MINT": {
      return {
        ...state,
        currentMintIndex: state.currentMintIndex + 1,
      };
    }

    case "END_SESSION":
      return initialState;

    default:
      return state;
  }
}

export function useCoinSetSession() {
  const [state, dispatch] = useReducer(coinSetReducer, initialState);

  const startSession = useCallback((config: CoinSetSessionConfig) => {
    dispatch({ type: "START_SESSION", config });
  }, []);

  const saveCrops = useCallback(
    (frontCrop: CropRect | null, backCrop: CropRect | null) => {
      dispatch({ type: "SAVE_CROPS", frontCrop, backCrop });
    },
    []
  );

  const completeMint = useCallback(() => {
    dispatch({ type: "COMPLETE_MINT" });
  }, []);

  const skipMint = useCallback(() => {
    dispatch({ type: "SKIP_MINT" });
  }, []);

  const endSession = useCallback(() => {
    dispatch({ type: "END_SESSION" });
  }, []);

  const currentMintMark = useMemo(() => {
    if (!state.config || state.currentMintIndex >= state.config.mintMarks.length)
      return null;
    return state.config.mintMarks[state.currentMintIndex];
  }, [state.config, state.currentMintIndex]);

  const isLastMint = useMemo(() => {
    if (!state.config) return false;
    return state.currentMintIndex >= state.config.mintMarks.length - 1;
  }, [state.config, state.currentMintIndex]);

  const isAllDone = useMemo(() => {
    if (!state.config) return false;
    return state.currentMintIndex >= state.config.mintMarks.length;
  }, [state.config, state.currentMintIndex]);

  const progress = useMemo(() => {
    if (!state.config) return "";
    if (state.config.mintMarks.length === 0) return "";
    return `${currentMintMark ?? "?"} (${state.currentMintIndex + 1}/${state.config.mintMarks.length})`;
  }, [state.config, state.currentMintIndex, currentMintMark]);

  return {
    state,
    startSession,
    saveCrops,
    completeMint,
    skipMint,
    endSession,
    currentMintMark,
    isLastMint,
    isAllDone,
    progress,
  };
}

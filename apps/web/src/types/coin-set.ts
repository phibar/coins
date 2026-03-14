import type { CropRect, CoinFormData } from "./capture";

export type CoinSetType = "dm" | "euro";

export const GERMAN_MINT_MARKS = ["A", "D", "F", "G", "J"] as const;
export type GermanMintMark = (typeof GERMAN_MINT_MARKS)[number];

export interface CoinSetSessionConfig {
  year: number;
  setType: CoinSetType;
  country: string;
  isGerman: boolean;
  mintMarks: string[];
  condition: string;
  isProof: boolean;
  hasCase: boolean;
  collectionId: string | null;
  storageLocation: string;
}

export interface CoinSetSessionState {
  active: boolean;
  config: CoinSetSessionConfig | null;
  currentMintIndex: number;
  completedMints: string[];
  savedFrontCrop: CropRect | null;
  savedBackCrop: CropRect | null;
}

export type CoinSetAction =
  | { type: "START_SESSION"; config: CoinSetSessionConfig }
  | { type: "SAVE_CROPS"; frontCrop: CropRect | null; backCrop: CropRect | null }
  | { type: "COMPLETE_MINT" }
  | { type: "SKIP_MINT" }
  | { type: "END_SESSION" };

/** Build form data for auto-saving a set */
export function buildSetFormData(
  config: CoinSetSessionConfig,
  mintMark: string | null
): Partial<CoinFormData> {
  return {
    itemType: "muenzsatz",
    year: config.year,
    country: config.country,
    denomination: config.setType === "dm" ? "KMS DM" : "KMS Euro",
    mintMark: mintMark ?? "",
    condition: config.condition,
    isProof: config.isProof,
    hasCase: config.hasCase,
    collectionId: config.collectionId,
    storageLocation: config.storageLocation,
  };
}

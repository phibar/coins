export type CaptureMode = "single" | "grid";

export type CaptureStep =
  | "idle"
  | "capturing"
  | "photo_ready"
  | "select_mode"
  | "single_crop"
  | "single_back_capture"
  | "single_back_crop"
  | "grid_config"
  | "grid_front_confirmed"
  | "grid_back_capture"
  | "grid_back_crop"
  | "coin_entry"
  | "saving"
  | "saved";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridConfig {
  rows: number;
  cols: number;
  emptySlots: number[]; // indices of empty positions (row * cols + col)
}

export interface GridOverlayState {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CapturedCoin {
  index: number;
  gridRow?: number;
  gridCol?: number;
  frontCrop: CropRect;
  backCrop?: CropRect;
}

// Helper types for Numista Json fields
export interface NumistaFaceData {
  description?: string;
  lettering?: string;
  engravers?: string[];
}

export interface NumistaReference {
  catalogue: { id: number; code: string };
  number: string;
}

export interface NumistaMint {
  id: number;
  name: string;
}

export interface NumistaRulerEntry {
  id: number;
  name: string;
}

export interface NumistaIssueData {
  id: number;
  year: number;
  mint_letter?: string;
  mintage?: number;
  comment?: string;
}

export interface NumistaPriceData {
  currency: string;
  prices: { grade: string; price: number }[];
}

export interface NumistaRelatedType {
  id: number;
  title: string;
  category: string;
}

export interface CoinFormData {
  country: string;
  denomination: string;
  year: number | null;
  mintMark: string;
  material: string;
  fineness: string;
  weight: string;
  diameter: string;
  thickness: string;
  condition: string;
  isProof: boolean;
  isFirstDay: boolean;
  hasCase: boolean;
  hasCertificate: boolean;
  edgeType: string;
  mintage: string;
  storageLocation: string;
  notes: string;
  tags: string[];
  numistaTypeId: number | null;
  numistaTitle: string;
  numistaUrl: string;

  // Numista structured scalar fields
  shape: string;
  orientation: string;
  technique: string;
  series: string;
  commemoratedTopic: string;
  isDemonetized: boolean;
  demonetizationDate: string;
  comments: string;
  estimatedValue: number | null;
  estimatedCurrency: string;

  // Numista reference images
  numistaObverseThumbnail: string;
  numistaReverseThumbnail: string;

  // Numista complex Json data
  numistaObverse: NumistaFaceData | null;
  numistaReverse: NumistaFaceData | null;
  numistaReferences: NumistaReference[] | null;
  numistaMints: NumistaMint[] | null;
  numistaRuler: NumistaRulerEntry[] | null;
  numistaIssues: NumistaIssueData[] | null;
  numistaPrices: NumistaPriceData | null;
  numistaRelatedTypes: NumistaRelatedType[] | null;
}

export const EMPTY_COIN_FORM: CoinFormData = {
  country: "",
  denomination: "",
  year: null,
  mintMark: "",
  material: "",
  fineness: "",
  weight: "",
  diameter: "",
  thickness: "",
  condition: "",
  isProof: false,
  isFirstDay: false,
  hasCase: false,
  hasCertificate: false,
  edgeType: "",
  mintage: "",
  storageLocation: "",
  notes: "",
  tags: [],
  numistaTypeId: null,
  numistaTitle: "",
  numistaUrl: "",
  shape: "",
  orientation: "",
  technique: "",
  series: "",
  commemoratedTopic: "",
  isDemonetized: false,
  demonetizationDate: "",
  comments: "",
  estimatedValue: null,
  estimatedCurrency: "EUR",
  numistaObverseThumbnail: "",
  numistaReverseThumbnail: "",
  numistaObverse: null,
  numistaReverse: null,
  numistaReferences: null,
  numistaMints: null,
  numistaRuler: null,
  numistaIssues: null,
  numistaPrices: null,
  numistaRelatedTypes: null,
};

export interface CaptureState {
  step: CaptureStep;
  mode: CaptureMode | null;
  frontPhoto: string | null; // base64 data URL
  backPhoto: string | null;
  imageWidth: number;
  imageHeight: number;
  gridConfig: GridConfig | null;
  gridOverlay: GridOverlayState | null;
  singleCrop: CropRect | null;
  backImageWidth: number;
  backImageHeight: number;
  singleBackCrop: CropRect | null;
  coins: CapturedCoin[];
  currentCoinIndex: number;
  sessionDefaults: Partial<CoinFormData>;
}

export type CaptureAction =
  | { type: "START_CAPTURE" }
  | { type: "CAPTURE_COMPLETE"; photo: string; width: number; height: number }
  | { type: "CAPTURE_FAILED" }
  | { type: "SELECT_MODE"; mode: CaptureMode }
  | { type: "SET_SINGLE_CROP"; crop: CropRect }
  | { type: "CONFIRM_SINGLE_CROP" }
  | { type: "SINGLE_BACK_COMPLETE"; photo: string; width: number; height: number }
  | { type: "SET_SINGLE_BACK_CROP"; crop: CropRect }
  | { type: "CONFIRM_SINGLE_BACK_CROP" }
  | { type: "SKIP_SINGLE_BACK" }
  | { type: "SET_GRID_CONFIG"; config: GridConfig }
  | { type: "SET_GRID_OVERLAY"; overlay: GridOverlayState }
  | { type: "TOGGLE_GRID_EMPTY_SLOT"; slotIndex: number }
  | { type: "CONFIRM_GRID_FRONT" }
  | { type: "START_BACK_CAPTURE" }
  | { type: "BACK_CAPTURE_COMPLETE"; photo: string }
  | { type: "CONFIRM_GRID_BACK" }
  | { type: "SKIP_BACK_CAPTURE" }
  | { type: "RETAKE_BACK" }
  | { type: "NEXT_COIN" }
  | { type: "PREV_COIN" }
  | { type: "SAVE_COIN" }
  | { type: "COIN_SAVED" }
  | { type: "SET_SESSION_DEFAULTS"; defaults: Partial<CoinFormData> }
  | { type: "CONTINUE_WITH_SESSION" }
  | { type: "START_FRESH" }
  | { type: "RESET" };

export type CaptureMode = "single" | "grid" | "multi" | "numisbrief";

export type FlipMode = "book" | "turn";

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
  | "grid_back_align"
  | "multi_crop"
  | "multi_back_capture"
  | "multi_back_align"
  | "numisbrief_crop"
  | "numisbrief_back_capture"
  | "numisbrief_back_crop"
  | "coin_entry"
  | "saving";

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

export interface MultiCropItem {
  id: string;
  crop: CropRect;
}

export interface CapturedCoin {
  index: number;
  gridRow?: number;
  gridCol?: number;
  frontCrop?: CropRect;
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

  // Document images (base64)
  documentImagesBase64: string[];

  // Collection
  collectionId: string | null;

  // Numista collection sync
  addToNumistaCollection: boolean;
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
  documentImagesBase64: [],
  collectionId: null,
  addToNumistaCollection: false,
};

export interface CaptureState {
  step: CaptureStep;
  mode: CaptureMode | null;
  frontPhoto: string | null;
  backPhoto: string | null;
  imageWidth: number;
  imageHeight: number;
  gridConfig: GridConfig | null;
  gridOverlay: GridOverlayState | null;
  singleCrop: CropRect | null;
  backImageWidth: number;
  backImageHeight: number;
  singleBackCrop: CropRect | null;
  flipMode: FlipMode;
  backGridOverlay: GridOverlayState | null;
  coins: CapturedCoin[];
  currentCoinIndex: number;
  sessionDefaults: Partial<CoinFormData>;
  multiCrops: MultiCropItem[];
  multiBackCrops: MultiCropItem[];
  selectedMultiCropId: string | null;
  numisbriefCrop: CropRect | null;
  numisbriefBackCrop: CropRect | null;
  backOnly: boolean;
}

export type CaptureAction =
  | { type: "START_CAPTURE" }
  | { type: "CAPTURE_COMPLETE"; photo: string; width: number; height: number }
  | { type: "CAPTURE_FAILED" }
  | { type: "SELECT_MODE"; mode: CaptureMode }
  | { type: "MARK_AS_BACK" }
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
  | { type: "SET_FLIP_MODE"; flipMode: FlipMode }
  | { type: "START_BACK_CAPTURE" }
  | { type: "BACK_CAPTURE_COMPLETE"; photo: string; width: number; height: number }
  | { type: "SET_BACK_GRID_OVERLAY"; overlay: GridOverlayState }
  | { type: "CONFIRM_BACK_GRID_ALIGN" }
  | { type: "ROTATE_FRONT"; photo: string; width: number; height: number }
  | { type: "ROTATE_BACK"; photo: string; width: number; height: number }
  | { type: "SKIP_BACK_CAPTURE" }
  | { type: "RETAKE_BACK" }
  | { type: "RETAKE_SINGLE_BACK" }
  | { type: "ADD_MULTI_CROP"; crop: MultiCropItem }
  | { type: "UPDATE_MULTI_CROP"; id: string; crop: CropRect }
  | { type: "DELETE_MULTI_CROP"; id: string }
  | { type: "SELECT_MULTI_CROP"; id: string | null }
  | { type: "CONFIRM_MULTI_FRONT" }
  | { type: "MULTI_BACK_COMPLETE"; photo: string; width: number; height: number }
  | { type: "UPDATE_MULTI_BACK_CROP"; id: string; crop: CropRect }
  | { type: "SELECT_MULTI_BACK_CROP"; id: string | null }
  | { type: "CONFIRM_MULTI_BACK_ALIGN" }
  | { type: "SKIP_MULTI_BACK" }
  | { type: "RETAKE_MULTI_BACK" }
  | { type: "SET_NUMISBRIEF_CROP"; crop: CropRect }
  | { type: "CONFIRM_NUMISBRIEF_CROP" }
  | { type: "NUMISBRIEF_BACK_COMPLETE"; photo: string; width: number; height: number }
  | { type: "SET_NUMISBRIEF_BACK_CROP"; crop: CropRect }
  | { type: "CONFIRM_NUMISBRIEF_BACK_CROP" }
  | { type: "SKIP_NUMISBRIEF_BACK" }
  | { type: "RETAKE_NUMISBRIEF_BACK" }
  | { type: "NEXT_COIN" }
  | { type: "PREV_COIN" }
  | { type: "GO_TO_COIN"; index: number }
  | { type: "RETAKE_FRONT"; photo: string; width: number; height: number }
  | { type: "RETAKE_BACK_PHOTO"; photo: string; width: number; height: number }
  | { type: "SAVE_COIN" }
  | { type: "COIN_SAVED" }
  | { type: "SET_SESSION_DEFAULTS"; defaults: Partial<CoinFormData> }
  | { type: "CONTINUE_WITH_SESSION" }
  | { type: "START_FRESH" }
  | { type: "RESET" };

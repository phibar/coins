"use client";

import { useForm } from "react-hook-form";
import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CoinFormData, CropRect } from "@/types/capture";
import { EMPTY_COIN_FORM } from "@/types/capture";
import { NumistaSearchDialog } from "./numista-search-dialog";
import { NumistaImageSearchDialog } from "./numista-image-search-dialog";
import { ZoomablePreview } from "./zoomable-preview";
import { PhotoCanvas } from "./photo-canvas";
import { generateCropPreviewUrl, rotateImage90 } from "@/lib/crop-preview";
import { toast } from "sonner";

export interface CollectionWithImages {
  id: string;
  name: string;
  images: { id: string; thumbnailUrl: string; url: string }[];
}

const CONDITION_OPTIONS = [
  { value: "G", label: "G - Good" },
  { value: "VG", label: "VG - Very Good" },
  { value: "F", label: "F - Fine" },
  { value: "VF", label: "VF - Very Fine" },
  { value: "XF", label: "XF - Extra Fine" },
  { value: "AU", label: "AU - About Uncirculated" },
  { value: "UNC", label: "UNC - Uncirculated" },
  { value: "PROOF", label: "PROOF - Polierte Platte" },
];

interface CoinFormProps {
  defaults?: Partial<CoinFormData>;
  frontImageUrl?: string;
  backImageUrl?: string;
  onSaveAndContinue: (data: CoinFormData) => void;
  onSaveAndNew: (data: CoinFormData) => void;
  onSaveAndExit: (data: CoinFormData) => void;
  onSkip?: () => void;
  coinIndex?: number;
  totalCoins?: number;
  saving?: boolean;
  cameraConnected?: boolean;
  collections?: CollectionWithImages[];
  onCollectionsChange?: (collections: CollectionWithImages[]) => void;
  allCoinsHandled?: boolean;
}

export function CoinForm({
  defaults,
  frontImageUrl,
  backImageUrl,
  onSaveAndContinue,
  onSaveAndNew,
  onSaveAndExit,
  onSkip,
  coinIndex,
  totalCoins,
  saving,
  cameraConnected = false,
  collections = [],
  onCollectionsChange,
  allCoinsHandled,
}: CoinFormProps) {
  const initialValues = { ...EMPTY_COIN_FORM, ...defaults };
  const { register, handleSubmit, setValue, watch, getValues } =
    useForm<CoinFormData>({
      defaultValues: initialValues,
    });

  const condition = watch("condition");
  const isProof = watch("isProof");
  const isFirstDay = watch("isFirstDay");
  const collectionId = watch("collectionId");
  const hasCase = watch("hasCase");
  const numistaTitle = watch("numistaTitle");
  const numistaTypeId = watch("numistaTypeId");
  const addToNumistaCollection = watch("addToNumistaCollection");

  const [newCollectionName, setNewCollectionName] = useState("");
  const [creatingCollection, setCreatingCollection] = useState(false);

  const handleCreateCollection = useCallback(async () => {
    const name = newCollectionName.trim();
    if (!name) return;
    setCreatingCollection(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Fehler beim Anlegen");
        return;
      }
      const created = await res.json();
      toast.success("Sammlung angelegt");
      setNewCollectionName("");
      setValue("collectionId", created.id);
      onCollectionsChange?.([...collections, { id: created.id, name: created.name, images: [] }]);
    } catch {
      toast.error("Fehler beim Anlegen");
    } finally {
      setCreatingCollection(false);
    }
  }, [newCollectionName, collections, onCollectionsChange, setValue]);

  const collectionImageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCollectionImage, setUploadingCollectionImage] = useState(false);
  const [colImgRawUrl, setColImgRawUrl] = useState<string | null>(null);
  const [colImgDimensions, setColImgDimensions] = useState<{ width: number; height: number } | null>(null);
  const [colImgCrop, setColImgCrop] = useState<CropRect | null>(null);
  const [colImgCapturing, setColImgCapturing] = useState(false);

  const loadCollectionImage = useCallback((url: string) => {
    const img = new window.Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setColImgDimensions({ width: w, height: h });
      setColImgCrop(null);
      setColImgRawUrl(url);
    };
    img.src = url;
  }, []);

  const handleCollectionImageFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      loadCollectionImage(URL.createObjectURL(file));
    },
    [loadCollectionImage]
  );

  const handleCollectionImageCapture = useCallback(async () => {
    setColImgCapturing(true);
    try {
      const response = await fetch("/api/camera/capture", { method: "POST" });
      if (!response.ok) throw new Error("Capture failed");
      const blob = await response.blob();
      let url = URL.createObjectURL(blob);

      const savedRotation = parseInt(localStorage.getItem("camera-rotation") || "0");
      if (savedRotation > 0) {
        const img = new window.Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Image load failed"));
          img.src = url;
        });
        let w = img.naturalWidth, h = img.naturalHeight;
        for (let i = 0; i < savedRotation / 90; i++) {
          const result = await rotateImage90(url, w, h);
          URL.revokeObjectURL(url);
          url = result.url; w = result.width; h = result.height;
        }
      }

      loadCollectionImage(url);
    } catch {
      toast.error("Aufnahme fehlgeschlagen");
    } finally {
      setColImgCapturing(false);
    }
  }, [loadCollectionImage]);

  const handleCollectionImageCropConfirm = useCallback(async () => {
    if (!colImgRawUrl || !colImgCrop || !collectionId) return;
    setUploadingCollectionImage(true);
    try {
      const previewUrl = await generateCropPreviewUrl(colImgRawUrl, colImgCrop);
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );

      const res = await fetch(`/api/collections/${collectionId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagesBase64: [base64] }),
      });
      if (!res.ok) throw new Error("Upload failed");
      const created = await res.json();

      const updated = collections.map((c) =>
        c.id === collectionId
          ? { ...c, images: [...c.images, ...created] }
          : c
      );
      onCollectionsChange?.(updated);
      toast.success("Bild hinzugefügt");

      setColImgRawUrl(null);
      setColImgDimensions(null);
      setColImgCrop(null);
    } catch {
      toast.error("Fehler beim Hochladen");
    } finally {
      setUploadingCollectionImage(false);
    }
  }, [colImgRawUrl, colImgCrop, collectionId, collections, onCollectionsChange]);

  const handleCollectionImageCropCancel = useCallback(() => {
    setColImgRawUrl(null);
    setColImgDimensions(null);
    setColImgCrop(null);
  }, []);

  const handleDeleteCollectionImage = useCallback(async (imageId: string) => {
    if (!collectionId) return;
    try {
      const res = await fetch(`/api/collections/${collectionId}/images/${imageId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");

      const updated = collections.map((c) =>
        c.id === collectionId
          ? { ...c, images: c.images.filter((img) => img.id !== imageId) }
          : c
      );
      onCollectionsChange?.(updated);
      toast.success("Bild gelöscht");
    } catch {
      toast.error("Fehler beim Löschen");
    }
  }, [collectionId, collections, onCollectionsChange]);

  const docInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<{ preview: string; base64: string }[]>([]);
  const [docRawUrl, setDocRawUrl] = useState<string | null>(null);
  const [docDimensions, setDocDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [docCrop, setDocCrop] = useState<CropRect | null>(null);
  const [docCapturing, setDocCapturing] = useState(false);

  const loadDocImage = useCallback((url: string) => {
    const img = new window.Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      setDocDimensions({ width: w, height: h });
      setDocCrop(null);
      setDocRawUrl(url);
    };
    img.src = url;
  }, []);

  const handleDocCapture = useCallback(async () => {
    setDocCapturing(true);
    try {
      const response = await fetch("/api/camera/capture", { method: "POST" });
      if (!response.ok) throw new Error("Capture failed");
      const blob = await response.blob();
      let url = URL.createObjectURL(blob);

      const savedRotation = parseInt(localStorage.getItem("camera-rotation") || "0");
      if (savedRotation > 0) {
        const img = new window.Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Image load failed"));
          img.src = url;
        });
        let w = img.naturalWidth, h = img.naturalHeight;
        for (let i = 0; i < savedRotation / 90; i++) {
          const result = await rotateImage90(url, w, h);
          URL.revokeObjectURL(url);
          url = result.url; w = result.width; h = result.height;
        }
      }

      loadDocImage(url);
    } catch {
      toast.error("Dokument-Aufnahme fehlgeschlagen");
    } finally {
      setDocCapturing(false);
    }
  }, [loadDocImage]);

  const handleDocFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      loadDocImage(URL.createObjectURL(file));
    },
    [loadDocImage]
  );

  const handleDocCropConfirm = useCallback(async () => {
    if (!docRawUrl || !docCrop) return;
    try {
      const previewUrl = await generateCropPreviewUrl(docRawUrl, docCrop);
      // Extract base64 from the preview blob
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );
      const newDocs = [...documents, { preview: previewUrl, base64 }];
      setDocuments(newDocs);
      setValue("documentImagesBase64", newDocs.map((d) => d.base64));
      setValue("hasCertificate", true);
      // Clear raw state
      setDocRawUrl(null);
      setDocDimensions(null);
      setDocCrop(null);
    } catch {
      toast.error("Dokument-Crop fehlgeschlagen");
    }
  }, [docRawUrl, docCrop, documents, setValue]);

  const handleDocRemove = useCallback((index: number) => {
    setDocuments((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      const next = prev.filter((_, i) => i !== index);
      setValue("documentImagesBase64", next.map((d) => d.base64));
      if (next.length === 0) setValue("hasCertificate", false);
      return next;
    });
  }, [setValue]);

  const handleDocCropCancel = useCallback(() => {
    setDocRawUrl(null);
    setDocDimensions(null);
    setDocCrop(null);
  }, []);

  const handleNumistaSelect = (data: Partial<CoinFormData>) => {
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null && value !== "") {
        setValue(key as keyof CoinFormData, value as never);
      }
    }
    if (data.numistaTypeId) {
      setValue("addToNumistaCollection", true);
    }
  };

  // Save mode: which save button was pressed
  const saveModeRef = useRef<"continue" | "new" | "exit">("continue");

  const handleFormSubmit = useCallback(
    (data: CoinFormData) => {
      if (saveModeRef.current === "new") {
        onSaveAndNew(data);
      } else if (saveModeRef.current === "exit") {
        onSaveAndExit(data);
      } else {
        onSaveAndContinue(data);
      }
    },
    [onSaveAndContinue, onSaveAndNew, onSaveAndExit]
  );

  // Cmd+Enter to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        saveModeRef.current = "continue";
        handleSubmit(handleFormSubmit)();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSubmit, handleFormSubmit]);

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Save buttons at top right */}
      <div className="flex items-center justify-between">
        <div>
          {totalCoins && totalCoins > 1 && (
            <span className="text-sm text-muted-foreground">
              Münze {(coinIndex ?? 0) + 1} von {totalCoins}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={saving}
            onClick={() => { saveModeRef.current = "continue"; }}
          >
            {saving ? "..." : "Speichern & Weiter"}
          </Button>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={saving || (totalCoins != null && totalCoins > 1 && !allCoinsHandled)}
            onClick={() => { saveModeRef.current = "new"; }}
          >
            Speichern &amp; Neu
          </Button>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={saving || (totalCoins != null && totalCoins > 1 && !allCoinsHandled)}
            onClick={() => { saveModeRef.current = "exit"; }}
          >
            Speichern &amp; Beenden
          </Button>
          {onSkip && (
            <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
              Überspringen
            </Button>
          )}
        </div>
      </div>

      {/* Image previews */}
      {(frontImageUrl || backImageUrl) && (
        <div className="flex gap-4">
          {frontImageUrl && (
            <ZoomablePreview
              src={frontImageUrl}
              alt="Vorderseite"
              label="Vorderseite"
            />
          )}
          {backImageUrl && (
            <ZoomablePreview
              src={backImageUrl}
              alt="Rückseite"
              label="Rückseite"
            />
          )}
        </div>
      )}

      {/* Basic fields */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">
          Grunddaten
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="country">Land</Label>
            <Input
              id="country"
              {...register("country")}
              placeholder="z.B. Deutschland"
            />
          </div>
          <div>
            <Label htmlFor="denomination">Nominal</Label>
            <Input
              id="denomination"
              {...register("denomination")}
              placeholder="z.B. 1 DM"
            />
          </div>
          <div>
            <Label htmlFor="year">Prägejahr</Label>
            <Input
              id="year"
              type="number"
              {...register("year", { valueAsNumber: true })}
              placeholder="z.B. 1970"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Input
              id="description"
              {...register("description")}
              placeholder="z.B. 50 Pfennig Bogen, Ersttagsbrief..."
            />
          </div>
          <div>
            <Label htmlFor="count">Anzahl</Label>
            <Input
              id="count"
              type="number"
              {...register("count", { valueAsNumber: true })}
              placeholder="z.B. 20"
            />
          </div>
        </div>
      </div>

      {/* Numista search */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <NumistaSearchDialog
            currentFormData={getValues()}
            onSelect={handleNumistaSelect}
            autoOpen
          >
            <Button type="button" variant="outline" size="sm">
              Numista-Suche
            </Button>
          </NumistaSearchDialog>
          {frontImageUrl && (
            <NumistaImageSearchDialog
              frontImageUrl={frontImageUrl}
              backImageUrl={backImageUrl}
              onSelect={handleNumistaSelect}
            >
              <Button type="button" variant="outline" size="sm">
                Bilderkennung
              </Button>
            </NumistaImageSearchDialog>
          )}
          {numistaTitle && (
            <span className="text-sm text-muted-foreground truncate">
              {numistaTitle}
            </span>
          )}
        </div>
        {numistaTypeId && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="addToNumistaCollection"
              checked={addToNumistaCollection}
              onCheckedChange={(checked) =>
                setValue("addToNumistaCollection", checked === true)
              }
            />
            <Label htmlFor="addToNumistaCollection" className="text-sm">
              Auch zu Numista-Sammlung hinzufügen
            </Label>
          </div>
        )}
      </div>

      {/* Coin details */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">
          Münzdetails
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="mintMark">Prägeanstalt</Label>
            <Input
              id="mintMark"
              {...register("mintMark")}
              placeholder="z.B. D, F, G, J"
            />
          </div>
          <div>
            <Label htmlFor="material">Material</Label>
            <Input
              id="material"
              {...register("material")}
              placeholder="z.B. Silber 625"
            />
          </div>
          <div>
            <Label htmlFor="fineness">Feingehalt</Label>
            <Input
              id="fineness"
              {...register("fineness")}
              placeholder="z.B. 0.625"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="weight">Gewicht (g)</Label>
            <Input
              id="weight"
              {...register("weight")}
              placeholder="z.B. 15.5"
            />
          </div>
          <div>
            <Label htmlFor="diameter">Durchmesser (mm)</Label>
            <Input
              id="diameter"
              {...register("diameter")}
              placeholder="z.B. 32.5"
            />
          </div>
          <div>
            <Label htmlFor="thickness">Dicke (mm)</Label>
            <Input
              id="thickness"
              {...register("thickness")}
              placeholder="z.B. 2.1"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="edgeType">Randart</Label>
            <Input
              id="edgeType"
              {...register("edgeType")}
              placeholder="z.B. geriffelt"
            />
          </div>
          <div>
            <Label htmlFor="mintage">Auflage</Label>
            <Input
              id="mintage"
              {...register("mintage")}
              placeholder="z.B. 5000000"
            />
          </div>
          <div>
            <Label htmlFor="estimatedValue">Schätzwert (EUR)</Label>
            <Input
              id="estimatedValue"
              type="number"
              step="0.01"
              {...register("estimatedValue", { valueAsNumber: true })}
              placeholder="z.B. 25.00"
            />
          </div>
        </div>
      </div>

      {/* Condition */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">
          Zustand
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Erhaltung</Label>
            <Select
              value={condition}
              onValueChange={(val) => {
                setValue("condition", val);
                setValue("isProof", val === "PROOF");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Erhaltung wählen" />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-6">
          <div className="flex items-center gap-2">
            <Checkbox
              id="isProof"
              checked={isProof}
              onCheckedChange={(checked) => {
                const val = checked === true;
                setValue("isProof", val);
                if (val) {
                  setValue("condition", "PROOF");
                } else if (condition === "PROOF") {
                  setValue("condition", "");
                }
              }}
            />
            <Label htmlFor="isProof">Polierte Platte</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="isFirstDay"
              checked={isFirstDay}
              onCheckedChange={(checked) =>
                setValue("isFirstDay", checked === true)
              }
            />
            <Label htmlFor="isFirstDay">Ersttag</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="hasCase"
              checked={hasCase}
              onCheckedChange={(checked) =>
                setValue("hasCase", checked === true)
              }
            />
            <Label htmlFor="hasCase">Etui</Label>
          </div>
        </div>

        {/* Document capture */}
        <input
          ref={docInputRef}
          type="file"
          accept="image/*"
          onChange={handleDocFile}
          className="hidden"
        />

        {/* Document thumbnails */}
        {documents.length > 0 && !docRawUrl && (
          <div className="space-y-2">
            <Label>Dokumente ({documents.length})</Label>
            <div className="flex flex-wrap gap-3">
              {documents.map((doc, i) => (
                <div key={i} className="relative group">
                  <img
                    src={doc.preview}
                    alt={`Dokument ${i + 1}`}
                    className="h-24 rounded border object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => handleDocRemove(i)}
                    className="absolute -top-2 -right-2 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* State: cropping raw document photo */}
        {docRawUrl && docDimensions && (
          <div className="space-y-3 rounded-lg border border-dashed p-3">
            <Label>{docCrop ? "Dokument zuschneiden" : "Zeichne einen Ausschnitt"}</Label>
            <PhotoCanvas
              imageSrc={docRawUrl}
              imageWidth={docDimensions.width}
              imageHeight={docDimensions.height}
              crop={docCrop}
              onCropChange={setDocCrop}
              maxDisplayHeight={400}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleDocCropConfirm}
                disabled={!docCrop}
              >
                Bestätigen
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDocRawUrl(null);
                  setDocDimensions(null);
                  setDocCrop(null);
                  if (cameraConnected) {
                    handleDocCapture();
                  } else {
                    docInputRef.current?.click();
                  }
                }}
              >
                Anderes Foto
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDocCropCancel}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        )}

        {/* Add document button (always visible when not cropping) */}
        {!docRawUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (cameraConnected) {
                handleDocCapture();
              } else {
                docInputRef.current?.click();
              }
            }}
            disabled={docCapturing}
          >
            {docCapturing ? "Aufnahme..." : "Dokument hinzufügen"}
          </Button>
        )}
      </div>

      {/* Organization */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">
          Organisation
        </h3>
        <div>
          <Label>Sammlung</Label>
          <div className="flex items-center gap-1">
            <Select
              value={collectionId || "none"}
              onValueChange={(val) =>
                setValue("collectionId", val === "none" ? null : val)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Keine Sammlung" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Sammlung</SelectItem>
                {collections.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-1.5 flex items-center gap-1">
            <Input
              placeholder="Neue Sammlung..."
              value={newCollectionName}
              onChange={(e) => setNewCollectionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreateCollection();
                }
              }}
              className="h-8 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 shrink-0"
              disabled={!newCollectionName.trim() || creatingCollection}
              onClick={handleCreateCollection}
            >
              +
            </Button>
          </div>
          {collectionId && (() => {
            const selectedCollection = collections.find((c) => c.id === collectionId);
            if (!selectedCollection) return null;
            return (
              <div className="mt-2">
                <input
                  ref={collectionImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCollectionImageFile}
                />

                {/* Crop canvas for collection image */}
                {colImgRawUrl && colImgDimensions ? (
                  <div className="space-y-3 rounded-lg border border-dashed p-3">
                    <Label>{colImgCrop ? "Sammlungs-Bild zuschneiden" : "Zeichne einen Ausschnitt"}</Label>
                    <PhotoCanvas
                      imageSrc={colImgRawUrl}
                      imageWidth={colImgDimensions.width}
                      imageHeight={colImgDimensions.height}
                      crop={colImgCrop}
                      onCropChange={setColImgCrop}
                      maxDisplayHeight={400}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCollectionImageCropConfirm}
                        disabled={uploadingCollectionImage || !colImgCrop}
                      >
                        {uploadingCollectionImage ? "Hochladen..." : "Bestätigen"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setColImgRawUrl(null);
                          setColImgDimensions(null);
                          setColImgCrop(null);
                          if (cameraConnected) {
                            handleCollectionImageCapture();
                          } else {
                            collectionImageInputRef.current?.click();
                          }
                        }}
                      >
                        Anderes Foto
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCollectionImageCropCancel}
                      >
                        Abbrechen
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Sammlungs-Bilder</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        disabled={colImgCapturing}
                        onClick={() => {
                          if (cameraConnected) {
                            handleCollectionImageCapture();
                          } else {
                            collectionImageInputRef.current?.click();
                          }
                        }}
                      >
                        {colImgCapturing ? "Aufnahme..." : "+ Bild"}
                      </Button>
                    </div>
                    {selectedCollection.images.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {selectedCollection.images.map((img) => (
                          <div key={img.id} className="group relative">
                            <img
                              src={img.thumbnailUrl}
                              alt="Sammlungsbild"
                              className="h-16 w-16 rounded border object-cover"
                            />
                            <button
                              type="button"
                              className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground group-hover:flex"
                              onClick={() => handleDeleteCollectionImage(img.id)}
                            >
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}
        </div>
        <div>
          <Label htmlFor="storageLocation">Lagerort</Label>
          <Input
            id="storageLocation"
            {...register("storageLocation")}
            placeholder="z.B. Ordner 3, Seite 7"
          />
        </div>
        <div>
          <Label htmlFor="notes">Notizen</Label>
          <Textarea
            id="notes"
            {...register("notes")}
            placeholder="Anmerkungen zur Münze..."
            rows={3}
          />
        </div>
      </div>

    </form>
  );
}

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhotoCanvas } from "@/app/capture/_components/photo-canvas";
import { generateCropPreviewUrl, rotateImage90 } from "@/lib/crop-preview";
import { NumistaSearchDialog } from "@/app/capture/_components/numista-search-dialog";
import { NumistaImageSearchDialog } from "@/app/capture/_components/numista-image-search-dialog";
import type { CropRect, CoinFormData } from "@/types/capture";
import { toast } from "sonner";

const CONDITION_OPTIONS = ["G", "VG", "F", "VF", "XF", "AU", "UNC"] as const;

interface ScannedPage {
  base64: string;
  previewUrl: string;
}

export default function BanknoteErfassenPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Camera status
  const [cameraConnected, setCameraConnected] = useState(false);

  // Images
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [rawImageDims, setRawImageDims] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedScanFiles = useRef<Set<string>>(new Set());

  // Form
  const [denomination, setDenomination] = useState("");
  const [country, setCountry] = useState("");
  const [year, setYear] = useState("");
  const [condition, setCondition] = useState("");
  const [series, setSeries] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [estimatedCurrency, setEstimatedCurrency] = useState("EUR");

  // Numista metadata (filled by search dialogs)
  const [numistaData, setNumistaData] = useState<Partial<CoinFormData>>({});

  // Check camera status
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

  // Poll for pending scans from watch folder
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/scanner/pending");
        const data = await res.json();
        if (data.count > 0) {
          const newFiles = (data.files as string[]).filter(
            (f) => !loadedScanFiles.current.has(f)
          );
          if (newFiles.length === 0) return;

          const newPages: ScannedPage[] = [];
          for (const filePath of newFiles) {
            loadedScanFiles.current.add(filePath);
            const imgRes = await fetch(
              `/api/scanner/file?path=${encodeURIComponent(filePath)}`
            );
            if (!imgRes.ok) continue;
            const blob = await imgRes.blob();
            const previewUrl = URL.createObjectURL(blob);
            const arrayBuffer = await blob.arrayBuffer();
            const base64 = btoa(
              new Uint8Array(arrayBuffer).reduce(
                (data, byte) => data + String.fromCharCode(byte),
                ""
              )
            );
            newPages.push({ base64, previewUrl });
          }
          if (newPages.length > 0) {
            setPages((prev) => [...prev, ...newPages]);
            toast.success(`${newPages.length} Scan(s) geladen`);
          }
        }
      } catch {
        // Scanner service not available
      }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  // Camera capture
  const handleCapture = useCallback(async () => {
    try {
      const response = await fetch("/api/camera/capture", { method: "POST" });
      if (!response.ok) throw new Error("Capture failed");
      const blob = await response.blob();
      let url = URL.createObjectURL(blob);

      const savedRotation = parseInt(
        localStorage.getItem("camera-rotation") || "0"
      );
      if (savedRotation > 0) {
        const img = new window.Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Image load failed"));
          img.src = url;
        });
        let w = img.naturalWidth,
          h = img.naturalHeight;
        for (let i = 0; i < savedRotation / 90; i++) {
          const result = await rotateImage90(url, w, h);
          URL.revokeObjectURL(url);
          url = result.url;
          w = result.width;
          h = result.height;
        }
      }

      loadImage(url);
    } catch {
      toast.error("Aufnahme fehlgeschlagen");
    }
  }, []);

  // Load image for cropping
  const loadImage = useCallback((url: string) => {
    const img = new window.Image();
    img.onload = () => {
      setRawImageDims({ width: img.naturalWidth, height: img.naturalHeight });
      setCrop(null);
      setRawImageUrl(url);
    };
    img.src = url;
  }, []);

  // File upload
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      loadImage(URL.createObjectURL(file));
    },
    [loadImage]
  );

  // Confirm crop -> add to pages
  const handleCropConfirm = useCallback(async () => {
    if (!rawImageUrl || !crop) return;
    try {
      const previewUrl = await generateCropPreviewUrl(rawImageUrl, crop);
      const response = await fetch(previewUrl);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );
      setPages((prev) => [...prev, { base64, previewUrl }]);
      setRawImageUrl(null);
      setRawImageDims(null);
      setCrop(null);
    } catch {
      toast.error("Zuschneiden fehlgeschlagen");
    }
  }, [rawImageUrl, crop]);

  const handleRemovePage = useCallback((index: number) => {
    setPages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // Handle Numista data selection
  const handleNumistaSelect = useCallback((data: Partial<CoinFormData>) => {
    setNumistaData(data);
    if (data.denomination) setDenomination(data.denomination);
    if (data.country) setCountry(data.country);
    if (data.year) setYear(String(data.year));
    if (data.condition) setCondition(data.condition);
    if (data.series) setSeries(data.series || "");
    if (data.numistaTitle) setDescription(data.numistaTitle || "");
    if (data.estimatedValue != null)
      setEstimatedValue(String(data.estimatedValue));
    if (data.estimatedCurrency) setEstimatedCurrency(data.estimatedCurrency);
    toast.success("Numista-Daten übernommen");
  }, []);

  // Build form payload
  const buildPayload = useCallback(
    () => ({
      formData: {
        itemType: "banknote",
        denomination: denomination || "",
        description: description || denomination || "Banknote",
        country: country || "",
        year: year ? parseInt(year) : null,
        condition: condition || "",
        series: series || "",
        notes,
        estimatedValue: estimatedValue ? parseFloat(estimatedValue) : null,
        estimatedCurrency,
        mintMark: "",
        material: "",
        fineness: "",
        weight: "",
        diameter: "",
        thickness: "",
        isProof: false,
        isFirstDay: false,
        hasCase: false,
        hasCertificate: false,
        edgeType: "",
        mintage: numistaData.mintage || "",
        storageLocation: "",
        tags: numistaData.tags || [],
        numistaTypeId: numistaData.numistaTypeId || null,
        numistaTitle: numistaData.numistaTitle || "",
        numistaUrl: numistaData.numistaUrl || "",
        shape: numistaData.shape || "",
        orientation: numistaData.orientation || "",
        technique: numistaData.technique || "",
        commemoratedTopic: numistaData.commemoratedTopic || "",
        isDemonetized: numistaData.isDemonetized || false,
        demonetizationDate: numistaData.demonetizationDate || "",
        comments: numistaData.comments || "",
        numistaObverseThumbnail: numistaData.numistaObverseThumbnail || "",
        numistaReverseThumbnail: numistaData.numistaReverseThumbnail || "",
        numistaObverse: numistaData.numistaObverse || null,
        numistaReverse: numistaData.numistaReverse || null,
        numistaReferences: numistaData.numistaReferences || null,
        numistaMints: numistaData.numistaMints || null,
        numistaRuler: numistaData.numistaRuler || null,
        numistaIssues: numistaData.numistaIssues || null,
        numistaPrices: numistaData.numistaPrices || null,
        numistaRelatedTypes: numistaData.numistaRelatedTypes || null,
        documentImagesBase64: pages.map((p) => p.base64),
        collectionId: null,
        addToNumistaCollection: false,
        count: null,
      },
      frontImageBase64: null,
      backImageBase64: null,
      documentImagesBase64: pages.map((p) => p.base64),
      frontCrop: null,
      backCrop: null,
    }),
    [
      pages,
      denomination,
      description,
      country,
      year,
      condition,
      series,
      notes,
      estimatedValue,
      estimatedCurrency,
      numistaData,
    ]
  );

  // Reset form for next entry
  const resetForm = useCallback(() => {
    pages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPages([]);
    setRawImageUrl(null);
    setRawImageDims(null);
    setCrop(null);
    setDenomination("");
    setCountry("");
    setYear("");
    setCondition("");
    setSeries("");
    setDescription("");
    setNotes("");
    setEstimatedValue("");
    setEstimatedCurrency("EUR");
    setNumistaData({});
    loadedScanFiles.current = new Set();
  }, [pages]);

  // Save and navigate to list
  const handleSave = useCallback(async () => {
    if (pages.length === 0) {
      toast.error("Mindestens ein Bild hinzufügen");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/coins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) throw new Error("Save failed");
      await fetch("/api/scanner/clear", { method: "POST" }).catch(() => {});
      toast.success("Banknote gespeichert!");
      router.push("/banknoten");
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }, [pages, buildPayload, router]);

  // Save and start a new Banknote
  const handleSaveAndContinue = useCallback(async () => {
    if (pages.length === 0) {
      toast.error("Mindestens ein Bild hinzufügen");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/coins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) throw new Error("Save failed");
      await fetch("/api/scanner/clear", { method: "POST" }).catch(() => {});
      toast.success("Banknote gespeichert!");
      resetForm();
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }, [pages, buildPayload, resetForm]);

  // First scanned image as front, second as back (for Numista image search)
  const frontPreviewUrl = pages[0]?.previewUrl;
  const backPreviewUrl = pages[1]?.previewUrl;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Banknote erfassen</h1>

      {/* Image capture area */}
      {rawImageUrl && rawImageDims ? (
        <div className="mb-6 space-y-3 rounded-lg border p-4">
          <Label>
            {crop ? "Ausschnitt bestätigen" : "Zeichne einen Ausschnitt"}
          </Label>
          <PhotoCanvas
            imageSrc={rawImageUrl}
            imageWidth={rawImageDims.width}
            imageHeight={rawImageDims.height}
            crop={crop}
            onCropChange={setCrop}
            maxDisplayHeight={500}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCropConfirm} disabled={!crop}>
              Bestätigen
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRawImageUrl(null);
                setRawImageDims(null);
                setCrop(null);
              }}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      ) : (
        <div className="mb-6 space-y-4">
          {/* Page thumbnails */}
          {pages.length > 0 && (
            <div className="space-y-2">
              <Label>Scans ({pages.length})</Label>
              <div className="flex flex-wrap gap-3">
                {pages.map((page, i) => (
                  <div key={i} className="group relative">
                    <img
                      src={page.previewUrl}
                      alt={`Scan ${i + 1}`}
                      className="h-32 rounded border object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePage(i)}
                      className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs group-hover:flex"
                    >
                      ×
                    </button>
                    <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[10px] text-white">
                      {i === 0 ? "Vorderseite" : i === 1 ? "Rückseite" : `Scan ${i + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Capture buttons */}
          <div className="flex flex-wrap gap-3">
            {cameraConnected && (
              <Button variant="outline" onClick={handleCapture}>
                Foto aufnehmen
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Datei hochladen
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          <p className="text-sm text-muted-foreground">
            Scanne mit Epson Scan 2 nach ~/Scans — Bilder werden automatisch
            geladen. Erstes Bild = Vorderseite, zweites = Rückseite.
          </p>
        </div>
      )}

      {/* Numista search buttons */}
      {pages.length > 0 && !rawImageUrl && (
        <div className="mb-6 flex flex-wrap gap-3">
          <NumistaSearchDialog
            onSelect={handleNumistaSelect}
            category="banknote"
            frontImageUrl={frontPreviewUrl}
            backImageUrl={backPreviewUrl}
          >
            <Button variant="outline">Numista-Suche</Button>
          </NumistaSearchDialog>
          {frontPreviewUrl && (
            <NumistaImageSearchDialog
              frontImageUrl={frontPreviewUrl}
              backImageUrl={backPreviewUrl}
              category="banknote"
              onSelect={handleNumistaSelect}
            >
              <Button variant="outline">Bilderkennung</Button>
            </NumistaImageSearchDialog>
          )}
          {numistaData.numistaTypeId && (
            <span className="flex items-center text-xs text-muted-foreground">
              Numista #{numistaData.numistaTypeId} verknüpft
            </span>
          )}
        </div>
      )}

      {/* Form fields */}
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="denomination">Nominal</Label>
            <Input
              id="denomination"
              value={denomination}
              onChange={(e) => setDenomination(e.target.value)}
              placeholder="z.B. 5000 Dinara"
            />
          </div>
          <div>
            <Label htmlFor="country">Land</Label>
            <Input
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="z.B. Jugoslawien"
            />
          </div>
          <div>
            <Label htmlFor="year">Jahr</Label>
            <Input
              id="year"
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="z.B. 1993"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="condition">Erhaltung</Label>
            <select
              id="condition"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">—</option>
              {CONDITION_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="series">Serie</Label>
            <Input
              id="series"
              value={series}
              onChange={(e) => setSeries(e.target.value)}
              placeholder="z.B. 1993 Reform"
            />
          </div>
          <div>
            <Label htmlFor="estimatedValue">
              Schätzwert ({estimatedCurrency})
            </Label>
            <Input
              id="estimatedValue"
              type="number"
              step="0.01"
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
              placeholder="z.B. 5.00"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="description">Beschreibung</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="z.B. 5000 Dinara Jugoslawien 1993"
          />
        </div>
        <div>
          <Label htmlFor="notes">Notizen</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anmerkungen..."
            rows={3}
          />
        </div>
      </div>

      {/* Save */}
      <div className="mt-6 flex gap-3">
        <Button variant="ghost" onClick={() => router.push("/banknoten")}>
          Abbrechen
        </Button>
        <Button onClick={handleSave} disabled={saving || pages.length === 0}>
          {saving ? "Speichert..." : "Speichern"}
        </Button>
        <Button
          variant="outline"
          onClick={handleSaveAndContinue}
          disabled={saving || pages.length === 0}
        >
          {saving ? "Speichert..." : "Speichern & Weiter"}
        </Button>
      </div>
    </div>
  );
}

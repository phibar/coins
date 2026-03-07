"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhotoCanvas } from "@/app/capture/_components/photo-canvas";
import { generateCropPreviewUrl, rotateImage90 } from "@/lib/crop-preview";
import type { CropRect } from "@/types/capture";
import { toast } from "sonner";

interface ScannedPage {
  base64: string;
  previewUrl: string;
}

export default function ErsttagsbriefErfassenPage() {
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
  const [description, setDescription] = useState("");
  const [country, setCountry] = useState("");
  const [year, setYear] = useState("");
  const [notes, setNotes] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");

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
          // Load new files that haven't been loaded yet
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

  // Save
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
        body: JSON.stringify({
          formData: {
            itemType: "ersttagsbrief",
            description: description || "Ersttagsbrief",
            country: country || "",
            denomination: "",
            year: year ? parseInt(year) : null,
            notes,
            estimatedValue: estimatedValue ? parseFloat(estimatedValue) : null,
            estimatedCurrency: "EUR",
            mintMark: "",
            material: "",
            fineness: "",
            weight: "",
            diameter: "",
            thickness: "",
            condition: "",
            isProof: false,
            isFirstDay: true,
            hasCase: false,
            hasCertificate: false,
            edgeType: "",
            mintage: "",
            storageLocation: "",
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
      });

      if (!res.ok) throw new Error("Save failed");

      // Clear processed scans from watch folder
      await fetch("/api/scanner/clear", { method: "POST" }).catch(() => {});

      toast.success("Ersttagsbrief gespeichert!");
      router.push("/ersttagsbriefe");
    } catch {
      toast.error("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }, [pages, description, country, year, notes, estimatedValue, router]);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Ersttagsbrief erfassen</h1>

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
              <Label>Seiten ({pages.length})</Label>
              <div className="flex flex-wrap gap-3">
                {pages.map((page, i) => (
                  <div key={i} className="group relative">
                    <img
                      src={page.previewUrl}
                      alt={`Seite ${i + 1}`}
                      className="h-32 rounded border object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePage(i)}
                      className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs group-hover:flex"
                    >
                      ×
                    </button>
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
            geladen.
          </p>
        </div>
      )}

      {/* Form fields */}
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="z.B. Ersttagsbrief Deutsche Bundespost 1970"
            />
          </div>
          <div>
            <Label htmlFor="year">Jahr</Label>
            <Input
              id="year"
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="z.B. 1970"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="country">Land</Label>
            <Input
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="z.B. Deutschland"
            />
          </div>
          <div>
            <Label htmlFor="estimatedValue">Schätzwert (EUR)</Label>
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
        <Button onClick={handleSave} disabled={saving || pages.length === 0}>
          {saving ? "Speichert..." : "Speichern"}
        </Button>
        <Button variant="ghost" onClick={() => router.push("/ersttagsbriefe")}>
          Abbrechen
        </Button>
      </div>
    </div>
  );
}

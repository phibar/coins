"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { CropRect, MultiCropItem } from "@/types/capture";

interface MultiCropCanvasProps {
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  crops: MultiCropItem[];
  selectedCropId: string | null;
  onAddCrop: (crop: MultiCropItem) => void;
  onUpdateCrop: (id: string, crop: CropRect) => void;
  onDeleteCrop: (id: string) => void;
  onSelectCrop: (id: string | null) => void;
  maxDisplayHeight?: number;
  readOnly?: boolean;
  previewImageSrc?: string;
  previewCrops?: MultiCropItem[];
}

type DragMode = "draw" | "move" | "nw" | "ne" | "sw" | "se" | null;

const HANDLE_SIZE = 10;
const HANDLE_THRESHOLD = 15;
const MIN_CROP_SIZE = 50;

export function MultiCropCanvas({
  imageSrc,
  imageWidth,
  imageHeight,
  crops,
  selectedCropId,
  onAddCrop,
  onUpdateCrop,
  onSelectCrop,
  maxDisplayHeight = 600,
  readOnly = false,
  previewImageSrc,
  previewCrops,
}: MultiCropCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const cropStart = useRef<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
  const dragCropId = useRef<string | null>(null);
  const [drawingCrop, setDrawingCrop] = useState<CropRect | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const previewImageRef = useRef<HTMLImageElement | null>(null);

  const scaleFactor =
    displaySize.width > 0 ? displaySize.width / imageWidth : 1;

  // Load main image
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      imageRef.current = img;
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Load preview image (for back-align front thumbnail)
  useEffect(() => {
    if (!previewImageSrc) {
      previewImageRef.current = null;
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      previewImageRef.current = img;
    };
    img.src = previewImageSrc;
  }, [previewImageSrc]);

  // Calculate display size
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width: containerWidth } = entries[0].contentRect;
      const aspectRatio = imageWidth / imageHeight;
      let width = containerWidth;
      let height = width / aspectRatio;

      if (height > maxDisplayHeight) {
        height = maxDisplayHeight;
        width = height * aspectRatio;
      }

      setDisplaySize({ width, height });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [imageWidth, imageHeight, maxDisplayHeight]);

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || displaySize.width === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = displaySize.width;
    canvas.height = displaySize.height;

    // Draw image
    ctx.drawImage(img, 0, 0, displaySize.width, displaySize.height);

    // Draw dark overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, displaySize.width, displaySize.height);

    // Clear crop areas using evenodd clipping
    const allCrops = drawingCrop
      ? [...crops, { id: "__drawing__", crop: drawingCrop }]
      : crops;

    if (allCrops.length > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, displaySize.width, displaySize.height);
      for (const item of allCrops) {
        const cx = item.crop.x * scaleFactor;
        const cy = item.crop.y * scaleFactor;
        const cw = item.crop.width * scaleFactor;
        const ch = item.crop.height * scaleFactor;
        ctx.rect(cx, cy, cw, ch);
      }
      ctx.clip("evenodd");
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, displaySize.width, displaySize.height);
      ctx.restore();
    }

    // Draw borders, handles, and index labels
    for (let i = 0; i < allCrops.length; i++) {
      const item = allCrops[i];
      const isSelected = item.id === selectedCropId;
      const isDrawing = item.id === "__drawing__";
      const cx = item.crop.x * scaleFactor;
      const cy = item.crop.y * scaleFactor;
      const cw = item.crop.width * scaleFactor;
      const ch = item.crop.height * scaleFactor;

      // Border
      ctx.strokeStyle = isSelected ? "#60a5fa" : isDrawing ? "#93c5fd" : "#3b82f6";
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(cx, cy, cw, ch);

      // Corner handles (only for selected)
      if (isSelected && !isDrawing) {
        ctx.fillStyle = "#60a5fa";
        const corners = [
          [cx, cy],
          [cx + cw, cy],
          [cx, cy + ch],
          [cx + cw, cy + ch],
        ];
        for (const [hx, hy] of corners) {
          ctx.fillRect(
            hx - HANDLE_SIZE / 2,
            hy - HANDLE_SIZE / 2,
            HANDLE_SIZE,
            HANDLE_SIZE
          );
        }
      }

      // Index number
      if (!isDrawing) {
        const label = String(i + 1);
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const labelX = cx + cw / 2;
        const labelY = cy + ch / 2;
        // Background circle
        ctx.fillStyle = isSelected
          ? "rgba(96, 165, 250, 0.8)"
          : "rgba(59, 130, 246, 0.7)";
        ctx.beginPath();
        ctx.arc(labelX, labelY, 12, 0, Math.PI * 2);
        ctx.fill();
        // Text
        ctx.fillStyle = "#fff";
        ctx.fillText(label, labelX, labelY);
      }
    }

    // Preview thumbnail of front side for selected crop (back-align mode)
    if (
      previewImageRef.current &&
      previewCrops &&
      selectedCropId
    ) {
      const frontItem = previewCrops.find((c) => c.id === selectedCropId);
      if (frontItem) {
        const previewImg = previewImageRef.current;
        const thumbSize = 100;
        const padding = 10;
        const tx = displaySize.width - thumbSize - padding;
        const ty = padding;

        // Draw border/background
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(tx - 2, ty - 2, thumbSize + 4, thumbSize + 4);

        // Draw cropped front image
        ctx.drawImage(
          previewImg,
          frontItem.crop.x,
          frontItem.crop.y,
          frontItem.crop.width,
          frontItem.crop.height,
          tx,
          ty,
          thumbSize,
          thumbSize
        );

        // Label
        ctx.font = "10px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText("Vorderseite", tx + thumbSize / 2, ty + thumbSize + 4);
      }
    }
  }, [
    imageSrc,
    crops,
    selectedCropId,
    displaySize,
    scaleFactor,
    drawingCrop,
    previewImageSrc,
    previewCrops,
  ]);

  const getCanvasPos = useCallback(
    (e: React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    []
  );

  // Find which crop handle or body is at a position
  const hitTest = useCallback(
    (pos: { x: number; y: number }): { id: string; mode: DragMode } | null => {
      // Check selected crop's handles first
      if (selectedCropId) {
        const sel = crops.find((c) => c.id === selectedCropId);
        if (sel) {
          const cx = sel.crop.x * scaleFactor;
          const cy = sel.crop.y * scaleFactor;
          const cw = sel.crop.width * scaleFactor;
          const ch = sel.crop.height * scaleFactor;

          const nearLeft = Math.abs(pos.x - cx) < HANDLE_THRESHOLD;
          const nearRight = Math.abs(pos.x - (cx + cw)) < HANDLE_THRESHOLD;
          const nearTop = Math.abs(pos.y - cy) < HANDLE_THRESHOLD;
          const nearBottom = Math.abs(pos.y - (cy + ch)) < HANDLE_THRESHOLD;

          if (nearTop && nearLeft)
            return { id: selectedCropId, mode: "nw" };
          if (nearTop && nearRight)
            return { id: selectedCropId, mode: "ne" };
          if (nearBottom && nearLeft)
            return { id: selectedCropId, mode: "sw" };
          if (nearBottom && nearRight)
            return { id: selectedCropId, mode: "se" };
        }
      }

      // Check all crops for body hit (reverse order — last drawn on top)
      for (let i = crops.length - 1; i >= 0; i--) {
        const item = crops[i];
        const cx = item.crop.x * scaleFactor;
        const cy = item.crop.y * scaleFactor;
        const cw = item.crop.width * scaleFactor;
        const ch = item.crop.height * scaleFactor;

        if (
          pos.x >= cx &&
          pos.x <= cx + cw &&
          pos.y >= cy &&
          pos.y <= cy + ch
        ) {
          return { id: item.id, mode: "move" };
        }
      }

      return null;
    },
    [crops, selectedCropId, scaleFactor]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const pos = getCanvasPos(e);
      const hit = hitTest(pos);

      if (hit) {
        // Hit an existing crop
        onSelectCrop(hit.id);
        const crop = crops.find((c) => c.id === hit.id)!.crop;
        setDragMode(hit.mode);
        dragStart.current = pos;
        cropStart.current = { ...crop };
        dragCropId.current = hit.id;
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } else if (!readOnly) {
        // Start drawing a new crop
        setDragMode("draw");
        dragStart.current = pos;
        setDrawingCrop(null);
        onSelectCrop(null);
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } else {
        onSelectCrop(null);
      }
    },
    [getCanvasPos, hitTest, crops, readOnly, onSelectCrop]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragMode) {
        // Update cursor
        const pos = getCanvasPos(e);
        const hit = hitTest(pos);
        const canvas = canvasRef.current;
        if (canvas) {
          if (!hit) canvas.style.cursor = readOnly ? "default" : "crosshair";
          else if (hit.mode === "nw" || hit.mode === "se")
            canvas.style.cursor = "nwse-resize";
          else if (hit.mode === "ne" || hit.mode === "sw")
            canvas.style.cursor = "nesw-resize";
          else if (hit.mode === "move") canvas.style.cursor = "move";
        }
        return;
      }

      const pos = getCanvasPos(e);

      if (dragMode === "draw") {
        // Drawing a new crop rectangle
        const startImg = {
          x: dragStart.current.x / scaleFactor,
          y: dragStart.current.y / scaleFactor,
        };
        const curImg = {
          x: pos.x / scaleFactor,
          y: pos.y / scaleFactor,
        };
        const dx = curImg.x - startImg.x;
        const dy = curImg.y - startImg.y;
        // Square: use the larger dimension
        const size = Math.max(Math.abs(dx), Math.abs(dy));
        if (size < 10) return;

        const cropX = dx >= 0 ? startImg.x : startImg.x - size;
        const cropY = dy >= 0 ? startImg.y : startImg.y - size;

        setDrawingCrop({
          x: Math.max(0, Math.min(cropX, imageWidth - size)),
          y: Math.max(0, Math.min(cropY, imageHeight - size)),
          width: Math.min(size, imageWidth),
          height: Math.min(size, imageHeight),
        });
        return;
      }

      // Move or resize an existing crop
      const dx = (pos.x - dragStart.current.x) / scaleFactor;
      const dy = (pos.y - dragStart.current.y) / scaleFactor;
      const start = cropStart.current;
      let newCrop: CropRect;

      if (dragMode === "move") {
        newCrop = {
          x: Math.max(0, Math.min(imageWidth - start.width, start.x + dx)),
          y: Math.max(0, Math.min(imageHeight - start.height, start.y + dy)),
          width: start.width,
          height: start.height,
        };
      } else {
        // Resize - maintain square
        const delta = Math.max(Math.abs(dx), Math.abs(dy));
        const sign =
          dragMode === "se"
            ? 1
            : dragMode === "nw"
              ? -1
              : dragMode === "ne"
                ? dx > 0
                  ? 1
                  : -1
                : dx < 0
                  ? 1
                  : -1;
        const sizeChange = sign * delta;

        newCrop = { ...start };

        if (dragMode === "se") {
          newCrop.width = Math.max(MIN_CROP_SIZE, start.width + sizeChange);
          newCrop.height = newCrop.width;
        } else if (dragMode === "nw") {
          const newSize = Math.max(MIN_CROP_SIZE, start.width - sizeChange);
          newCrop.x = start.x + start.width - newSize;
          newCrop.y = start.y + start.height - newSize;
          newCrop.width = newSize;
          newCrop.height = newSize;
        } else if (dragMode === "ne") {
          const newSize = Math.max(MIN_CROP_SIZE, start.width + sizeChange);
          newCrop.y = start.y + start.height - newSize;
          newCrop.width = newSize;
          newCrop.height = newSize;
        } else if (dragMode === "sw") {
          const newSize = Math.max(MIN_CROP_SIZE, start.width + sizeChange);
          newCrop.x = start.x + start.width - newSize;
          newCrop.width = newSize;
          newCrop.height = newSize;
        }

        // Clamp to image bounds
        newCrop.x = Math.max(0, newCrop.x);
        newCrop.y = Math.max(0, newCrop.y);
        newCrop.width = Math.min(newCrop.width, imageWidth - newCrop.x);
        newCrop.height = Math.min(newCrop.height, imageHeight - newCrop.y);
      }

      if (dragCropId.current) {
        onUpdateCrop(dragCropId.current, newCrop);
      }
    },
    [
      dragMode,
      getCanvasPos,
      hitTest,
      scaleFactor,
      imageWidth,
      imageHeight,
      readOnly,
      onUpdateCrop,
    ]
  );

  const handlePointerUp = useCallback(() => {
    if (dragMode === "draw" && drawingCrop) {
      // Finalize the drawn crop if large enough
      if (
        drawingCrop.width >= MIN_CROP_SIZE &&
        drawingCrop.height >= MIN_CROP_SIZE
      ) {
        onAddCrop({
          id: crypto.randomUUID(),
          crop: drawingCrop,
        });
      }
      setDrawingCrop(null);
    }
    setDragMode(null);
    dragCropId.current = null;
  }, [dragMode, drawingCrop, onAddCrop]);

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="touch-none rounded-lg border"
        style={{
          width: displaySize.width,
          height: displaySize.height,
        }}
      />
    </div>
  );
}

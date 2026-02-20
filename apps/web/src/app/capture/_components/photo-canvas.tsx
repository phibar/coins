"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { CropRect } from "@/types/capture";

interface PhotoCanvasProps {
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  crop: CropRect;
  onCropChange: (crop: CropRect) => void;
  maxDisplayHeight?: number;
}

type DragMode = "move" | "nw" | "ne" | "sw" | "se" | null;

export function PhotoCanvas({
  imageSrc,
  imageWidth,
  imageHeight,
  crop,
  onCropChange,
  maxDisplayHeight = 600,
}: PhotoCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const cropStart = useRef<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);

  const scaleFactor =
    displaySize.width > 0 ? displaySize.width / imageWidth : 1;

  // Load image
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      imageRef.current = img;
    };
    img.src = imageSrc;
  }, [imageSrc]);

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

    // Draw dark overlay outside crop
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, displaySize.width, displaySize.height);

    // Clear crop area (show image)
    const cx = crop.x * scaleFactor;
    const cy = crop.y * scaleFactor;
    const cw = crop.width * scaleFactor;
    const ch = crop.height * scaleFactor;

    ctx.clearRect(cx, cy, cw, ch);
    ctx.drawImage(img, 0, 0, displaySize.width, displaySize.height);
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";

    // Redraw overlay excluding crop area
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, displaySize.width, displaySize.height);
    ctx.rect(cx, cy, cw, ch);
    ctx.clip("evenodd");
    ctx.fillRect(0, 0, displaySize.width, displaySize.height);
    ctx.restore();

    // Draw crop border
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, cw, ch);

    // Draw corner handles
    const handleSize = 10;
    ctx.fillStyle = "#3b82f6";
    const corners = [
      [cx, cy],
      [cx + cw, cy],
      [cx, cy + ch],
      [cx + cw, cy + ch],
    ];
    for (const [hx, hy] of corners) {
      ctx.fillRect(
        hx - handleSize / 2,
        hy - handleSize / 2,
        handleSize,
        handleSize
      );
    }
  }, [imageSrc, crop, displaySize, scaleFactor]);

  const getCanvasPos = useCallback(
    (e: React.MouseEvent) => {
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

  const getDragMode = useCallback(
    (pos: { x: number; y: number }): DragMode => {
      const cx = crop.x * scaleFactor;
      const cy = crop.y * scaleFactor;
      const cw = crop.width * scaleFactor;
      const ch = crop.height * scaleFactor;
      const threshold = 15;

      const nearLeft = Math.abs(pos.x - cx) < threshold;
      const nearRight = Math.abs(pos.x - (cx + cw)) < threshold;
      const nearTop = Math.abs(pos.y - cy) < threshold;
      const nearBottom = Math.abs(pos.y - (cy + ch)) < threshold;

      if (nearTop && nearLeft) return "nw";
      if (nearTop && nearRight) return "ne";
      if (nearBottom && nearLeft) return "sw";
      if (nearBottom && nearRight) return "se";

      if (
        pos.x >= cx &&
        pos.x <= cx + cw &&
        pos.y >= cy &&
        pos.y <= cy + ch
      ) {
        return "move";
      }

      return null;
    },
    [crop, scaleFactor]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const pos = getCanvasPos(e);
      const mode = getDragMode(pos);
      if (mode) {
        setDragMode(mode);
        dragStart.current = pos;
        cropStart.current = { ...crop };
        e.preventDefault();
      }
    },
    [crop, getCanvasPos, getDragMode]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragMode) {
        // Update cursor
        const pos = getCanvasPos(e);
        const mode = getDragMode(pos);
        const canvas = canvasRef.current;
        if (canvas) {
          if (mode === "nw" || mode === "se") canvas.style.cursor = "nwse-resize";
          else if (mode === "ne" || mode === "sw") canvas.style.cursor = "nesw-resize";
          else if (mode === "move") canvas.style.cursor = "move";
          else canvas.style.cursor = "default";
        }
        return;
      }

      const pos = getCanvasPos(e);
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
        // Resize - maintain square aspect ratio
        const delta = Math.max(Math.abs(dx), Math.abs(dy));
        const sign =
          dragMode === "se"
            ? 1
            : dragMode === "nw"
              ? -1
              : dragMode === "ne"
                ? (dx > 0 ? 1 : -1)
                : (dx < 0 ? 1 : -1);

        const sizeChange = sign * delta;

        newCrop = { ...start };

        if (dragMode === "se") {
          newCrop.width = Math.max(50, start.width + sizeChange);
          newCrop.height = newCrop.width;
        } else if (dragMode === "nw") {
          const newSize = Math.max(50, start.width - sizeChange);
          newCrop.x = start.x + start.width - newSize;
          newCrop.y = start.y + start.height - newSize;
          newCrop.width = newSize;
          newCrop.height = newSize;
        } else if (dragMode === "ne") {
          const newSize = Math.max(50, start.width + sizeChange);
          newCrop.y = start.y + start.height - newSize;
          newCrop.width = newSize;
          newCrop.height = newSize;
        } else if (dragMode === "sw") {
          const newSize = Math.max(50, start.width + sizeChange);
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

      onCropChange(newCrop);
    },
    [dragMode, getCanvasPos, scaleFactor, imageWidth, imageHeight, onCropChange, getDragMode]
  );

  const handleMouseUp = useCallback(() => {
    setDragMode(null);
  }, []);

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="rounded-lg border"
        style={{
          width: displaySize.width,
          height: displaySize.height,
        }}
      />
    </div>
  );
}

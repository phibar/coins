"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { CropRect } from "@/types/capture";

interface PhotoCanvasProps {
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  crop: CropRect | null;
  onCropChange: (crop: CropRect) => void;
  maxDisplayHeight?: number;
}

type DragMode = "move" | "nw" | "ne" | "sw" | "se" | "draw" | null;

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
  const drawingCrop = useRef<CropRect | null>(null);
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

    // Determine which crop rect to show
    const activeCrop = drawingCrop.current ?? crop;

    if (!activeCrop) {
      // No crop yet — show image with slight overlay to indicate "draw here"
      ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
      ctx.fillRect(0, 0, displaySize.width, displaySize.height);
      return;
    }

    // Draw dark overlay outside crop
    const cx = activeCrop.x * scaleFactor;
    const cy = activeCrop.y * scaleFactor;
    const cw = activeCrop.width * scaleFactor;
    const ch = activeCrop.height * scaleFactor;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, displaySize.width, displaySize.height);
    ctx.rect(cx, cy, cw, ch);
    ctx.clip("evenodd");
    ctx.fillRect(0, 0, displaySize.width, displaySize.height);
    ctx.restore();

    // Draw crop border
    const isDrawing = drawingCrop.current !== null;
    ctx.strokeStyle = isDrawing ? "#93c5fd" : "#3b82f6";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx, cy, cw, ch);

    // Draw corner handles (only when not drawing)
    if (!isDrawing) {
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

  const getHitMode = useCallback(
    (pos: { x: number; y: number }): DragMode => {
      if (!crop) return null;
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
      const mode = getHitMode(pos);

      if (mode) {
        // Hit existing crop: move or resize
        setDragMode(mode);
        dragStart.current = pos;
        cropStart.current = { ...crop! };
      } else {
        // Empty space: start drawing new crop
        setDragMode("draw");
        dragStart.current = pos;
        drawingCrop.current = null;
      }
      e.preventDefault();
    },
    [crop, getCanvasPos, getHitMode]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragMode) {
        // Update cursor
        const pos = getCanvasPos(e);
        const mode = getHitMode(pos);
        const canvas = canvasRef.current;
        if (canvas) {
          if (mode === "nw" || mode === "se") canvas.style.cursor = "nwse-resize";
          else if (mode === "ne" || mode === "sw") canvas.style.cursor = "nesw-resize";
          else if (mode === "move") canvas.style.cursor = "move";
          else canvas.style.cursor = "crosshair";
        }
        return;
      }

      const pos = getCanvasPos(e);
      const shiftHeld = e.shiftKey;

      if (dragMode === "draw") {
        // Drawing new crop
        const startX = dragStart.current.x / scaleFactor;
        const startY = dragStart.current.y / scaleFactor;
        const curX = pos.x / scaleFactor;
        const curY = pos.y / scaleFactor;

        let dx = curX - startX;
        let dy = curY - startY;

        if (shiftHeld) {
          const size = Math.max(Math.abs(dx), Math.abs(dy));
          dx = dx >= 0 ? size : -size;
          dy = dy >= 0 ? size : -size;
        }

        const x = dx >= 0 ? startX : startX + dx;
        const y = dy >= 0 ? startY : startY + dy;
        const w = Math.abs(dx);
        const h = Math.abs(dy);

        const clampedX = Math.max(0, x);
        const clampedY = Math.max(0, y);
        const clampedW = Math.min(w, imageWidth - clampedX);
        const clampedH = Math.min(h, imageHeight - clampedY);

        drawingCrop.current = {
          x: clampedX,
          y: clampedY,
          width: clampedW,
          height: clampedH,
        };

        // Force canvas redraw
        const canvas = canvasRef.current;
        const img = imageRef.current;
        if (canvas && img) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, displaySize.width, displaySize.height);
            const dc = drawingCrop.current;
            const cx = dc.x * scaleFactor;
            const cy = dc.y * scaleFactor;
            const cw = dc.width * scaleFactor;
            const ch = dc.height * scaleFactor;

            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, displaySize.width, displaySize.height);
            ctx.rect(cx, cy, cw, ch);
            ctx.clip("evenodd");
            ctx.fillRect(0, 0, displaySize.width, displaySize.height);
            ctx.restore();

            ctx.strokeStyle = "#93c5fd";
            ctx.lineWidth = 2;
            ctx.strokeRect(cx, cy, cw, ch);
          }
        }
        return;
      }

      // Handle move/resize (crop is guaranteed non-null when in these modes)
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
      } else if (shiftHeld) {
        let signedDelta: number;
        if (dragMode === "se") {
          signedDelta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
        } else if (dragMode === "nw") {
          signedDelta = Math.abs(dx) > Math.abs(dy) ? -dx : -dy;
        } else if (dragMode === "ne") {
          signedDelta = Math.abs(dx) > Math.abs(dy) ? dx : -dy;
        } else {
          signedDelta = Math.abs(dx) > Math.abs(dy) ? -dx : dy;
        }

        const newSize = Math.max(50, start.width + signedDelta);
        newCrop = { ...start };

        if (dragMode === "se") {
          newCrop.width = newSize;
          newCrop.height = newSize;
        } else if (dragMode === "nw") {
          newCrop.x = start.x + start.width - newSize;
          newCrop.y = start.y + start.height - newSize;
          newCrop.width = newSize;
          newCrop.height = newSize;
        } else if (dragMode === "ne") {
          newCrop.y = start.y + start.height - newSize;
          newCrop.width = newSize;
          newCrop.height = newSize;
        } else if (dragMode === "sw") {
          newCrop.x = start.x + start.width - newSize;
          newCrop.width = newSize;
          newCrop.height = newSize;
        }

        newCrop.x = Math.max(0, newCrop.x);
        newCrop.y = Math.max(0, newCrop.y);
        newCrop.width = Math.min(newCrop.width, imageWidth - newCrop.x);
        newCrop.height = Math.min(newCrop.height, imageHeight - newCrop.y);
      } else {
        newCrop = { ...start };

        if (dragMode === "se") {
          newCrop.width = Math.max(50, start.width + dx);
          newCrop.height = Math.max(50, start.height + dy);
        } else if (dragMode === "nw") {
          const newW = Math.max(50, start.width - dx);
          const newH = Math.max(50, start.height - dy);
          newCrop.x = start.x + start.width - newW;
          newCrop.y = start.y + start.height - newH;
          newCrop.width = newW;
          newCrop.height = newH;
        } else if (dragMode === "ne") {
          const newW = Math.max(50, start.width + dx);
          const newH = Math.max(50, start.height - dy);
          newCrop.y = start.y + start.height - newH;
          newCrop.width = newW;
          newCrop.height = newH;
        } else if (dragMode === "sw") {
          const newW = Math.max(50, start.width - dx);
          const newH = Math.max(50, start.height + dy);
          newCrop.x = start.x + start.width - newW;
          newCrop.width = newW;
          newCrop.height = newH;
        }

        newCrop.x = Math.max(0, newCrop.x);
        newCrop.y = Math.max(0, newCrop.y);
        newCrop.width = Math.min(newCrop.width, imageWidth - newCrop.x);
        newCrop.height = Math.min(newCrop.height, imageHeight - newCrop.y);
      }

      onCropChange(newCrop);
    },
    [dragMode, getCanvasPos, scaleFactor, imageWidth, imageHeight, onCropChange, getHitMode, displaySize]
  );

  const handleMouseUp = useCallback(() => {
    if (dragMode === "draw" && drawingCrop.current) {
      const dc = drawingCrop.current;
      if (dc.width >= 50 && dc.height >= 50) {
        onCropChange(dc);
      }
    }
    drawingCrop.current = null;
    setDragMode(null);
  }, [dragMode, onCropChange]);

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

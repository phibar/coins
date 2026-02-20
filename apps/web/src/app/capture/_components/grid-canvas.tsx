"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { GridConfig, GridOverlayState } from "@/types/capture";

interface GridCanvasProps {
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
  gridConfig: GridConfig;
  overlay: GridOverlayState;
  onOverlayChange: (overlay: GridOverlayState) => void;
  onToggleEmptySlot: (slotIndex: number) => void;
  maxDisplayHeight?: number;
}

type DragMode = "move" | "se" | null;

export function GridCanvas({
  imageSrc,
  imageWidth,
  imageHeight,
  gridConfig,
  overlay,
  onOverlayChange,
  onToggleEmptySlot,
  maxDisplayHeight = 600,
}: GridCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const overlayStart = useRef<GridOverlayState>({ x: 0, y: 0, width: 0, height: 0 });
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

    // Draw semi-transparent overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(0, 0, displaySize.width, displaySize.height);

    // Grid overlay in display coordinates
    const ox = overlay.x * scaleFactor;
    const oy = overlay.y * scaleFactor;
    const ow = overlay.width * scaleFactor;
    const oh = overlay.height * scaleFactor;

    const cellW = ow / gridConfig.cols;
    const cellH = oh / gridConfig.rows;

    // Draw each cell
    for (let row = 0; row < gridConfig.rows; row++) {
      for (let col = 0; col < gridConfig.cols; col++) {
        const slotIndex = row * gridConfig.cols + col;
        const cx = ox + col * cellW;
        const cy = oy + row * cellH;

        if (gridConfig.emptySlots.includes(slotIndex)) {
          // Empty slot — dark overlay with X
          ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
          ctx.fillRect(cx, cy, cellW, cellH);
          ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx + 4, cy + 4);
          ctx.lineTo(cx + cellW - 4, cy + cellH - 4);
          ctx.moveTo(cx + cellW - 4, cy + 4);
          ctx.lineTo(cx + 4, cy + cellH - 4);
          ctx.stroke();
        } else {
          // Active slot — clear the dark overlay to show image
          ctx.save();
          ctx.beginPath();
          ctx.rect(cx + 1, cy + 1, cellW - 2, cellH - 2);
          ctx.clip();
          ctx.drawImage(img, 0, 0, displaySize.width, displaySize.height);
          ctx.restore();
        }

        // Cell border
        ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(cx, cy, cellW, cellH);
      }
    }

    // Grid outer border
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(ox, oy, ow, oh);

    // Resize handle (bottom-right corner)
    const handleSize = 14;
    ctx.fillStyle = "#3b82f6";
    ctx.fillRect(
      ox + ow - handleSize / 2,
      oy + oh - handleSize / 2,
      handleSize,
      handleSize
    );
  }, [imageSrc, overlay, gridConfig, displaySize, scaleFactor]);

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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const pos = getCanvasPos(e);
      const ox = overlay.x * scaleFactor;
      const oy = overlay.y * scaleFactor;
      const ow = overlay.width * scaleFactor;
      const oh = overlay.height * scaleFactor;

      // Check resize handle
      const handleThreshold = 20;
      if (
        Math.abs(pos.x - (ox + ow)) < handleThreshold &&
        Math.abs(pos.y - (oy + oh)) < handleThreshold
      ) {
        setDragMode("se");
        dragStart.current = pos;
        overlayStart.current = { ...overlay };
        e.preventDefault();
        return;
      }

      // Check if inside grid for move
      if (pos.x >= ox && pos.x <= ox + ow && pos.y >= oy && pos.y <= oy + oh) {
        setDragMode("move");
        dragStart.current = pos;
        overlayStart.current = { ...overlay };
        e.preventDefault();
        return;
      }
    },
    [overlay, scaleFactor, getCanvasPos]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pos = getCanvasPos(e);

      if (!dragMode) {
        // Update cursor
        const ox = overlay.x * scaleFactor;
        const oy = overlay.y * scaleFactor;
        const ow = overlay.width * scaleFactor;
        const oh = overlay.height * scaleFactor;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleThreshold = 20;
        if (
          Math.abs(pos.x - (ox + ow)) < handleThreshold &&
          Math.abs(pos.y - (oy + oh)) < handleThreshold
        ) {
          canvas.style.cursor = "nwse-resize";
        } else if (
          pos.x >= ox &&
          pos.x <= ox + ow &&
          pos.y >= oy &&
          pos.y <= oy + oh
        ) {
          canvas.style.cursor = "move";
        } else {
          canvas.style.cursor = "default";
        }
        return;
      }

      const dx = (pos.x - dragStart.current.x) / scaleFactor;
      const dy = (pos.y - dragStart.current.y) / scaleFactor;
      const start = overlayStart.current;

      if (dragMode === "move") {
        onOverlayChange({
          x: Math.max(0, Math.min(imageWidth - start.width, start.x + dx)),
          y: Math.max(0, Math.min(imageHeight - start.height, start.y + dy)),
          width: start.width,
          height: start.height,
        });
      } else if (dragMode === "se") {
        const newWidth = Math.max(100, start.width + dx);
        const newHeight = Math.max(100, start.height + dy);
        onOverlayChange({
          x: start.x,
          y: start.y,
          width: Math.min(newWidth, imageWidth - start.x),
          height: Math.min(newHeight, imageHeight - start.y),
        });
      }
    },
    [dragMode, getCanvasPos, scaleFactor, imageWidth, imageHeight, onOverlayChange, overlay]
  );

  const handleMouseUp = useCallback(() => {
    setDragMode(null);
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (dragMode) return;

      const pos = getCanvasPos(e);
      const ox = overlay.x * scaleFactor;
      const oy = overlay.y * scaleFactor;
      const ow = overlay.width * scaleFactor;
      const oh = overlay.height * scaleFactor;

      // Check if click is inside grid
      if (pos.x < ox || pos.x > ox + ow || pos.y < oy || pos.y > oy + oh) return;

      const cellW = ow / gridConfig.cols;
      const cellH = oh / gridConfig.rows;
      const col = Math.floor((pos.x - ox) / cellW);
      const row = Math.floor((pos.y - oy) / cellH);
      const slotIndex = row * gridConfig.cols + col;

      onToggleEmptySlot(slotIndex);
    },
    [dragMode, getCanvasPos, overlay, scaleFactor, gridConfig, onToggleEmptySlot]
  );

  // Detect click vs drag
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDownWrapped = useCallback(
    (e: React.MouseEvent) => {
      mouseDownPos.current = { x: e.clientX, y: e.clientY };
      handleMouseDown(e);
    },
    [handleMouseDown]
  );

  const handleMouseUpWrapped = useCallback(
    (e: React.MouseEvent) => {
      const start = mouseDownPos.current;
      if (start) {
        const dist = Math.sqrt(
          (e.clientX - start.x) ** 2 + (e.clientY - start.y) ** 2
        );
        if (dist < 5) {
          handleClick(e);
        }
      }
      mouseDownPos.current = null;
      handleMouseUp();
    },
    [handleClick, handleMouseUp]
  );

  return (
    <div ref={containerRef} className="w-full">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDownWrapped}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpWrapped}
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

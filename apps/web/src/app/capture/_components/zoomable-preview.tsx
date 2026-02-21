"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface ZoomablePreviewProps {
  src: string;
  alt: string;
  label: string;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.3;

export function ZoomablePreview({ src, alt, label }: ZoomablePreviewProps) {
  const [zoom, setZoom] = useState(1);
  // Pan offset in pixels (relative to container center)
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // Reset when image changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [src]);

  const clampPan = useCallback(
    (x: number, y: number, z: number) => {
      const el = containerRef.current;
      if (!el) return { x, y };
      const rect = el.getBoundingClientRect();
      // How far the image extends beyond the container
      const maxX = Math.max(0, (rect.width * z - rect.width) / 2);
      const maxY = Math.max(0, (rect.height * z - rect.height) / 2);
      return {
        x: Math.max(-maxX, Math.min(maxX, x)),
        y: Math.max(-maxY, Math.min(maxY, y)),
      };
    },
    []
  );

  const zoomTo = useCallback(
    (newZoom: number, centerX?: number, centerY?: number) => {
      setZoom((prevZoom) => {
        const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
        const ratio = clamped / prevZoom;

        setPan((prev) => {
          // Zoom toward the cursor position
          let nx = prev.x;
          let ny = prev.y;
          if (centerX !== undefined && centerY !== undefined) {
            const el = containerRef.current;
            if (el) {
              const rect = el.getBoundingClientRect();
              // Offset of cursor from container center
              const cx = centerX - rect.left - rect.width / 2;
              const cy = centerY - rect.top - rect.height / 2;
              nx = prev.x * ratio - cx * (ratio - 1);
              ny = prev.y * ratio - cy * (ratio - 1);
            }
          } else {
            nx = prev.x * ratio;
            ny = prev.y * ratio;
          }
          return clampPan(nx, ny, clamped);
        });

        return clamped;
      });
    },
    [clampPan]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      zoomTo(zoom * factor, e.clientX, e.clientY);
    },
    [zoom, zoomTo]
  );

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
      setPan((prev) => clampPan(prev.x + dx, prev.y + dy, zoom));
    },
    [zoom, clampPan]
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  return (
    <div className="flex-1 min-w-0">
      <div className="mb-1 flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-xs"
            onClick={() => zoomTo(zoom / ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
          >
            −
          </Button>
          <button
            type="button"
            onClick={handleReset}
            className="text-[10px] text-muted-foreground tabular-nums w-8 text-center hover:text-foreground transition-colors"
            title="Zurücksetzen"
          >
            {Math.round(zoom * 100)}%
          </button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-xs"
            onClick={() => zoomTo(zoom * ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
          >
            +
          </Button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="aspect-square max-h-[60vh] overflow-hidden rounded-lg border bg-muted/30 cursor-grab active:cursor-grabbing touch-none"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="select-none pointer-events-none w-full h-full object-contain origin-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        />
      </div>
    </div>
  );
}

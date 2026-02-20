import type { CropRect } from "@/types/capture";

/**
 * Rotates an image by 90° clockwise using a canvas element.
 * Returns a new blob URL for the rotated image and the new dimensions.
 */
export async function rotateImage90(
  imageSrc: string,
  imageWidth: number,
  imageHeight: number
): Promise<{ url: string; width: number; height: number }> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image for rotation"));
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = imageHeight;
  canvas.height = imageWidth;

  const ctx = canvas.getContext("2d")!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, -imageWidth / 2, -imageHeight / 2);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
      "image/jpeg",
      0.95
    );
  });

  return {
    url: URL.createObjectURL(blob),
    width: imageHeight,
    height: imageWidth,
  };
}

/**
 * Extracts a cropped region from an image URL using a canvas element.
 * Returns a blob URL for the cropped region.
 */
export async function generateCropPreviewUrl(
  imageSrc: string,
  crop: CropRect,
  maxSize: number = 500
): Promise<string> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image for crop preview"));
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  const scale = Math.min(1, maxSize / Math.max(crop.width, crop.height));
  canvas.width = Math.round(crop.width * scale);
  canvas.height = Math.round(crop.height * scale);

  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    img,
    crop.x, crop.y, crop.width, crop.height,
    0, 0, canvas.width, canvas.height
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))),
      "image/jpeg",
      0.92
    );
  });
  return URL.createObjectURL(blob);
}

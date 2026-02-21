import sharp from "sharp";

export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function cropImage(
  imageBuffer: Buffer,
  region: CropRegion
): Promise<Buffer> {
  // .rotate() without arguments auto-rotates based on EXIF orientation.
  // This must happen before .extract() so crop coordinates match what
  // the browser displayed (browsers auto-apply EXIF rotation).
  return sharp(imageBuffer)
    .rotate()
    .extract({
      left: Math.round(region.x),
      top: Math.round(region.y),
      width: Math.round(region.width),
      height: Math.round(region.height),
    })
    .jpeg({ quality: 95 })
    .toBuffer();
}

export async function generateThumbnail(
  imageBuffer: Buffer,
  size: number = 300
): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(size, size, {
      fit: "cover",
      position: "centre",
    })
    .jpeg({ quality: 80 })
    .toBuffer();
}

export async function flipHorizontal(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer).rotate().flop().toBuffer();
}

export async function getImageMetadata(imageBuffer: Buffer) {
  const metadata = await sharp(imageBuffer).metadata();
  return {
    width: metadata.width!,
    height: metadata.height!,
    format: metadata.format!,
  };
}

import sharp from "sharp";

export interface DetectedCoin {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  area: number;
}

export interface DetectionResult {
  coins: DetectedCoin[];
  suggestedGrid?: {
    rows: number;
    cols: number;
    overlay: { x: number; y: number; width: number; height: number };
  };
  originalWidth: number;
  originalHeight: number;
}

const MAX_PROCESS_WIDTH = 1500;
const THRESHOLD = 180;
const MIN_AREA_RATIO = 0.003;
const MAX_AREA_RATIO = 0.3;

export async function detectCoins(
  imageBuffer: Buffer
): Promise<DetectionResult> {
  const metadata = await sharp(imageBuffer).rotate().metadata();
  const origWidth = metadata.width!;
  const origHeight = metadata.height!;

  const scale =
    origWidth > MAX_PROCESS_WIDTH ? MAX_PROCESS_WIDTH / origWidth : 1;
  const procWidth = Math.round(origWidth * scale);
  const procHeight = Math.round(origHeight * scale);

  // Grayscale → threshold → invert so coins are white (1) on black (0)
  const { data, info } = await sharp(imageBuffer)
    .rotate()
    .resize(procWidth, procHeight)
    .grayscale()
    .threshold(THRESHOLD)
    .negate() // After threshold: bg=white, coin=black → negate so coin=white
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const totalPixels = width * height;

  // Binary: 1 = coin pixel (white after negate), 0 = background
  const binary = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    binary[i] = data[i] > 128 ? 1 : 0;
  }

  // Connected component labeling via iterative flood fill
  const labels = new Int32Array(totalPixels);
  let nextLabel = 1;
  const components: Map<
    number,
    { minX: number; maxX: number; minY: number; maxY: number; area: number }
  > = new Map();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binary[idx] === 1 && labels[idx] === 0) {
        const label = nextLabel++;
        const comp = { minX: x, maxX: x, minY: y, maxY: y, area: 0 };
        const stack: number[] = [idx];

        while (stack.length > 0) {
          const ci = stack.pop()!;
          if (labels[ci] !== 0) continue;
          labels[ci] = label;
          comp.area++;

          const cx = ci % width;
          const cy = (ci - cx) / width;
          if (cx < comp.minX) comp.minX = cx;
          if (cx > comp.maxX) comp.maxX = cx;
          if (cy < comp.minY) comp.minY = cy;
          if (cy > comp.maxY) comp.maxY = cy;

          // 4-connected neighbors
          if (cx > 0 && binary[ci - 1] === 1 && labels[ci - 1] === 0)
            stack.push(ci - 1);
          if (cx < width - 1 && binary[ci + 1] === 1 && labels[ci + 1] === 0)
            stack.push(ci + 1);
          if (cy > 0 && binary[ci - width] === 1 && labels[ci - width] === 0)
            stack.push(ci - width);
          if (
            cy < height - 1 &&
            binary[ci + width] === 1 &&
            labels[ci + width] === 0
          )
            stack.push(ci + width);
        }

        components.set(label, comp);
      }
    }
  }

  // Filter by area
  const minArea = totalPixels * MIN_AREA_RATIO;
  const maxArea = totalPixels * MAX_AREA_RATIO;

  const detectedCoins: DetectedCoin[] = [];
  for (const comp of components.values()) {
    if (comp.area < minArea || comp.area > maxArea) continue;

    const coinX = comp.minX / scale;
    const coinY = comp.minY / scale;
    const coinW = (comp.maxX - comp.minX + 1) / scale;
    const coinH = (comp.maxY - comp.minY + 1) / scale;

    detectedCoins.push({
      x: coinX,
      y: coinY,
      width: coinW,
      height: coinH,
      centerX: coinX + coinW / 2,
      centerY: coinY + coinH / 2,
      area: comp.area / (scale * scale),
    });
  }

  // Sort top-to-bottom, left-to-right
  detectedCoins.sort((a, b) => a.centerY - b.centerY || a.centerX - b.centerX);

  // Grid detection
  let suggestedGrid: DetectionResult["suggestedGrid"];
  if (detectedCoins.length >= 2) {
    suggestedGrid = detectGridLayout(detectedCoins, origWidth, origHeight);
  }

  return {
    coins: detectedCoins,
    suggestedGrid,
    originalWidth: origWidth,
    originalHeight: origHeight,
  };
}

function detectGridLayout(
  coins: DetectedCoin[],
  imageWidth: number,
  imageHeight: number
): DetectionResult["suggestedGrid"] | undefined {
  if (coins.length < 2) return undefined;

  const avgHeight = coins.reduce((s, c) => s + c.height, 0) / coins.length;
  const yGapThreshold = avgHeight * 0.5;

  // Cluster by Y to find rows
  const sortedByY = [...coins].sort((a, b) => a.centerY - b.centerY);
  const rows: DetectedCoin[][] = [[sortedByY[0]]];
  for (let i = 1; i < sortedByY.length; i++) {
    if (
      sortedByY[i].centerY - sortedByY[i - 1].centerY >
      yGapThreshold
    ) {
      rows.push([]);
    }
    rows[rows.length - 1].push(sortedByY[i]);
  }

  const numRows = rows.length;
  const numCols = Math.max(...rows.map((r) => r.length));

  if (numRows < 1 || numCols < 1) return undefined;

  // Bounding overlay with padding
  const padding = avgHeight * 0.1;
  const minX = Math.max(0, Math.min(...coins.map((c) => c.x)) - padding);
  const minY = Math.max(0, Math.min(...coins.map((c) => c.y)) - padding);
  const maxX = Math.min(
    imageWidth,
    Math.max(...coins.map((c) => c.x + c.width)) + padding
  );
  const maxY = Math.min(
    imageHeight,
    Math.max(...coins.map((c) => c.y + c.height)) + padding
  );

  return {
    rows: numRows,
    cols: numCols,
    overlay: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    },
  };
}

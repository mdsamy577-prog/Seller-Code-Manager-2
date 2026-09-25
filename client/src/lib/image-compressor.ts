/**
 * Client-Side Automatic Image Compression Utility
 * 
 * Compresses any user-selected image (Profile Photo, NID Card, Renewal Photo, Admin Avatar)
 * directly in browser via HTML5 Canvas.
 * 
 * - Target file size: strictly between 50 KB and 100 KB
 * - Maximum dimensions: 1200px width/height (preserving aspect ratio)
 * - Output format: standard .jpg (image/jpeg)
 * - Handles JPG, PNG, WEBP, and camera photos regardless of original size (10MB, 50MB+)
 */

export interface CompressionOptions {
  minSizeKB?: number; // default: 50
  maxSizeKB?: number; // default: 100
  maxWidth?: number;  // default: 1200
  maxHeight?: number; // default: 1200
  initialQuality?: number; // default: 0.82
}

export interface CompressedImageResult {
  file: File;
  blob: Blob;
  previewUrl: string;
  originalSizeKB: number;
  compressedSizeKB: number;
  width: number;
  height: number;
  quality: number;
}

/**
 * Loads an image File or Blob into an HTMLImageElement safely.
 */
function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("ছবির ফাইলটি লোড করা সম্ভব হয়নি। অনুগ্রহ করে পরিষ্কার JPG/PNG ছবি নির্বাচন করুন।"));
    };
    img.src = url;
  });
}

/**
 * Renders an image to an HTML5 Canvas with white background (to handle PNG transparency).
 */
function renderToCanvas(img: HTMLImageElement, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("Canvas context is not available in browser");
  }

  // Fill with solid white in case the original had alpha channel transparency
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return canvas;
}

/**
 * Exports canvas to JPEG Blob at given quality.
 */
function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas blob conversion failed"));
      },
      "image/jpeg",
      Math.max(0.05, Math.min(1.0, quality))
    );
  });
}

/**
 * Compresses an image File or Blob to target 50 KB – 100 KB and standard .jpg format.
 */
export async function compressImage(
  file: File | Blob,
  options?: CompressionOptions
): Promise<CompressedImageResult> {
  const minSizeKB = options?.minSizeKB ?? 50;
  const maxSizeKB = options?.maxSizeKB ?? 100;
  const maxWidth = options?.maxWidth ?? 1200;
  const maxHeight = options?.maxHeight ?? 1200;

  const minBytes = minSizeKB * 1024;
  const maxBytes = maxSizeKB * 1024;
  const targetBytes = (minBytes + maxBytes) / 2; // ~75 KB target midpoint

  const originalSize = file.size;
  const originalSizeKB = parseFloat((originalSize / 1024).toFixed(1));

  // 1. Decode image
  const img = await loadImage(file);

  // 2. Compute initial constrained dimensions
  let currentWidth = img.naturalWidth || img.width || 800;
  let currentHeight = img.naturalHeight || img.height || 600;

  if (currentWidth > maxWidth || currentHeight > maxHeight) {
    const ratio = Math.min(maxWidth / currentWidth, maxHeight / currentHeight);
    currentWidth = Math.round(currentWidth * ratio);
    currentHeight = Math.round(currentHeight * ratio);
  }

  // 3. Render initial canvas
  let canvas = renderToCanvas(img, currentWidth, currentHeight);

  // 4. Binary search / iterative quality adjustment to hit strictly 50KB - 100KB
  let minQ = 0.15;
  let maxQ = 0.98;
  let currentQ = options?.initialQuality ?? 0.82;
  let bestBlob: Blob | null = null;
  let bestDiff = Infinity;
  let bestQ = currentQ;

  for (let iter = 0; iter < 7; iter++) {
    const blob = await canvasToBlob(canvas, currentQ);
    const size = blob.size;

    // Check if within the target [50KB, 100KB]
    if (size >= minBytes && size <= maxBytes) {
      bestBlob = blob;
      bestQ = currentQ;
      break;
    }

    // Keep track of best candidate (preferring <= maxBytes)
    const diff = Math.abs(size - targetBytes);
    if (!bestBlob || (size <= maxBytes && (bestBlob.size > maxBytes || diff < bestDiff))) {
      bestBlob = blob;
      bestDiff = diff;
      bestQ = currentQ;
    }

    if (size > maxBytes) {
      // Too large, decrease quality
      maxQ = currentQ;
      // If quality is already low and size still too big, downscale dimensions
      if (currentQ <= 0.35 && currentWidth > 450 && currentHeight > 450) {
        currentWidth = Math.round(currentWidth * 0.8);
        currentHeight = Math.round(currentHeight * 0.8);
        canvas = renderToCanvas(img, currentWidth, currentHeight);
        minQ = 0.2;
        maxQ = 0.9;
        currentQ = 0.72;
        continue;
      }
      currentQ = (minQ + currentQ) / 2;
    } else {
      // Too small, increase quality
      minQ = currentQ;
      // If already at high quality (>0.94) and still small, image is naturally simple
      if (currentQ >= 0.94) {
        bestBlob = blob;
        bestQ = currentQ;
        break;
      }
      currentQ = (currentQ + maxQ) / 2;
    }

    if (Math.abs(maxQ - minQ) < 0.02) {
      break;
    }
  }

  // 5. Safety guarantee: If still exceeds maxBytes (100KB), downscale canvas iteratively
  while (bestBlob && bestBlob.size > maxBytes && currentWidth > 320 && currentHeight > 320) {
    currentWidth = Math.round(currentWidth * 0.85);
    currentHeight = Math.round(currentHeight * 0.85);
    canvas = renderToCanvas(img, currentWidth, currentHeight);
    bestBlob = await canvasToBlob(canvas, Math.min(bestQ, 0.75));
  }

  if (!bestBlob) {
    bestBlob = await canvasToBlob(canvas, 0.75);
  }

  // 6. Convert to standard .jpg File
  const originalName = (file as File).name || "photo";
  const cleanBaseName = originalName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_") || "photo";
  const jpgFileName = `${cleanBaseName}.jpg`;

  const compressedFile = new File([bestBlob], jpgFileName, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });

  const compressedSizeKB = parseFloat((bestBlob.size / 1024).toFixed(1));
  const previewUrl = URL.createObjectURL(bestBlob);

  return {
    file: compressedFile,
    blob: bestBlob,
    previewUrl,
    originalSizeKB,
    compressedSizeKB,
    width: canvas.width,
    height: canvas.height,
    quality: bestQ,
  };
}

/**
 * Checks if a file is an image that can be compressed.
 */
export function isCompressibleImage(file: File): boolean {
  if (!file) return false;
  if (file.type && file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|bmp|gif)$/i.test(file.name);
}

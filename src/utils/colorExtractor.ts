/**
 * Intelligent Image Color Extraction & Garment Color Detection Utility
 * Extracts dominant fabric colors from product image URLs / Base64 data
 * and assigns aesthetic, human-friendly fashion color names.
 */

export interface DetectedColor {
  name: string;
  hex: string;
  rgb: { r: number; g: number; b: number };
  percentage?: number;
}

// Curated list of fashion / streetwear colors with human-readable names
const FASHION_PALETTE: { name: string; hex: string; r: number; g: number; b: number }[] = [
  { name: 'Pitch Black', hex: '#111111', r: 17, g: 17, b: 17 },
  { name: 'Charcoal Black', hex: '#202522', r: 32, g: 37, b: 34 },
  { name: 'Jet Black', hex: '#1C1C1E', r: 28, g: 28, b: 30 },
  { name: 'Forest Pine', hex: '#14221C', r: 20, g: 34, b: 28 },
  { name: 'Deep Olive', hex: '#3B4134', r: 59, g: 65, b: 52 },
  { name: 'Army Green', hex: '#4B5320', r: 75, g: 83, b: 32 },
  { name: 'Sage Green', hex: '#879782', r: 135, g: 151, b: 130 },
  { name: 'Navy Blue', hex: '#1B263B', r: 27, g: 38, b: 59 },
  { name: 'Midnight Blue', hex: '#0D1B2A', r: 13, g: 27, b: 42 },
  { name: 'Denim Indigo', hex: '#283E56', r: 40, g: 62, b: 86 },
  { name: 'Sky Blue', hex: '#779ECB', r: 119, g: 158, b: 203 },
  { name: 'Heather Grey', hex: '#9E9E9E', r: 158, g: 158, b: 158 },
  { name: 'Ash Grey', hex: '#6E727A', r: 110, g: 114, b: 122 },
  { name: 'Slate Grey', hex: '#4D5154', r: 77, g: 81, b: 84 },
  { name: 'Dark Graphite', hex: '#37383B', r: 55, g: 56, b: 59 },
  { name: 'Off-White / Cream', hex: '#D9D4C7', r: 217, g: 212, b: 199 },
  { name: 'Ivory White', hex: '#FAF8F5', r: 250, g: 248, b: 245 },
  { name: 'Pure White', hex: '#FFFFFF', r: 255, g: 255, b: 255 },
  { name: 'Natural Beige', hex: '#EAE6DD', r: 234, g: 230, b: 221 },
  { name: 'Khaki Tan', hex: '#B8A88A', r: 184, g: 168, b: 138 },
  { name: 'Camel Brown', hex: '#967140', r: 150, g: 113, b: 64 },
  { name: 'Espresso Brown', hex: '#3D2817', r: 61, g: 40, b: 23 },
  { name: 'Rust Maroon', hex: '#632023', r: 99, g: 32, b: 35 },
  { name: 'Burgundy Wine', hex: '#4A1521', r: 74, g: 21, b: 33 },
  { name: 'Crimson Red', hex: '#991B1B', r: 153, g: 27, b: 27 },
  { name: 'Terracotta Orange', hex: '#C85A32', r: 200, g: 90, b: 50 },
  { name: 'Mustard Ochre', hex: '#D49B28', r: 212, g: 155, b: 40 },
  { name: 'Royal Purple', hex: '#4C1D95', r: 76, g: 29, b: 149 },
  { name: 'Dusty Rose', hex: '#B76E79', r: 183, g: 110, b: 121 }
];

/**
 * Calculates color distance (Euclidean in RGB space with perceptual weight)
 */
function getColorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number {
  const rmean = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(
    (((512 + rmean) * dr * dr) >> 8) +
      4 * dg * dg +
      (((767 - rmean) * db * db) >> 8)
  );
}

/**
 * Finds the closest aesthetic fashion color name for a given RGB value
 */
export function getFashionColorName(r: number, g: number, b: number): { name: string; hex: string } {
  let closest = FASHION_PALETTE[0];
  let minDistance = Infinity;

  for (const item of FASHION_PALETTE) {
    const dist = getColorDistance(r, g, b, item.r, item.g, item.b);
    if (dist < minDistance) {
      minDistance = dist;
      closest = item;
    }
  }

  // If the color matches closely (< 40), use the curated fashion name
  // Otherwise, construct a smart dynamic label with closest hue
  const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;

  if (minDistance < 60) {
    return { name: closest.name, hex };
  }

  // Generate generic descriptive name based on HSL
  const { h, s, l } = rgbToHsl(r, g, b);
  let baseName = 'Shade';

  if (s < 0.12) {
    if (l < 0.2) baseName = 'Black';
    else if (l < 0.45) baseName = 'Charcoal Grey';
    else if (l < 0.75) baseName = 'Ash Grey';
    else baseName = 'Off-White';
  } else {
    if (h >= 345 || h < 15) baseName = l < 0.35 ? 'Maroon' : 'Red';
    else if (h >= 15 && h < 45) baseName = l < 0.4 ? 'Brown' : 'Rust / Orange';
    else if (h >= 45 && h < 70) baseName = l < 0.4 ? 'Olive' : 'Mustard';
    else if (h >= 70 && h < 160) baseName = l < 0.35 ? 'Forest Green' : 'Green';
    else if (h >= 160 && h < 260) baseName = l < 0.35 ? 'Navy Blue' : 'Blue';
    else if (h >= 260 && h < 315) baseName = 'Purple / Violet';
    else baseName = 'Rose Pink';
  }

  return { name: baseName, hex };
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h, s, l };
}

/**
 * Extracts dominant colors from an image element or URL using HTML Canvas pixel sampling.
 * Focuses on garment body (center ~70% of image), filters out pure white backdrops or transparent borders.
 */
export async function extractDominantColorsFromImage(
  imageSource: string,
  maxColors = 2
): Promise<DetectedColor[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve([]);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    // Handle data URL vs external link
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve([]);
          return;
        }

        // Downscale for fast & noise-free pixel sampling
        const width = 120;
        const height = 120;
        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        // Sample center 70% of image where garment usually sits
        const startX = Math.floor(width * 0.15);
        const endX = Math.floor(width * 0.85);
        const startY = Math.floor(height * 0.15);
        const endY = Math.floor(height * 0.85);
        const sampleW = endX - startX;
        const sampleH = endY - startY;

        const imgData = ctx.getImageData(startX, startY, sampleW, sampleH).data;

        // Bucket pixels by quantized RGB (step of 16)
        const colorBuckets = new Map<string, { r: number; g: number; b: number; count: number }>();
        let validPixels = 0;

        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          // Skip fully transparent
          if (a < 128) continue;

          // Skip near-pure studio background whites (> 248 on all channels)
          if (r > 248 && g > 248 && b > 248) continue;

          validPixels++;

          // Quantize to reduce noise
          const qr = Math.floor(r / 16) * 16;
          const qg = Math.floor(g / 16) * 16;
          const qb = Math.floor(b / 16) * 16;
          const key = `${qr},${qg},${qb}`;

          const existing = colorBuckets.get(key);
          if (existing) {
            existing.r = Math.round((existing.r * existing.count + r) / (existing.count + 1));
            existing.g = Math.round((existing.g * existing.count + g) / (existing.count + 1));
            existing.b = Math.round((existing.b * existing.count + b) / (existing.count + 1));
            existing.count += 1;
          } else {
            colorBuckets.set(key, { r, g, b, count: 1 });
          }
        }

        if (colorBuckets.size === 0) {
          // If all pixels were near white (e.g. pure white t-shirt)
          const fallback = getFashionColorName(245, 245, 245);
          resolve([{ name: 'Pure White', hex: '#FFFFFF', rgb: { r: 255, g: 255, b: 255 }, percentage: 100 }]);
          return;
        }

        // Sort buckets by frequency
        const sortedBuckets = Array.from(colorBuckets.values()).sort((a, b) => b.count - a.count);

        // Pick distinct top clusters
        const picked: { r: number; g: number; b: number; count: number }[] = [];

        for (const bucket of sortedBuckets) {
          const isTooClose = picked.some(
            (p) => getColorDistance(p.r, p.g, p.b, bucket.r, bucket.g, bucket.b) < 45
          );

          if (!isTooClose) {
            picked.push(bucket);
            if (picked.length >= maxColors) break;
          }
        }

        const results: DetectedColor[] = picked.map((p) => {
          const { name, hex } = getFashionColorName(p.r, p.g, p.b);
          return {
            name,
            hex,
            rgb: { r: p.r, g: p.g, b: p.b },
            percentage: Math.round((p.count / (validPixels || 1)) * 100)
          };
        });

        resolve(results);
      } catch (err) {
        console.warn('Canvas color extraction warning:', err);
        resolve([]);
      }
    };

    img.onerror = () => {
      resolve([]);
    };

    img.src = imageSource;
  });
}

/**
 * Extracts distinct dominant colors across multiple product images.
 * If 1 image is provided -> extracts top 1-2 garment colors.
 * If 3, 4, 5+ images are provided -> analyzes each image and combines distinct colors!
 */
export async function extractColorsFromMultipleImages(
  imageSources: string[]
): Promise<{ name: string; hex: string }[]> {
  if (!imageSources || imageSources.length === 0) return [];

  const allDetected: DetectedColor[] = [];

  for (const src of imageSources) {
    if (!src) continue;
    // For each image, get dominant 1 or 2 colors
    const colors = await extractDominantColorsFromImage(src, imageSources.length === 1 ? 2 : 1);
    allDetected.push(...colors);
  }

  // Deduplicate colors across all images (merge similar hues)
  const uniqueColors: { name: string; hex: string }[] = [];

  for (const col of allDetected) {
    const isDuplicate = uniqueColors.some((existing) => {
      // Check hex match or exact name match
      if (existing.hex.toLowerCase() === col.hex.toLowerCase()) return true;
      if (existing.name.toLowerCase() === col.name.toLowerCase()) return true;
      return false;
    });

    if (!isDuplicate) {
      uniqueColors.push({
        name: col.name,
        hex: col.hex
      });
    }
  }

  return uniqueColors;
}

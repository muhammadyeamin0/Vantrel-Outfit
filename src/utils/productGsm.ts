import { Product } from '../types';

const BENGALI_TO_ASCII_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9'
};

export function normalizeBengaliDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => BENGALI_TO_ASCII_DIGITS[d] || d);
}

const LEGACY_BOILERPLATE_FABRICS = new Set([
  '420 gsm 100% combed ringspun cotton french terry',
  '420 gsm 100% combed ringspun cotton',
  '420 gsm 100% cotton'
]);

function isValidGsmRange(rawNumber: string): boolean {
  const parts = rawNumber.split(/[–—\-]/).map((s) => Number(s.trim()));
  if (parts.some((n) => !Number.isFinite(n) || n < 80 || n > 900)) {
    return false;
  }
  if (parts.length === 2 && parts[1] < parts[0]) {
    return false;
  }
  return true;
}

function formatNormalizedGsm(rawNumber: string, hasPlus: boolean): string | null {
  const cleanedRange = rawNumber.replace(/\s*[–—\-]\s*/g, '–').trim();
  if (!isValidGsmRange(cleanedRange)) return null;
  const suffix = hasPlus && !cleanedRange.includes('–') ? '+' : '';
  return `${cleanedRange}${suffix} GSM`;
}

/**
 * Extracts a GSM specification string (e.g. "300 GSM", "200–230 GSM", "160+ GSM")
 * from product description, tagline, or title text (supports English & Bengali numerals/labels).
 */
export function extractGsmFromText(text?: string | null): string | null {
  if (!text || typeof text !== 'string') return null;
  const normalized = normalizeBengaliDigits(text);

  // Pattern 1: Label-first ("GSM: 200–230", "Gsm:-300", "Gsm 150+", "জিএসএমঃ ২৫০+ প্লাস জিএসএম")
  const labelFirstRegex =
    /(?:GSM|জিএসএম)\s*[:ঃ=\-–—]*\s*(\d{2,3}(?:\s*[–—\-]\s*\d{2,3})?)(\s*\+(?!\s*[-–—]))?/gi;
  for (const match of normalized.matchAll(labelFirstRegex)) {
    const formatted = formatNormalizedGsm(match[1], Boolean(match[2]));
    if (formatted) return formatted;
  }

  // Pattern 2: Value-first ("220 GSM", "290+ GSM", "320(+-)GSM", "300± GSM", "150 জিএসএম")
  const valueFirstRegex =
    /(\d{2,3}(?:\s*[–—\-]\s*\d{2,3})?)\s*(?:(\+)(?!\s*[-–—])|\(\s*[+±\-/]+\s*\)|[±]|\+-|-\+)?\s*(?:GSM(?![a-zA-Z0-9])|জিএসএম)/gi;
  for (const match of normalized.matchAll(valueFirstRegex)) {
    const formatted = formatNormalizedGsm(match[1], Boolean(match[2]));
    if (formatted) return formatted;
  }

  return null;
}

/**
 * Resolves the authoritative GSM display label (e.g. "300 GSM", "200–230 GSM", "160+ GSM")
 * strictly preferring whatever GSM is specified in the product description/tagline/name.
 * Returns null if no GSM is present and the stored gsm is just the legacy 420 boilerplate.
 */
export function resolveProductGsmLabel(
  product?: Partial<Pick<Product, 'name' | 'tagline' | 'description' | 'gsm' | 'fabric'>> | null
): string | null {
  if (!product) return null;

  const fromDesc =
    extractGsmFromText(product.description) ||
    extractGsmFromText(product.tagline) ||
    extractGsmFromText(product.name);
  if (fromDesc) return fromDesc;

  const numericGsm = typeof product.gsm === 'number' ? product.gsm : Number(product.gsm);
  if (Number.isFinite(numericGsm) && numericGsm >= 80 && numericGsm <= 900) {
    const rounded = Math.round(numericGsm);
    const fabricLower = (product.fabric || '').trim().toLowerCase();
    const isLegacyBoilerplate420 =
      rounded === 420 && (!fabricLower || LEGACY_BOILERPLATE_FABRICS.has(fabricLower));
    if (!isLegacyBoilerplate420) {
      return `${rounded} GSM`;
    }
  }

  return null;
}

export function resolveProductGsmNumber(
  product?: Partial<Pick<Product, 'name' | 'tagline' | 'description' | 'gsm' | 'fabric'>> | null
): number | undefined {
  const label = resolveProductGsmLabel(product);
  if (!label) return undefined;
  const match = label.match(/(\d{2,3})/);
  return match ? Number(match[1]) : undefined;
}

/**
 * Returns a clean fabric description without blindly stamping "420 GSM ... French Terry"
 * when the product doesn't actually use 420 GSM.
 */
export function resolveProductFabricLabel(
  product?: Partial<Pick<Product, 'name' | 'tagline' | 'description' | 'gsm' | 'fabric'>> | null
): string {
  if (!product) return '';
  const rawFabric = (product.fabric || '').trim();
  const resolvedGsm = resolveProductGsmLabel(product);

  if (rawFabric && !LEGACY_BOILERPLATE_FABRICS.has(rawFabric.toLowerCase())) {
    return rawFabric;
  }

  if (resolvedGsm === '420 GSM' && rawFabric) {
    return rawFabric;
  }

  // Try to read an explicit fabric note from description if present
  const desc = product.description || '';
  const fabricLineMatch = desc.match(
    /(?:^|\n)\s*(?:[✅✨•\-*]?\s*)?(?:Fabric(?:ation|s)?|Material|ফেব্রিক(?:স)?)\s*[:ঃ\-]+\s*([^\n।]+)/i
  );
  if (fabricLineMatch?.[1]) {
    const extracted = fabricLineMatch[1].trim().slice(0, 80);
    if (extracted && !/^\d{2,3}\s*(?:\(\s*[+±\-/]+\s*\))?\s*GSM$/i.test(extracted)) {
      return extracted;
    }
  }

  return resolvedGsm ? `${resolvedGsm} Premium Fabric` : 'Premium Quality Fabric';
}

/**
 * Build-time WCAG 2.2 contrast guardrails.
 *
 * The CMS lets a non-technical editor pick arbitrary colours. Rather than
 * shipping an inaccessible palette, we evaluate every foreground/background
 * pair at build time and (a) warn loudly in the build log, (b) substitute a
 * safe foreground so the rendered site never drops below 4.5:1 for body text.
 */

const AA_NORMAL = 4.5;
const AA_LARGE = 3;

/** @param {string} value */
export function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  let hex = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    hex = hex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return `#${hex.toLowerCase()}`;
}

/** @param {string} value */
export function toRgb(value) {
  const hex = normalizeHex(value);
  if (!hex) return null;
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

/** @param {number} channel 0-255 */
function linearize(channel) {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** @param {string} value hex colour */
export function relativeLuminance(value) {
  const rgb = toRgb(value);
  if (!rgb) return 0;
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}

/**
 * @param {string} foreground hex
 * @param {string} background hex
 * @returns {number} contrast ratio, 1–21
 */
export function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Pick whichever of black/white reads best on `background`.
 * @param {string} background hex
 */
export function bestForeground(background) {
  return contrastRatio('#ffffff', background) >= contrastRatio('#000000', background)
    ? '#ffffff'
    : '#000000';
}

/**
 * Enforce a minimum ratio, falling back to black/white when the editor's pick
 * fails. Returns the colour that should actually be rendered.
 *
 * @param {object} options
 * @param {string} options.foreground
 * @param {string} options.background
 * @param {string} options.label human-readable pair name for the build log
 * @param {boolean} [options.large] true for >=24px or >=18.66px bold text
 * @param {string[]} [options.warnings] collector for build warnings
 */
export function enforceContrast({ foreground, background, label, large = false, warnings }) {
  const min = large ? AA_LARGE : AA_NORMAL;
  const fg = normalizeHex(foreground);
  const bg = normalizeHex(background);

  if (!fg || !bg) {
    const fallback = bg ? bestForeground(bg) : '#ffffff';
    warnings?.push(`[contrast] ${label}: invalid colour value, falling back to ${fallback}.`);
    return fallback;
  }

  const ratio = contrastRatio(fg, bg);
  if (ratio >= min) return fg;

  const fallback = bestForeground(bg);
  warnings?.push(
    `[contrast] ${label}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1 (needs ${min}:1). ` +
      `Rendering ${fallback} instead — pick a higher-contrast colour in the CMS.`
  );
  return fallback;
}

/**
 * Media overlays are the only thing standing between an editor's bright photo
 * and unreadable text, so clamp the opacity to a floor.
 *
 * @param {unknown} value
 * @param {number} fallback
 */
export function clampOverlay(value, fallback = 0.65) {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(0.95, Math.max(0.45, n));
}

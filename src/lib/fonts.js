/**
 * Custom font file scanner and registry builder.
 *
 * Editors upload font files (`.woff2`, `.ttf`, `.otf`) to `public/media/`.
 * At build time, we scan that directory, validate files against the naming
 * convention, copy valid fonts to `public/fonts/<FamilyName>/`, and return
 * a registry for @font-face injection.
 *
 * Filename convention: `FontName_Style_Weight.ext`
 * - FontName: alphanumeric + hyphens (no spaces, no underscores)
 * - Style: `Regular` or `Italic`
 * - Weight: numeric (100, 300, 400, 600, 700, 800, 900)
 * - ext: `.woff2`, `.ttf`, `.otf`
 *
 * Examples:
 *   MyFont_Regular_400.woff2
 *   MyFont_Italic_700.woff2
 *   Brand-Font_Regular_400.ttf
 */

import fsp from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const MEDIA_FONTS_DIR = path.join(ROOT, 'public', 'media');
const FONTS_DIR = path.join(ROOT, 'public', 'fonts');

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_EXTENSIONS = new Set(['.woff2', '.ttf', '.otf']);

// Pattern: FontName_Style_Weight.ext
// FontName: alphanumeric + hyphens (no underscores, no spaces)
// Style: Regular or Italic
// Weight: numeric
const FILENAME_PATTERN = /^([a-z0-9-]+)_(Regular|Italic)_(\d+)$/i;

/**
 * Parse a font filename per the project convention.
 * @param {string} filename
 * @returns {{ family: string, style: 'normal' | 'italic', weight: number } | null}
 */
function parseFilename(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return null;

  const base = filename.slice(0, -ext.length);
  const match = base.match(FILENAME_PATTERN);
  if (!match) return null;

  const [, rawFamily, rawStyle, rawWeight] = match;
  const family = rawFamily.trim();
  if (!family) return null;

  // Reject anything that could escape the destination directory.
  if (/[\\/]/.test(family) || family.includes('..')) return null;

  const style = rawStyle.toLowerCase() === 'italic' ? 'italic' : 'normal';
  const weight = parseInt(rawWeight, 10);

  if (isNaN(weight)) return null;

  return { family, style, weight };
}

/**
 * Copy a single font file and add to registry.
 * @param {string} srcPath
 * @param {Map<string, FontFamily>} registry
 * @param {string[]} warnings
 */
async function processFile(srcPath, registry, warnings) {
  const filename = path.basename(srcPath);

  let stat;
  try {
    stat = await fsp.stat(srcPath);
  } catch (error) {
    warnings.push(`[fonts] ${filename}: cannot stat file (${error.message})`);
    return;
  }

  if (stat.size > MAX_FILE_SIZE) {
    const mb = (stat.size / 1024 / 1024).toFixed(1);
    warnings.push(`[fonts] ${filename}: file size ${mb} MB exceeds 20 MB limit — skipped`);
    return;
  }

  const parsed = parseFilename(filename);
  if (!parsed) {
    warnings.push(`[fonts] ${filename}: filename does not match pattern — skipped`);
    return;
  }

  const { family, style, weight } = parsed;
  const familyDir = path.join(FONTS_DIR, family);

  try {
    await fsp.mkdir(familyDir, { recursive: true });
    const destPath = path.join(familyDir, filename);
    await fsp.copyFile(srcPath, destPath);
  } catch (error) {
    warnings.push(`[fonts] ${filename}: failed to copy (${error.message})`);
    return;
  }

  // Add to registry
  if (!registry.has(family)) {
    registry.set(family, { files: [], weights: new Set() });
  }

  const fontFamily = registry.get(family);
  const previousFile = fontFamily.files.find(f => f.weight === weight && f.style === style);
  if (previousFile) {
    warnings.push(
      `[fonts] ${family}: duplicate weight ${weight}${style === 'italic' ? ' italic' : ''} — "${filename}" overrides previous`
    );
    fontFamily.files = fontFamily.files.filter(f => !(f.weight === weight && f.style === style));
  }

  fontFamily.files.push({
    path: `/fonts/${family}/${filename}`,
    weight,
    style,
  });
  fontFamily.weights.add(weight);

  console.log(
    `leadcard [fonts] ${filename} parsed as ${family} weight ${weight}${style === 'italic' ? ' italic' : ''}`
  );
}

/**
 * Scan `public/media/` for font files, copy valid ones to `public/fonts/`,
 * and return a registry of discovered custom font families.
 *
 * @param {string} [mediaDir] - Override media directory (for testing)
 * @param {string} [fontsDir] - Override fonts directory (for testing)
 * @param {string[]} [warnings] - Collect warnings (for testing)
 * @returns {Promise<Map<string, FontFamily>>}
 */
export async function buildCustomFontRegistry(
  mediaDir = MEDIA_FONTS_DIR,
  fontsDir = FONTS_DIR,
  warnings = []
) {
  const registry = new Map();

  let entries = [];
  try {
    entries = await fsp.readdir(mediaDir, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      warnings.push(`[fonts] failed to read ${mediaDir}: ${error.message}`);
    }
    return registry;
  }

  const fontFiles = entries
    .filter((entry) => entry.isFile() && ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => path.join(mediaDir, entry.name));

  for (const filePath of fontFiles) {
    await processFile(filePath, registry, warnings);
  }

  for (const warning of warnings) {
    console.warn(`leadcard ${warning}`);
  }

  return registry;
}

export default buildCustomFontRegistry;

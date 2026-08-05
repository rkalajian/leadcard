/**
 * Custom font ZIP scanning and registry builder.
 *
 * Editors upload font ZIPs via the Decap CMS media widget into
 * `public/media/fonts/`. At build time we scan that directory, extract each
 * ZIP, validate the contained files, and copy valid fonts into
 * `public/fonts/<FamilyName>/` (git-tracked, served as static assets).
 *
 * Filename convention: `FontName-(Regular|Bold|Italic|BoldItalic|Thin|Light|
 * SemiBold|ExtraBold).(woff2|ttf|otf)`. Files that do not match are skipped
 * with a warning. The returned registry is consumed by `site.js` to emit
 * `@font-face` rules and to decide which font names should be excluded from
 * the Google Fonts request.
 *
 * Everything here runs at build time only — the browser never sees this
 * module.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import unzipper from 'unzipper';

const ROOT = process.cwd();
const MEDIA_FONTS_DIR = path.join(ROOT, 'public', 'media', 'fonts');
const FONTS_DIR = path.join(ROOT, 'public', 'fonts');

const MAX_ZIP_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_EXTRACTED_BYTES = 50 * 1024 * 1024; // 50 MB

const ALLOWED_EXTENSIONS = new Set(['.woff2', '.ttf', '.otf']);

/** Suffix → CSS font-weight. "Italic" alone maps to regular (400) weight. */
const WEIGHT_MAP = {
  thin: 100,
  light: 300,
  regular: 400,
  italic: 400,
  semibold: 600,
  bold: 700,
  extrabold: 800,
};

/** Recognised filename suffixes, longest-first so "BoldItalic" wins over "Bold". */
const SUFFIX_PATTERN =
  /^(.+)-(BoldItalic|Regular|SemiBold|ExtraBold|Italic|Thin|Light|Bold)$/i;

/**
 * @typedef {{ path: string, weight: number, style: 'normal' | 'italic' }} FontFile
 * @typedef {{ files: FontFile[], weights: Set<number> }} FontFamily
 */

/**
 * Parse a font filename per the project convention.
 * @param {string} filename
 * @returns {{ family: string, weight: number, style: 'normal' | 'italic' } | null}
 */
function parseFilename(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return null;

  const base = filename.slice(0, -ext.length);
  const match = base.match(SUFFIX_PATTERN);
  if (!match) return null;

  const [, rawFamily, rawSuffix] = match;
  const family = rawFamily.trim();
  if (!family) return null;
  // Reject anything that could escape the destination directory.
  if (/[\\/]/.test(family) || family.includes('..')) return null;

  const suffix = rawSuffix.toLowerCase();
  const isItalic = suffix.includes('italic');
  const weightKey = suffix.replace('italic', '') || 'regular';
  const weight = WEIGHT_MAP[weightKey] ?? 400;

  return { family, weight, style: isItalic ? 'italic' : 'normal' };
}

/**
 * Extract and validate a single ZIP, writing valid font files into
 * `public/fonts/<family>/` and merging them into `registry`.
 * @param {string} zipPath
 * @param {Map<string, FontFamily>} registry
 * @param {string[]} warnings
 */
async function processZip(zipPath, registry, warnings) {
  const zipName = path.basename(zipPath);

  let stat;
  try {
    stat = await fsp.stat(zipPath);
  } catch (error) {
    warnings.push(`[fonts] ${zipName}: cannot stat file (${error.message})`);
    return;
  }

  if (stat.size > MAX_ZIP_BYTES) {
    const mb = (stat.size / 1024 / 1024).toFixed(1);
    warnings.push(`[fonts] ${zipName}: ZIP is ${mb} MB, exceeds 20 MB limit — skipped`);
    return;
  }

  let directory;
  try {
    directory = await unzipper.Open.file(zipPath);
  } catch (error) {
    warnings.push(`[fonts] ${zipName}: failed to open ZIP (${error.message}) — skipped`);
    return;
  }

  /** @type {Array<{ entry: any, filename: string, parsed: NonNullable<ReturnType<typeof parseFilename>> }>} */
  const candidates = [];
  let extractedTotal = 0;

  for (const entry of directory.files) {
    if (entry.type !== 'File') continue;

    const rawPath = entry.path ?? '';
    if (rawPath.includes('..') || path.isAbsolute(rawPath)) {
      warnings.push(`[fonts] ${zipName}: rejected entry with unsafe path "${rawPath}"`);
      continue;
    }

    const filename = path.basename(rawPath);
    const parsed = parseFilename(filename);
    if (!parsed) {
      warnings.push(`[fonts] ${zipName}: skipped invalid filename: ${filename}`);
      continue;
    }

    extractedTotal += entry.uncompressedSize ?? 0;
    candidates.push({ entry, filename, parsed });
  }

  if (extractedTotal > MAX_EXTRACTED_BYTES) {
    const mb = (extractedTotal / 1024 / 1024).toFixed(1);
    warnings.push(
      `[fonts] ${zipName}: extracted contents ${mb} MB exceed 50 MB limit — skipped`
    );
    return;
  }

  if (candidates.length === 0) {
    warnings.push(`[fonts] ${zipName}: no valid font files found — skipped`);
    return;
  }

  // A ZIP is expected to hold one family, but group defensively in case it
  // holds more than one.
  /** @type {Map<string, typeof candidates>} */
  const byFamily = new Map();
  for (const candidate of candidates) {
    const { family } = candidate.parsed;
    if (!byFamily.has(family)) byFamily.set(family, []);
    byFamily.get(family).push(candidate);
  }

  for (const [family, files] of byFamily) {
    const familyDir = path.join(FONTS_DIR, family);
    await fsp.mkdir(familyDir, { recursive: true });

    // Last file wins per weight/style — write every file to disk, but only
    // the final one per key survives into the registry.
    /** @type {Map<string, FontFile & { filename: string }>} */
    const fileByKey = new Map();

    for (const { entry, filename, parsed } of files) {
      const destPath = path.join(familyDir, filename);
      try {
        const content = await entry.buffer();
        await fsp.writeFile(destPath, content);
      } catch (error) {
        warnings.push(`[fonts] ${zipName}: failed to extract ${filename} (${error.message})`);
        continue;
      }

      const key = `${parsed.weight}-${parsed.style}`;
      const previous = fileByKey.get(key);
      if (previous) {
        warnings.push(
          `[fonts] ${family}: duplicate weight ${parsed.weight}${
            parsed.style === 'italic' ? ' italic' : ''
          } — "${filename}" overrides "${previous.filename}"`
        );
      }

      fileByKey.set(key, {
        path: `/fonts/${family}/${filename}`,
        weight: parsed.weight,
        style: parsed.style,
        filename,
      });

      console.log(
        `leadcard [fonts] ${filename} parsed as ${family} weight ${parsed.weight}${
          parsed.style === 'italic' ? ' italic' : ''
        }`
      );
    }

    if (fileByKey.size === 0) continue;

    const registeredFiles = [...fileByKey.values()].map(({ filename, ...rest }) => rest);
    const weights = new Set(registeredFiles.map((f) => f.weight));

    if (registry.has(family)) {
      warnings.push(`[fonts] duplicate family "${family}" across ZIPs — merging files`);
      const existing = registry.get(family);
      existing.files.push(...registeredFiles);
      for (const w of weights) existing.weights.add(w);
    } else {
      registry.set(family, { files: registeredFiles, weights });
    }
  }
}

/**
 * Scan `public/media/fonts/*.zip`, extract and validate each archive, copy
 * valid font files into `public/fonts/<family>/`, and return a registry of
 * discovered custom font families.
 *
 * @returns {Promise<Map<string, FontFamily>>}
 */
export async function buildCustomFontRegistry() {
  /** @type {Map<string, FontFamily>} */
  const registry = new Map();
  /** @type {string[]} */
  const warnings = [];

  let zipPaths = [];
  try {
    const entries = await fsp.readdir(MEDIA_FONTS_DIR, { withFileTypes: true });
    zipPaths = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.zip'))
      .map((entry) => path.join(MEDIA_FONTS_DIR, entry.name));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      warnings.push(`[fonts] failed to read ${MEDIA_FONTS_DIR}: ${error.message}`);
    }
    // No media/fonts directory yet — nothing to scan, not an error.
  }

  for (const zipPath of zipPaths) {
    await processZip(zipPath, registry, warnings);
  }

  for (const warning of warnings) {
    console.warn(`leadcard ${warning}`);
  }

  return registry;
}

export default buildCustomFontRegistry;

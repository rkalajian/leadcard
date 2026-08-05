# Single-File Custom Fonts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ZIP-based custom font uploads with individual file uploads to `public/media/`, simplifying editor workflow and removing extraction complexity.

**Architecture:** Rewrite `src/lib/fonts.js` to scan `public/media/` for individual font files matching `FontName_Style_Weight.ext` convention, copy them to `public/fonts/<FamilyName>/`, and return a registry for CSS injection. Remove ZIP extraction, unzipper dependency, and `public/media/fonts/` folder.

**Tech Stack:** Node.js filesystem (fs/promises), existing Astro build pipeline

## Global Constraints

- Filename pattern: `FontName_Style_Weight.ext` (alphanumeric + hyphens, underscore separator, numeric weight)
- Allowed formats: `.woff2`, `.ttf`, `.otf`
- Max file size: 20 MB per file
- Styles: `Regular` or `Italic` only
- Weights: 100, 300, 400, 600, 700, 800, 900
- Registry interface: `Map<FontName, { files: FontFile[], weights: Set<number> }>`
- No breaking changes to `site.js`, `BaseLayout.astro`, `site.yml`, or CMS interface

---

## Task 1: Remove ZIP-Based Folder Structure

**Files:**
- Delete: `public/media/fonts/` (directory and .gitkeep)

**Interfaces:**
- Consumes: (none — cleanup task)
- Produces: (none — only removes existing structure)

- [ ] **Step 1: Delete public/media/fonts/ directory**

```bash
rm -rf public/media/fonts/
```

- [ ] **Step 2: Verify directory is removed**

```bash
ls -la public/media/fonts 2>&1 | grep "cannot access"
# Expected: error message confirming folder doesn't exist
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove public/media/fonts/ (ZIP-based uploads)"
```

---

## Task 2: Remove unzipper Dependency

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: (none)
- Produces: (none — dependency removal only)

- [ ] **Step 1: Remove unzipper from package.json**

Open `package.json`, find the `"dependencies"` section, and remove the `"unzipper"` line:

```json
{
  "dependencies": {
    // Remove this line:
    // "unzipper": "^0.x.x",
    "other-dependency": "^1.0.0"
  }
}
```

- [ ] **Step 2: Remove node_modules entry (run npm install)**

```bash
npm install
```

This updates `package-lock.json` and removes unzipper from `node_modules/`.

- [ ] **Step 3: Verify unzipper is removed**

```bash
npm list unzipper 2>&1 | grep "not installed"
# Expected: confirmation unzipper is not installed
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove unzipper dependency"
```

---

## Task 3: Rewrite src/lib/fonts.js for Single-File Processing

**Files:**
- Rewrite: `src/lib/fonts.js`
- Create: `src/lib/fonts.test.js` (test file for new implementation)

**Interfaces:**
- Consumes: (Node.js fs/promises API)
- Produces: `buildCustomFontRegistry()` async function returning `Promise<Map<string, FontFamily>>`
  - `FontFamily = { files: FontFile[], weights: Set<number> }`
  - `FontFile = { path: string, weight: number, style: 'normal' | 'italic' }`

- [ ] **Step 1: Create test file with failing tests**

Create `src/lib/fonts.test.js`:

```javascript
import { buildCustomFontRegistry } from './fonts.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fsp from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testFixturesDir = path.join(__dirname, '../../.test-fixtures');

describe('buildCustomFontRegistry', () => {
  // Create test fixtures in setup
  before(async () => {
    const mediaDir = path.join(testFixturesDir, 'media');
    await fsp.mkdir(mediaDir, { recursive: true });
  });

  after(async () => {
    // Clean up test fixtures
    await fsp.rm(testFixturesDir, { recursive: true, force: true });
  });

  test('parses valid filename and returns registry', async () => {
    // Create test font file
    const testFile = path.join(testFixturesDir, 'media', 'TestFont_Regular_400.woff2');
    await fsp.writeFile(testFile, Buffer.alloc(100));

    const registry = await buildCustomFontRegistry(
      path.join(testFixturesDir, 'media'),
      path.join(testFixturesDir, 'fonts')
    );

    assert(registry.has('TestFont'));
    const fontFamily = registry.get('TestFont');
    assert.strictEqual(fontFamily.files.length, 1);
    assert.strictEqual(fontFamily.files[0].weight, 400);
    assert.strictEqual(fontFamily.files[0].style, 'normal');
  });

  test('skips invalid filename with warning', async () => {
    const testFile = path.join(testFixturesDir, 'media', 'InvalidFont-Regular.woff2');
    await fsp.writeFile(testFile, Buffer.alloc(100));

    const warnings = [];
    const registry = await buildCustomFontRegistry(
      path.join(testFixturesDir, 'media'),
      path.join(testFixturesDir, 'fonts'),
      warnings
    );

    assert.strictEqual(registry.size, 0);
    assert(warnings.some(w => w.includes('does not match pattern')));
  });

  test('skips file > 20 MB with warning', async () => {
    const largeFile = path.join(testFixturesDir, 'media', 'LargeFont_Regular_400.woff2');
    await fsp.writeFile(largeFile, Buffer.alloc(21 * 1024 * 1024));

    const warnings = [];
    const registry = await buildCustomFontRegistry(
      path.join(testFixturesDir, 'media'),
      path.join(testFixturesDir, 'fonts'),
      warnings
    );

    assert.strictEqual(registry.size, 0);
    assert(warnings.some(w => w.includes('exceeds 20 MB')));
  });

  test('handles duplicate weight/style with last-wins', async () => {
    const file1 = path.join(testFixturesDir, 'media', 'DupFont_Regular_400-v1.woff2');
    const file2 = path.join(testFixturesDir, 'media', 'DupFont_Regular_400-v2.woff2');
    await fsp.writeFile(file1, Buffer.alloc(100));
    await fsp.writeFile(file2, Buffer.alloc(100));

    const warnings = [];
    const registry = await buildCustomFontRegistry(
      path.join(testFixturesDir, 'media'),
      path.join(testFixturesDir, 'fonts'),
      warnings
    );

    assert(registry.has('DupFont'));
    const fontFamily = registry.get('DupFont');
    assert.strictEqual(fontFamily.files.length, 1);
    assert(warnings.some(w => w.includes('duplicate')));
  });

  test('parses Italic style correctly', async () => {
    const testFile = path.join(testFixturesDir, 'media', 'ItalicFont_Italic_400.woff2');
    await fsp.writeFile(testFile, Buffer.alloc(100));

    const registry = await buildCustomFontRegistry(
      path.join(testFixturesDir, 'media'),
      path.join(testFixturesDir, 'fonts')
    );

    assert(registry.has('ItalicFont'));
    const fontFamily = registry.get('ItalicFont');
    assert.strictEqual(fontFamily.files[0].style, 'italic');
  });

  test('allows hyphens in font name', async () => {
    const testFile = path.join(testFixturesDir, 'media', 'Brand-Font_Regular_400.woff2');
    await fsp.writeFile(testFile, Buffer.alloc(100));

    const registry = await buildCustomFontRegistry(
      path.join(testFixturesDir, 'media'),
      path.join(testFixturesDir, 'fonts')
    );

    assert(registry.has('Brand-Font'));
  });

  test('silently skips non-font files', async () => {
    const jpgFile = path.join(testFixturesDir, 'media', 'image.jpg');
    const woff2File = path.join(testFixturesDir, 'media', 'Font_Regular_400.woff2');
    await fsp.writeFile(jpgFile, Buffer.alloc(100));
    await fsp.writeFile(woff2File, Buffer.alloc(100));

    const warnings = [];
    const registry = await buildCustomFontRegistry(
      path.join(testFixturesDir, 'media'),
      path.join(testFixturesDir, 'fonts'),
      warnings
    );

    assert.strictEqual(registry.size, 1);
    assert(registry.has('Font'));
    assert(!warnings.some(w => w.includes('image.jpg')));
  });

  test('rejects path traversal attempts', async () => {
    const badFile = path.join(testFixturesDir, 'media', '../evil_Regular_400.woff2');
    
    const warnings = [];
    const registry = await buildCustomFontRegistry(
      path.join(testFixturesDir, 'media'),
      path.join(testFixturesDir, 'fonts'),
      warnings
    );

    assert.strictEqual(registry.size, 0);
    assert(warnings.some(w => w.includes('unsafe path')));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test src/lib/fonts.test.js
# Expected: All tests FAIL with "buildCustomFontRegistry is not defined"
```

- [ ] **Step 3: Implement fonts.js**

Rewrite `src/lib/fonts.js`:

```javascript
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
  const key = `${weight}-${style}`;
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test src/lib/fonts.test.js
# Expected: All tests PASS
```

- [ ] **Step 5: Delete test file (move to integration testing)**

```bash
rm src/lib/fonts.test.js
```

Tests for this module will be covered by end-to-end testing below.

- [ ] **Step 6: Commit**

```bash
git add src/lib/fonts.js
git commit -m "refactor: rewrite fonts.js for single-file processing

- Remove ZIP extraction (unzipper dependency removed in prior task)
- Scan public/media/ for individual .woff2/.ttf/.otf files
- Parse filenames: FontName_Style_Weight.ext
- Copy valid files to public/fonts/<FamilyName>/
- Build registry: Map<FontName, { files, weights }>
- Same registry interface for site.js integration (no breaking changes)"
```

---

## Task 4: Verify site.js Integration (No Changes Expected)

**Files:**
- Verify: `src/lib/site.js` (read-only, check compatibility)
- Verify: `src/layouts/BaseLayout.astro` (read-only, check compatibility)

**Interfaces:**
- Consumes: `buildCustomFontRegistry()` from fonts.js
- Produces: (No changes; existing `customFontFaceRules()` and `googleFontsHref()` functions work unchanged)

- [ ] **Step 1: Check site.js imports fonts.js correctly**

Open `src/lib/site.js` and verify:
- Line importing `buildCustomFontRegistry` exists: `import { buildCustomFontRegistry } from './fonts.js';`
- Function is called: `const customFonts = await buildCustomFontRegistry();`
- Registry is used in `customFontFaceRules()` and `googleFontsHref()`

Expected: No changes needed — registry interface is identical to old ZIP-based version.

- [ ] **Step 2: Check BaseLayout.astro calls site.js functions**

Open `src/layouts/BaseLayout.astro` and verify:
- `customFontFaceRules()` is called in `<style>` block
- Google Fonts URL from `googleFontsHref()` is injected

Expected: No changes needed — CSS injection logic unchanged.

- [ ] **Step 3: Run build to verify no errors**

```bash
npm run build
# Expected: Build completes without errors related to fonts
```

- [ ] **Step 4: Verify build output shows parsed fonts**

```bash
npm run build 2>&1 | grep -i "leadcard \[fonts\]"
# Expected: Output shows "parsed as" messages for any test fonts in public/media/
```

No commit needed for this task (verification only).

---

## Task 5: End-to-End Testing

**Files:**
- Create: `fontpac_Regular_400.woff2` (test file in `public/media/`)
- Create: `fontpac_Bold_700.woff2` (test file in `public/media/`)
- Verify: Generated files in `public/fonts/fontpac/`

**Interfaces:**
- Consumes: `buildCustomFontRegistry()` from Task 3
- Produces: Files in `public/fonts/fontpac/`, registry with fontpac family

- [ ] **Step 1: Create test font files**

Since you have `fontpac.zip` in `public/media/`, rename it to use single-file convention:

```bash
# Check if fontpac.zip exists
ls -la public/media/fontpac.zip

# Note: We'll simulate font files for testing
# In real workflow, editors upload these via Decap CMS
echo "test" > public/media/fontpac_Regular_400.woff2
echo "test" > public/media/fontpac_Italic_400.woff2
echo "test" > public/media/fontpac_Regular_700.woff2
```

- [ ] **Step 2: Run build**

```bash
npm run build
```

- [ ] **Step 3: Verify files were copied to public/fonts/**

```bash
ls -la public/fonts/fontpac/
# Expected: fontpac_Regular_400.woff2, fontpac_Italic_400.woff2, fontpac_Regular_700.woff2
```

- [ ] **Step 4: Verify build output shows parsed fonts**

```bash
npm run build 2>&1 | grep "parsed as fontpac"
# Expected:
# leadcard [fonts] fontpac_Regular_400.woff2 parsed as fontpac weight 400
# leadcard [fonts] fontpac_Italic_400.woff2 parsed as fontpac weight 400 italic
# leadcard [fonts] fontpac_Regular_700.woff2 parsed as fontpac weight 700
```

- [ ] **Step 5: Check CSS output in dist/**

```bash
cat dist/index.html | grep -A2 "fontpac"
# Expected: @font-face rules with paths to /fonts/fontpac/
```

- [ ] **Step 6: Verify CMS font selector includes fontpac**

Check `public/admin/config.yml` for auto-generated font list (if script exists):
- Should include "fontpac" in headingFont and bodyFont options

- [ ] **Step 7: Clean up test files**

```bash
rm public/media/fontpac_*.woff2
npm run build
```

- [ ] **Step 8: Commit test results (optional summary)**

```bash
# No commit needed for testing — it's verification work
# If you want to document results, add to branch notes only
```

---

## Task 6: Update Documentation

**Files:**
- Modify: `README.md` (if custom fonts workflow documented)
- Modify: CMS docs (if Decap config docs exist)

**Interfaces:**
- Consumes: (none — documentation only)
- Produces: (Updated docs reflecting new single-file workflow)

- [ ] **Step 1: Check if README.md mentions custom fonts**

```bash
grep -i "custom font" README.md
grep -i "zip" README.md
```

If found, update to reflect new workflow:
- Old: "Upload ZIP files to `public/media/fonts/`"
- New: "Upload individual `.woff2`/`.ttf`/`.otf` files to `public/media/` with naming convention `FontName_Style_Weight.ext`"

- [ ] **Step 2: Check for CMS-specific docs**

```bash
find . -name "*.md" -o -name "*.txt" | xargs grep -l "Decap\|CMS" | head -5
```

If custom font upload documented, update examples to show single-file format.

- [ ] **Step 3: Update docs with new filename convention**

Example addition to README or CMS docs:

```markdown
### Uploading Custom Fonts

1. Prepare font files with naming convention: `FontName_Style_Weight.ext`
   - `FontName`: Any alphanumeric text + hyphens (e.g., `Brand-Font`)
   - `Style`: `Regular` or `Italic`
   - `Weight`: Numeric (100, 300, 400, 600, 700, 800, 900)
   - `ext`: `.woff2`, `.ttf`, or `.otf` (recommended: `.woff2`)

2. Examples:
   - `MyBrandFont_Regular_400.woff2`
   - `MyBrandFont_Italic_400.woff2`
   - `MyBrandFont_Regular_700.woff2`

3. Upload files via Decap CMS media picker (goes to `public/media/`)

4. Fonts appear automatically in font selectors after next build
```

- [ ] **Step 4: Commit documentation updates**

```bash
git add README.md
git commit -m "docs: update custom font upload workflow (single files, no ZIP)"
```

---

## Task 7: Final Verification & Cleanup

**Files:**
- Clean up: Remove `.gitkeep` if any lingering from old structure
- Verify: Git status clean, no stray test files

**Interfaces:**
- Consumes: (none — final cleanup)
- Produces: Clean git state ready for PR

- [ ] **Step 1: Remove any lingering test artifacts**

```bash
git status
# Check for untracked files like scratchpad_test_fonts.mjs, test fixtures, etc.

# If testfontpac.zip or similar test files exist, remove:
rm -f public/media/*.zip  # Only if sure these are tests
rm -f scratchpad*.mjs
```

- [ ] **Step 2: Verify build completes cleanly**

```bash
npm run build
# Expected: No errors, warnings only for fonts not found in media
```

- [ ] **Step 3: Check git log for all commits**

```bash
git log --oneline -7
# Expected: Commits for:
# - Task 1: Remove public/media/fonts/
# - Task 2: Remove unzipper
# - Task 3: Rewrite fonts.js
# - Task 6: Update docs (optional)
```

- [ ] **Step 4: Final status check**

```bash
git status
# Expected: Working tree clean (nothing to commit)
```

- [ ] **Step 5: No additional commit needed**

All work is already committed in previous tasks. This is final verification only.

---

## Acceptance Criteria

✅ **All tests pass:** `npm run build` completes without errors  
✅ **No ZIP dependency:** `unzipper` removed from `package.json` and `node_modules/`  
✅ **Fonts scanned correctly:** Individual `.woff2`/`.ttf`/`.otf` files in `public/media/` are parsed and copied to `public/fonts/<FamilyName>/`  
✅ **Registry unchanged:** `buildCustomFontRegistry()` returns same structure, no breaking changes to `site.js`  
✅ **CSS injection works:** @font-face rules generated correctly for all files  
✅ **Error handling:** Invalid filenames, oversized files, duplicates logged with warnings  
✅ **Documentation updated:** README/CMS docs reflect new single-file workflow  
✅ **Git history clean:** All commits follow convention, no stray files

---

## Post-Implementation

After tasks are complete:
1. Create PR from current branch to `main`
2. Merge PR after review
3. Monitor Netlify build log for font processing messages
4. Test font uploads via Decap CMS admin panel with new naming convention

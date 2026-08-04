# Custom Font Upload Design

**Date:** 2026-08-04  
**Feature:** Allow editors to upload custom fonts (ZIP) via Decap CMS alongside Google Fonts  
**Status:** Design approved

---

## Overview

Currently, font selection is limited to a curated list of 25 Google Fonts. This feature adds support for uploading custom fonts as ZIP files through Decap CMS, allowing editors to use brand fonts or specialty typefaces while maintaining the existing Google Fonts fallback.

---

## Goals

- Editors can upload custom fonts via CMS media widget (zero code changes)
- Multiple font files per family supported (Regular, Bold, Italic, etc.)
- Custom fonts coexist with Google Fonts (site can mix both)
- Convention-based filename parsing (auto-detect weight/style)
- Files stored in version control (`public/fonts/`)
- Graceful degradation on missing/invalid fonts

---

## User Flow

1. **Editor opens Decap CMS** → Site content & design section
2. **Creates ZIP file** with convention-based filenames:
   ```
   MyBrandFont-Regular.woff2
   MyBrandFont-Bold.woff2
   MyBrandFont-BoldItalic.woff2
   ```
3. **Uploads ZIP** via CMS media picker (goes to `public/media/fonts/`)
4. **Site rebuilds** on Netlify (or `npm run build` locally)
5. **Font processor** extracts ZIP, validates, moves files to `public/fonts/MyBrandFont/`
6. **Custom font appears** in headingFont/bodyFont dropdowns in CMS
7. **Editor selects** "MyBrandFont" for heading, "Inter" (Google) for body
8. **Site uses both** without editor awareness of technical differences

---

## Technical Design

### Data Model

**`site.yml` (unchanged):**
```yaml
theme:
  headingFont: MyBrandFont      # Can be custom or Google
  bodyFont: Inter               # Can be custom or Google
```

Editor doesn't need to know which is which — system determines at build time.

### Directory Structure

```
public/
  fonts/                         # New directory
    MyBrandFont/
      MyBrandFont-Regular.woff2
      MyBrandFont-Bold.woff2
      MyBrandFont-BoldItalic.woff2
    AnotherFont/
      AnotherFont-Regular.ttf
      AnotherFont-Bold.ttf
  media/
    fonts/
      MyBrandFont.zip            # Editor uploads here
```

After build, `.zip` files remain in `public/media/fonts/` for next upload/replacement. Extracted files live permanently in `public/fonts/`.

### Build-Time Processing

**New module: `src/lib/fonts.js`**

```javascript
// Scan public/media/ for .zip files
// For each ZIP:
//   1. Extract to temp directory
//   2. Validate: only .woff2/.ttf/.otf allowed
//   3. Parse filenames → extract family name + weight/style
//   4. Move valid files to public/fonts/FamilyName/
//   5. Return font registry
// 
// Returns: Map<fontName, { files: [...], weights: [...] }>
```

**Filename Convention:**

Pattern: `FontName-(Weight|Style)?.(woff2|ttf|otf)`

Valid examples:
- `MyFont-Regular.woff2` → family: "MyFont", weight: 400
- `MyFont-Bold.woff2` → family: "MyFont", weight: 700
- `MyFont-Italic.woff2` → family: "MyFont", weight: 400, style: italic
- `MyFont-BoldItalic.woff2` → family: "MyFont", weight: 700, style: italic
- `MyFont-Thin.woff2` → family: "MyFont", weight: 100
- `MyFont-Light.woff2` → family: "MyFont", weight: 300
- `MyFont-SemiBold.woff2` → family: "MyFont", weight: 600
- `MyFont-ExtraBold.woff2` → family: "MyFont", weight: 800

Weight → CSS weight mapping:
- Regular/normal (no suffix): 400
- Thin: 100
- Light: 300
- Bold: 700
- SemiBold: 600
- ExtraBold: 800

Style detection: filenames with "Italic" → `font-style: italic`.

**Font Registry:**

`site.js` imports registry from fonts processor:
```javascript
const customFonts = await buildCustomFontRegistry(); // { MyBrandFont: {...}, ... }
```

Check if font is custom:
```javascript
const isCustom = customFonts.has(fontName);
if (!isCustom) {
  // Load from Google Fonts
}
```

### CSS & @font-face Injection

**New function in `site.js`: `customFontFaceRules()`**

Generates CSS for all custom fonts in registry:

```css
@font-face {
  font-family: 'MyBrandFont';
  src: url('/fonts/MyBrandFont/MyBrandFont-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'MyBrandFont';
  src: url('/fonts/MyBrandFont/MyBrandFont-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
}
@font-face {
  font-family: 'MyBrandFont';
  src: url('/fonts/MyBrandFont/MyBrandFont-BoldItalic.woff2') format('woff2');
  font-weight: 700;
  font-style: italic;
}
```

**Injected in `BaseLayout.astro`:**
```astro
<style is:inline>
:root {
  ${cssVars}
}

${customFontFaceRules()}
</style>
```

Placed before Google Fonts `<link>` so custom fonts take precedence if naming collision occurs.

### Google Fonts Integration

Existing `googleFontsHref()` unchanged, but:
- Filters out custom fonts from URL (only Google Fonts in URL)
- If site uses only custom fonts, function returns `null` → no Google Fonts `<link>` injected
- If site mixes (e.g., custom heading + Google body), only Google font in URL

**Example:**
```javascript
// If headingFont: "MyBrandFont" (custom), bodyFont: "Inter" (Google)
// googleFontsHref() returns: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
```

### Font Stack Building

`fontStack()` function unchanged:
```javascript
function fontStack(font, fallback) {
  const quoted = /[^a-z0-9-]/i.test(font) ? `'${font.replace(/'/g, '')}'` : font;
  return `${quoted}, ${fallback}`;
}
```

Custom fonts quoted like any multi-word font: `'MyBrandFont', system-ui, ...`

---

## Error Handling

### ZIP Validation

| Condition | Action |
|-----------|--------|
| ZIP > 20 MB | Warn, skip |
| Extracted files total > 50 MB | Warn, skip |
| File type not .woff2/.ttf/.otf | Warn, skip file |
| ZIP contains non-font files | Warn, skip non-font files |
| Empty ZIP or no valid files | Warn, skip quietly |
| Extraction fails (corrupt ZIP) | Warn, skip |

### Filename Parsing

| Condition | Action |
|-----------|--------|
| No valid files match pattern | Warn, skip family |
| Weight unrecognized | Use 400 (regular) |
| Duplicate weight for family | Last file wins (log warning) |
| Path traversal attempt (`../`) | Reject, warn |

### Font Name Collision

If custom font shares name with Google Font:
- Custom font wins
- Warning logged: `[fonts] custom font 'Inter' overrides Google Fonts`

### Build-Time Reporting

All warnings printed to build output so editor sees them in Decap/Netlify deploy logs:
```
leadcard [fonts] skipped invalid filename: config.json
leadcard [fonts] custom font 'Inter' overrides Google Fonts
leadcard [fonts] MyBrandFont-Regular.woff2 parsed as MyBrandFont weight 400
```

---

## Constraints & Limits

- ZIP file size: max 20 MB (warning)
- Extracted files total: max 50 MB (warning)
- Custom fonts stored in git (version control friendly)
- Recommended: woff2 only (smallest, modern browsers only) — but ttf/otf accepted for compatibility
- Maximum fonts per family: no hard limit (typical: 4-6 files)
- Font naming: follows convention; non-conforming files skipped

---

## CMS Configuration

**`public/admin/config.yml` font selectors:**

Currently static list of 25 Google Fonts. After this feature:
- Move to build-time generation
- Script generates config with Google Fonts + discovered custom fonts
- Selector options auto-updated when new font uploaded
- Deployment rebuilds CMS config before publishing

(Implementation detail: may need to pre-generate during build, or fetch from API)

---

## Testing Checklist

- Upload ZIP with multiple files → files extracted, CMS shows font
- Upload ZIP with invalid filename → warning logged, invalid files skipped
- Upload ZIP > 20 MB → warning logged, ZIP skipped
- Upload ZIP with .jpg file mixed in → .jpg skipped, fonts extracted
- Filename with unrecognized weight → defaults to 400
- Custom font same name as Google Font → custom wins, warning logged
- Delete custom font from `public/fonts/` → disappears from CMS on next build
- Site using only custom fonts → no Google Fonts URL injected
- Site mixing custom + Google → both work, correct @font-face and Google URL
- Font stack fallback works if custom font missing

---

## Future Enhancements (Out of Scope)

- UI upload drag-drop in CMS (currently media picker only)
- Font subsetting (reduce file size)
- Variable fonts (.woff2 variable)
- CDN for custom fonts (currently git-versioned only)
- Font preview in CMS editor
- Automatic WOFF2 conversion from TTF/OTF

---

## Files Changed

1. **New:** `src/lib/fonts.js` — Font processor, ZIP extraction, registry
2. **Modified:** `src/lib/site.js` — Import custom fonts, generate @font-face rules, filter Google Fonts
3. **Modified:** `src/layouts/BaseLayout.astro` — Inject @font-face rules
4. **Modified:** `public/admin/config.yml` — Font selectors (manual or generated)
5. **New:** `public/fonts/` — Storage for extracted font files (git-tracked)

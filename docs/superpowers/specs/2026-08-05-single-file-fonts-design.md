# Single-File Custom Font Upload Design

**Date:** 2026-08-05  
**Feature:** Replace ZIP-based custom font uploads with individual file uploads to `public/media/`  
**Status:** Design approved

---

## Overview

Simplify the custom font workflow by removing ZIP extraction complexity. Editors now upload individual font files (`.woff2`, `.ttf`, `.otf`) directly to `public/media/`. At build time, the system scans for files matching a filename convention, copies them to `public/fonts/<FamilyName>/`, and builds a registry for CSS injection.

---

## Goals

- Eliminate ZIP upload/extraction complexity
- Simpler editor workflow (direct file upload)
- Cleaner codebase (no ZIP dependency in fonts.js)
- Faster builds (no extraction overhead)
- Same end result: custom fonts coexist with Google Fonts

---

## User Flow

1. **Editor opens Decap CMS** → Site content & design section
2. **Uploads individual font files** to media picker (goes to `public/media/`)
   - Files must match: `FontName_Style_Weight.ext`
   - Example: `MyBrandFont_Regular_400.woff2`, `MyBrandFont_Italic_700.woff2`
3. **Site rebuilds** on Netlify (or `npm run build` locally)
4. **Font scanner** finds fonts in `public/media/`, copies to `public/fonts/MyBrandFont/`
5. **Custom font appears** in headingFont/bodyFont dropdowns
6. **Editor selects** "MyBrandFont" (no difference from Google Fonts in CMS)
7. **Site uses both** — custom fonts via @font-face, Google Fonts via URL

---

## Filename Convention

**Pattern:** `FontName_Style_Weight.ext`

- **FontName:** Any alphanumeric + hyphens (no spaces, no underscores)
- **Style:** `Regular` or `Italic` only
- **Weight:** Numeric only (100, 300, 400, 600, 700, 800, 900)
- **ext:** `.woff2`, `.ttf`, or `.otf`

**Valid examples:**
```
MyFont_Regular_400.woff2
MyFont_Regular_700.woff2
MyFont_Italic_400.ttf
MyFont_Italic_700.woff2
Brand-Font_Regular_400.woff2     ← hyphens in name OK
```

**Invalid (skipped with warning):**
```
MyFont-Regular.woff2             ← uses dash, should be underscore + weight
MyFont_Bold_700.woff2            ← Bold not allowed, weight only
MyFont_400.woff2                 ← missing Style
MyFont.woff2                     ← missing Style and Weight
MyFont_Regular_bold.woff2        ← weight not numeric
```

---

## Directory Structure

```
public/
  media/
    MyFont_Regular_400.woff2    ← Uploaded by editor
    MyFont_Regular_700.woff2
    MyFont_Italic_400.woff2
    MyFont_Italic_700.woff2
    (other media assets)
    
  fonts/
    MyFont/
      MyFont_Regular_400.woff2  ← Copied at build time
      MyFont_Regular_700.woff2
      MyFont_Italic_400.woff2
      MyFont_Italic_700.woff2
```

**Behavior:**
- Source files stay in `public/media/` (persisted for editor reference, future re-uploads)
- Copies are made to `public/fonts/` for static serving
- `public/media/fonts/` folder removed entirely (no longer needed)

---

## Build-Time Processing

### Scanner Module: `src/lib/fonts.js` (rewritten)

**Export:** `buildCustomFontRegistry()`

**Algorithm:**

1. Read `public/media/` directory
2. Filter for `.woff2`, `.ttf`, `.otf` files (ignore others)
3. For each file:
   - Parse filename: extract FontName, Style, Weight
   - Validate: Weight is numeric, FontName has no path traversal attempts
   - Check file size (max 20 MB per file)
   - Copy to `public/fonts/FontName/` (create directory if needed)
   - Add to registry

4. Return registry: `Map<FontName, { files: FontFile[], weights: Set<number> }>`

**FontFile structure:**
```javascript
{
  path: '/fonts/MyFont/MyFont_Regular_400.woff2',
  weight: 400,
  style: 'normal'  // or 'italic'
}
```

### Integration: `src/lib/site.js` (unchanged)

Existing code already handles registry:
- Import registry from fonts.js
- `customFontFaceRules()` generates @font-face for all registered files
- `googleFontsHref()` filters out custom font names

### CSS Injection: `src/layouts/BaseLayout.astro` (unchanged)

Existing `<style>` block injects @font-face rules before Google Fonts link.

---

## Error Handling

| Condition | Action |
|-----------|--------|
| File > 20 MB | Warn, skip file |
| Filename doesn't match pattern | Warn, skip file |
| Weight not numeric | Warn, skip file |
| Duplicate weight/style for family | Last file wins, warning logged |
| Path traversal attempt (`../`) | Reject, warn |
| `.jpg`, `.png`, etc. in media/ | Silently skip (not a font) |

**Build Output:**
```
leadcard [fonts] MyFont_Regular_400.woff2 parsed as MyFont weight 400
leadcard [fonts] MyFont_Italic_700.woff2 parsed as MyFont weight 700 italic
leadcard [fonts] Invalid_File.woff2: filename does not match pattern — skipped
leadcard [fonts] large-font.woff2: file size 25 MB exceeds 20 MB limit — skipped
leadcard [fonts] MyFont: duplicate weight 700 — "MyFont_Italic_700.woff2" overrides previous
```

---

## CMS Configuration

`public/admin/config.yml` font selectors auto-generated at build time:
- Build script scans registry and generates config options
- All available fonts (custom + Google) listed together
- No manual config after upload
- Each rebuild updates selector with new custom fonts

---

## site.yml (unchanged)

```yaml
theme:
  headingFont: MyFont      # Custom font, resolved at build time
  bodyFont: Inter          # Google Font, same interface
```

Editor doesn't need to know which is custom vs. Google — system determines automatically.

---

## CSS Output Example

Generated @font-face for `MyFont`:

```css
@font-face {
  font-family: 'MyFont';
  src: url('/fonts/MyFont/MyFont_Regular_400.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: 'MyFont';
  src: url('/fonts/MyFont/MyFont_Regular_700.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
}

@font-face {
  font-family: 'MyFont';
  src: url('/fonts/MyFont/MyFont_Italic_400.woff2') format('woff2');
  font-weight: 400;
  font-style: italic;
}

@font-face {
  font-family: 'MyFont';
  src: url('/fonts/MyFont/MyFont_Italic_700.woff2') format('woff2');
  font-weight: 700;
  font-style: italic;
}
```

Injected in `BaseLayout.astro` before Google Fonts link.

---

## Constraints & Limits

- File size: max 20 MB per file (warning)
- Allowed formats: `.woff2`, `.ttf`, `.otf`
- Recommended: `.woff2` only (smallest, modern browsers)
- Font naming: alphanumeric + hyphens, no spaces/underscores
- Style: `Regular` or `Italic` only
- Weight: 100, 300, 400, 600, 700, 800, 900

---

## Migration from ZIP-Based

**Old system:** Editors upload ZIPs to `public/media/fonts/`
**New system:** Editors upload `.woff2`/`.ttf`/`.otf` files to `public/media/`

**Migration steps:**
1. Delete `public/media/fonts/` folder and `.gitkeep`
2. Rewrite `src/lib/fonts.js` for single-file processing
3. Remove `unzipper` dependency from `package.json`
4. Update Decap CMS documentation (if any)

**No breaking changes to:**
- `site.yml` (font names work same way)
- `site.js` (registry interface unchanged)
- `BaseLayout.astro` (CSS injection unchanged)
- CMS UI (font selectors auto-update)

---

## Testing Checklist

- [ ] Upload `.woff2` file to `public/media/` → copied to `public/fonts/FontName/`, registered
- [ ] Upload `.ttf` and `.otf` files → both processed correctly
- [ ] Invalid filename (no weight, wrong separator) → warning logged, skipped
- [ ] File > 20 MB → warning logged, skipped
- [ ] Duplicate weight/style for family → last wins, warning
- [ ] Non-font file in `public/media/` (`.jpg`, `.png`) → silently skipped
- [ ] CMS font selector shows custom + Google fonts
- [ ] Site uses custom font (correct @font-face rule applied)
- [ ] Site using only custom fonts → no Google Fonts URL injected
- [ ] Mix custom + Google → both work, correct CSS and URLs
- [ ] Font stack fallback if custom font missing
- [ ] Build output shows parsed fonts with weights/styles

---

## Files Changed

1. **Rewrite:** `src/lib/fonts.js` — Scanner for individual files (no ZIP extraction)
2. **Delete:** `public/media/fonts/` — Folder removed
3. **Modify:** `package.json` — Remove `unzipper` dependency
4. **Keep:** `src/lib/site.js` — No changes needed
5. **Keep:** `src/layouts/BaseLayout.astro` — No changes needed
6. **Keep:** `public/admin/config.yml` — Font selectors (auto-generated at build)

---

## Future Enhancements (Out of Scope)

- Variable fonts (`.woff2` variable)
- Automatic WOFF2 conversion from TTF/OTF
- Font subsetting (reduce file size)
- UI preview of fonts in CMS
- Drag-drop upload in CMS (currently media picker only)

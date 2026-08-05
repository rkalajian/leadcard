# Google Fonts CMS Selector — Design Spec

**Date:** 2026-08-04  
**Status:** Design phase  
**Scope:** Add curated Google Fonts dropdown to Decap CMS for heading and body font selection

## Problem

Currently, editors must type font family names directly into `site.yml` to change fonts. This requires:
- Knowledge of exact font names
- Knowing fonts are available on Google Fonts
- Risk of typos or unavailable fonts

## Solution

Add select fields to Decap CMS schema with a curated list of 25 popular Google Fonts. Editors pick from dropdown instead of typing.

## Design

### 1. Curated Font List

25 Google Fonts, alphabetically sorted. Mix of serif, sans-serif, display:

```
- Abril Fatface
- DM Sans
- Figtree
- Fira Sans
- IBM Plex Sans
- Inconsolata
- Inter (current default)
- JetBrains Mono
- Lato
- Lexend
- Libre Franklin
- Merriweather
- Montserrat
- Nunito
- Open Sans
- Outfit
- Playfair Display
- Poppins
- Raleway
- Roboto
- Source Sans Pro
- Space Mono
- Ubuntu
- Urbanist
- Work Sans
```

**Rationale:** All fonts work as both heading and body text. Mix includes:
- Neutral sans-serifs (Open Sans, Roboto, Lato, Nunito) — safe defaults
- Modern, geometric fonts (DM Sans, Poppins, Raleway, Outfit) — trendy choices
- System-like fonts (Inter, Ubuntu, Work Sans, Figtree) — clean, readable
- Display fonts (Playfair Display, Abril Fatface) — for bold headings
- Serif fonts (Merriweather) — traditional, elegant option
- Monospace options (JetBrains Mono, Space Mono, Inconsolata) — if editors want mono

### 2. CMS Schema Change

**File:** `admin/config.yml`  
**Change:** Update theme section to add select fields

**Before:**
```yaml
- name: headingFont
  label: Heading Font
  widget: string
  default: Inter
```

**After:**
```yaml
- name: headingFont
  label: Heading Font
  widget: select
  options:
    - Inter
    - Open Sans
    - Roboto
    - ... (full list)
  default: Inter
```

Same for `bodyFont` field.

### 3. Site Build (No Changes)

Existing `src/lib/site.js` already handles:
- Reading `theme.headingFont` and `theme.bodyFont` from parsed YAML
- Validating they're non-empty strings
- Building Google Fonts URL via `googleFontsHref()` with weights 400/500/600/700
- Setting CSS custom properties (`--font-heading`, `--font-body`)
- Tailwind uses these via tailwind.config.mjs

No code changes required.

### 4. Data Flow

```
[CMS Editor]
    ↓ (picks font from dropdown)
[site.yml: theme.headingFont, theme.bodyFont]
    ↓ (build time)
[src/lib/site.js loads YAML]
    ↓
[googleFontsHref() builds URL]
    ↓
[CSS custom properties set]
    ↓
[Page renders with selected fonts]
```

## Implementation Scope

**In Scope:**
- Add curated font list to `admin/config.yml`
- Update headingFont and bodyFont fields to select widgets
- Test in CMS UI

**Out of Scope:**
- Font weight/style customization (fixed at 400/500/600/700)
- Live preview in CMS
- Fetching from Google Fonts API (curated list is static)
- Font fallback strategy changes (system-ui stack stays unchanged)

## Success Criteria

- [ ] CMS schema updated with select fields for heading and body fonts
- [ ] All 25 curated fonts load correctly in dropdown
- [ ] Selecting a font and saving site.yml works
- [ ] Build process generates correct Google Fonts URL
- [ ] Selected font displays on live site
- [ ] Default (Inter) still works

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Curated list becomes outdated | List is small enough (25 fonts) to review annually. Docs can suggest updating as needed. |
| Editor picks unsupported font via direct YAML edit | Won't happen — schema enforces select field. If they bypass (YAML edit), font still loads from Google Fonts if it exists. |
| Font doesn't load | Google Fonts API returns 200 + font-face rules regardless. Worst case: font fails silently, fallback stack applies. |

## Dependencies

- Decap CMS config file (`admin/config.yml`) exists and is editable
- Google Fonts API remains available (no control, acceptable risk)

## Acceptance Criteria

When this feature ships:
1. Editors see heading/body font fields as dropdowns in CMS, not text inputs
2. Can save site with any curated font selected
3. Selected fonts load and render on published site
4. No JavaScript errors or console warnings

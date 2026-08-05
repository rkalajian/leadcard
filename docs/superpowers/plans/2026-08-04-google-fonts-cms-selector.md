# Google Fonts CMS Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the curated Google Fonts list in the Decap CMS schema from 10 fonts to 25, giving editors a better selection of fonts for heading and body text.

**Architecture:** Modify the existing CMS configuration file (`public/admin/config.yml`) to update the font options for `theme.headingFont` and `theme.bodyFont` select fields. No code changes needed — existing `src/lib/site.js` already handles loading fonts from CMS config.

**Tech Stack:** Decap CMS (YAML config), Google Fonts API (fonts loaded at runtime by existing code)

## Global Constraints

- CMS schema file: `public/admin/config.yml` (Decap YAML config)
- Font list must be alphabetically sorted (25 fonts from spec)
- Both headingFont and bodyFont fields use same curated list
- Default for headingFont: Inter (existing default)
- Default for bodyFont: Inter (existing default)
- No code changes to `src/lib/site.js` or Tailwind config — only CMS schema update

---

## File Structure

**Files to modify:**
- `public/admin/config.yml` — Update font options for headingFont and bodyFont fields (lines 88-116)

**Files unchanged:**
- `src/lib/site.js` — Already handles loading fonts from CMS; no changes
- `src/layouts/BaseLayout.astro` — Already loads Google Fonts URL; no changes
- `tailwind.config.mjs` — Already uses font custom properties; no changes

---

## Task 1: Expand headingFont font list

**Files:**
- Modify: `public/admin/config.yml:88-101`

**Interfaces:**
- Consumes: Current headingFont select field (10 options)
- Produces: headingFont select field with 25 alphabetically-sorted options matching spec

**Steps:**

- [ ] **Step 1: Understand current config**

Current headingFont options (lines 88-101):
```yaml
- name: headingFont
  label: Heading font
  widget: select
  default: Sora
  options:
    - Inter
    - Sora
    - Manrope
    - Poppins
    - Montserrat
    - Playfair Display
    - Merriweather
    - Source Serif 4
    - Space Grotesk
    - DM Sans
```

Note: Default is currently "Sora" but spec says it should be "Inter". Will fix in this step.

- [ ] **Step 2: Replace headingFont options with full curated list**

Replace lines 88-101 with:

```yaml
- name: headingFont
  label: Heading font
  widget: select
  default: Inter
  options:
    - Abril Fatface
    - DM Sans
    - Figtree
    - Fira Sans
    - IBM Plex Sans
    - Inconsolata
    - Inter
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

Why: Spec defines these 25 fonts. Alphabetically sorted. Changed default from "Sora" to "Inter" to match spec.

- [ ] **Step 3: Verify syntax**

In editor, check YAML indentation matches existing config style (2-space indent). Verify:
- All fonts are strings (no special formatting)
- `default: Inter` is present
- `widget: select` is present
- No typos in font names

- [ ] **Step 4: Commit**

```bash
git add public/admin/config.yml
git commit -m "feat: expand headingFont curated list to 25 fonts"
```

---

## Task 2: Expand bodyFont font list

**Files:**
- Modify: `public/admin/config.yml:103-117`

**Interfaces:**
- Consumes: Current bodyFont select field (10 options)
- Produces: bodyFont select field with 25 alphabetically-sorted options matching spec

**Steps:**

- [ ] **Step 1: Understand current config**

Current bodyFont options (lines 103-117):
```yaml
- name: bodyFont
  label: Body font
  widget: select
  default: Inter
  options:
    - Inter
    - Sora
    - Manrope
    - Poppins
    - Montserrat
    - Merriweather
    - Source Serif 4
    - Space Grotesk
    - DM Sans
    - Nunito Sans
```

Note: Default is "Inter" (correct). Options list has "Nunito Sans" but spec has "Nunito" (no "Sans").

- [ ] **Step 2: Replace bodyFont options with full curated list**

Replace lines 103-117 with:

```yaml
- name: bodyFont
  label: Body font
  widget: select
  default: Inter
  options:
    - Abril Fatface
    - DM Sans
    - Figtree
    - Fira Sans
    - IBM Plex Sans
    - Inconsolata
    - Inter
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

Why: Spec defines these 25 fonts. Alphabetically sorted. Same list as headingFont since all fonts work for both purposes.

- [ ] **Step 3: Verify syntax**

In editor, check YAML indentation matches existing config style (2-space indent). Verify:
- All fonts are strings (no special formatting)
- `default: Inter` is present
- `widget: select` is present
- No typos in font names
- Matches headingFont list exactly

- [ ] **Step 4: Commit**

```bash
git add public/admin/config.yml
git commit -m "feat: expand bodyFont curated list to 25 fonts"
```

---

## Task 3: Test CMS UI with new font options

**Files:**
- Test: Browser testing of Decap CMS interface
- No file modifications

**Interfaces:**
- Consumes: Updated `public/admin/config.yml` from Tasks 1-2
- Produces: Verification that CMS UI shows all 25 fonts in dropdowns

**Steps:**

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Wait for server to start (typically 10-15 seconds). You should see output like:
```
🚀 Astro dev server running at http://localhost:3000
```

- [ ] **Step 2: Open CMS in browser**

Navigate to: `http://localhost:3000/admin/`

Log in if prompted (local backend mode should skip auth).

- [ ] **Step 3: Open Site Settings**

In the CMS interface:
1. Click on "Site" collection in the left sidebar
2. Click on "Site content & design" to open the settings

- [ ] **Step 4: Verify headingFont dropdown**

In the "Colours & fonts" section:
1. Locate "Heading font" field
2. Click the dropdown
3. Verify all 25 fonts appear in alphabetical order
4. Verify "Inter" is the default (shown initially)
5. Scroll through dropdown to spot-check fonts: should see "Abril Fatface", "Poppins", "Work Sans", etc.

Expected: Dropdown should show all 25 font options alphabetically.

- [ ] **Step 5: Verify bodyFont dropdown**

In the "Colours & fonts" section:
1. Locate "Body font" field
2. Click the dropdown
3. Verify all 25 fonts appear in alphabetical order
4. Verify "Inter" is the default (shown initially)
5. Scroll through dropdown to verify it matches headingFont list

Expected: Dropdown should show all 25 font options alphabetically, identical to headingFont.

- [ ] **Step 6: Test selecting a different font**

1. In headingFont dropdown, select "Playfair Display"
2. In bodyFont dropdown, select "Merriweather"
3. Click "Save" (or Cmd/Ctrl+S)
4. Verify no errors appear in CMS UI

Expected: Changes should save without error.

---

## Task 4: Verify fonts render on live site

**Files:**
- Test: Browser testing of rendered site
- No file modifications

**Interfaces:**
- Consumes: Updated `site.yml` (from Task 3 save) and CSS/fonts from build
- Produces: Verification that selected fonts load and render correctly

**Steps:**

- [ ] **Step 1: Rebuild site**

After saving fonts in Task 3, the dev server should auto-rebuild. Check terminal output for:
```
[content collection] Updated your collection!
```

If needed, restart the dev server:
```bash
npm run dev
```

- [ ] **Step 2: Open site in browser**

Navigate to: `http://localhost:3000/`

- [ ] **Step 3: Inspect Network tab for Google Fonts URL**

1. Open browser DevTools (F12 / Cmd+Option+I)
2. Go to "Network" tab
3. Reload the page (Cmd/Ctrl+R)
4. Search for "fonts.googleapis.com"
5. You should see a request like:
   ```
   fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Merriweather:wght@400;500;600;700&display=swap
   ```

Expected: Both fonts should appear in the URL with weights 400, 500, 600, 700.

- [ ] **Step 4: Verify fonts applied to page**

1. In DevTools, go to "Elements/Inspector" tab
2. Inspect the heading (Panel 1 title)
3. In the Styles panel, find the font-family rule
4. Verify it shows "Playfair Display" (or whichever font you selected)
5. Inspect body text (panel text content)
6. Verify font-family shows "Merriweather" (or whichever font you selected)

Expected: Fonts should match what you selected in the CMS.

- [ ] **Step 5: Visually verify fonts render correctly**

On the rendered site:
1. Headings should visibly display in Playfair Display (serif, elegant)
2. Body text should visibly display in Merriweather (serif, readable)
3. Text should be readable (no font-loading issues like invisible text)
4. No console errors related to font loading

Expected: Fonts should be visually distinct from the default Inter and render smoothly.

- [ ] **Step 6: Test reverting to default fonts**

1. Go back to CMS at `http://localhost:3000/admin/`
2. Change headingFont to "Inter"
3. Change bodyFont to "Inter"
4. Save
5. Return to site and verify it reverts to the default look

Expected: Site should revert to all-Inter appearance.

---

## Task 5: Final verification and commit

**Files:**
- Verify: `public/admin/config.yml` (no changes in this task, only verification)
- Verify: `src/data/site.yml` (contains saved font selections)

**Interfaces:**
- Consumes: Updated CMS config and test results from Tasks 1-4
- Produces: Final commit marking feature complete

**Steps:**

- [ ] **Step 1: Verify git status**

```bash
git status
```

Expected output should show:
```
On branch feat/google-fonts
Changes not staged for commit:
  modified:   public/admin/config.yml
  modified:   src/data/site.yml (if you changed fonts in CMS during testing)
```

- [ ] **Step 2: Review config changes**

```bash
git diff public/admin/config.yml
```

Verify:
- headingFont options expanded from ~10 to 25 fonts
- bodyFont options expanded from ~10 to 25 fonts
- Both lists match the spec (alphabetically sorted)
- Defaults are "Inter"
- No syntax errors (proper YAML indentation)

- [ ] **Step 3: Reset site.yml to defaults (if you tested with different fonts)**

If you changed fonts during testing and want to ship with defaults:

```bash
git checkout src/data/site.yml
```

Or manually edit it back to:
```yaml
theme:
  headingFont: Inter
  bodyFont: Inter
  # ... rest of config
```

- [ ] **Step 4: Stage and commit**

```bash
git add public/admin/config.yml
git commit -m "feat: add curated Google Fonts list to CMS

- Expand headingFont options from 10 to 25 popular Google Fonts
- Expand bodyFont options from 10 to 25 popular Google Fonts
- Both lists include sans-serif, serif, display, and monospace fonts
- Fonts are alphabetically sorted for easy CMS navigation
- Defaults remain Inter for both heading and body text
- No code changes to site.js or font loading — existing infrastructure handles it

Tested in CMS UI and verified fonts load/render correctly on site."
```

- [ ] **Step 5: Verify commit**

```bash
git log --oneline -1
```

Should show your commit at the top.

---

## Success Criteria

After all tasks complete:

✅ CMS schema (`public/admin/config.yml`) has 25 fonts for both headingFont and bodyFont  
✅ All 25 fonts are alphabetically sorted  
✅ Fonts match spec exactly: Abril Fatface through Work Sans  
✅ CMS UI displays both dropdowns with all 25 options  
✅ Selecting any font saves to `site.yml` without error  
✅ Selected fonts load from Google Fonts API  
✅ Fonts render visually on the live site  
✅ No console errors or warnings  
✅ Default fonts (Inter) still work  
✅ Changes committed to `feat/google-fonts` branch  

---

## Testing Checklist

- [ ] Dev server running (`npm run dev`)
- [ ] CMS accessible at `http://localhost:3000/admin/`
- [ ] Both font dropdowns show all 25 fonts
- [ ] Fonts can be selected and saved without error
- [ ] Site renders at `http://localhost:3000/` with selected fonts
- [ ] Google Fonts URL appears in Network tab with correct fonts
- [ ] Fonts display visually on page
- [ ] No errors in browser console
- [ ] Changes committed

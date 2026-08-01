/**
 * Build-time loader for the Decap CMS `site` singleton.
 *
 * `src/data/site.yml` is the single source of truth for copy,
 * colours, fonts, analytics IDs and background media. Everything here runs at
 * build time only — the browser never sees this module.
 */
import yaml from 'js-yaml';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

import { clampOverlay, enforceContrast, normalizeHex, relativeLuminance } from './contrast.js';

// Resolved by Vite, so it works identically in `astro dev` and `astro build`
// and gives us hot-reload when an editor saves site.yml locally.
const rawFiles = /** @type {Record<string, string>} */ (
  import.meta.glob('../data/site.yml', {
    query: '?raw',
    import: 'default',
    eager: true,
  })
);

const RAW = Object.values(rawFiles)[0] ?? '';

const DEFAULT_THEME = {
  headingFont: 'Inter',
  bodyFont: 'Inter',
  colorBg: '#0B1120',
  colorSurface: '#151E33',
  colorText: '#F4F7FF',
  colorMuted: '#C3CCE4',
  colorPrimary: '#2563EB',
  colorPrimaryText: '#FFFFFF',
  colorAccent: '#7DD3FC',
  overlayOpacity: 0.68,
};

/** Netlify Forms needs a stable, code-owned form name. Not CMS-editable. */
export const FORM_NAME = 'panel-1-lead';

/** Honeypot input name, referenced by both the markup and `netlify-honeypot`. */
export const HONEYPOT_NAME = 'bot-field';

const ALLOWED_INPUT_TYPES = new Set(['text', 'email', 'tel', 'url', 'number', 'textarea']);

const SANITIZE_OPTIONS = {
  allowedTags: [
    'p',
    'br',
    'strong',
    'em',
    'b',
    'i',
    'ul',
    'ol',
    'li',
    'a',
    'blockquote',
    'h3',
    'h4',
    'code',
    'span',
  ],
  allowedAttributes: {
    a: ['href', 'title'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  // Editor-authored links leaving the site should not hand over window.opener.
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href ?? '';
      const external = /^https?:\/\//i.test(href);
      return {
        tagName,
        attribs: external
          ? { ...attribs, rel: 'noopener noreferrer', target: '_blank' }
          : attribs,
      };
    },
  },
};

/**
 * @param {unknown} value
 * @returns {string} sanitized HTML
 */
function renderMarkdown(value) {
  if (typeof value !== 'string' || value.trim() === '') return '';
  const html = marked.parse(value, { async: false, breaks: false, gfm: true });
  return sanitizeHtml(String(html), SANITIZE_OPTIONS).trim();
}

/** @param {unknown} value */
function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}

/** @param {unknown} value */
function bool(value, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Analytics IDs are dropped straight into a script tag, so validate their
 * shape rather than trusting CMS input.
 * @param {unknown} value
 * @param {RegExp} pattern
 */
function analyticsId(value, pattern) {
  const raw = text(value);
  if (!raw) return '';
  return pattern.test(raw) ? raw : '';
}

/** @param {string} font */
function fontStack(font, fallback) {
  const family = text(font, fallback);
  const quoted = /[^a-z0-9-]/i.test(family) ? `'${family.replace(/'/g, '')}'` : family;
  return `${quoted}, ${fallback}`;
}

/** @param {unknown} value */
function mediaPath(value) {
  const raw = text(value);
  if (!raw) return '';
  // Only same-origin absolute paths — blocks javascript:/data: and keeps the
  // page self-hosted so it survives a strict CSP.
  if (!raw.startsWith('/') || raw.startsWith('//')) return '';
  return raw;
}

function buildTheme(input, warnings) {
  const t = { ...DEFAULT_THEME, ...(input ?? {}) };

  const bg = normalizeHex(t.colorBg) ?? DEFAULT_THEME.colorBg;
  const surface = normalizeHex(t.colorSurface) ?? DEFAULT_THEME.colorSurface;

  const textColor = enforceContrast({
    foreground: t.colorText,
    background: surface,
    label: 'body text on panel surface',
    warnings,
  });
  const muted = enforceContrast({
    foreground: t.colorMuted,
    background: surface,
    label: 'muted text on panel surface',
    warnings,
  });
  const primary = normalizeHex(t.colorPrimary) ?? DEFAULT_THEME.colorPrimary;
  const primaryText = enforceContrast({
    foreground: t.colorPrimaryText,
    background: primary,
    label: 'button label on primary colour',
    warnings,
  });
  const accent = enforceContrast({
    foreground: t.colorAccent,
    background: surface,
    label: 'accent/eyebrow text on panel surface',
    warnings,
  });

  // Focus rings must be visible against the surface they sit on (WCAG 2.2
  // 2.4.11 / 1.4.11). Fall back to whichever pole contrasts hardest.
  const focus = enforceContrast({
    foreground: accent,
    background: surface,
    label: 'focus ring on panel surface',
    large: true,
    warnings,
  });

  const surfaceIsDark = relativeLuminance(surface) < 0.4;

  return {
    headingFont: text(t.headingFont, DEFAULT_THEME.headingFont),
    bodyFont: text(t.bodyFont, DEFAULT_THEME.bodyFont),
    headingStack: fontStack(t.headingFont, 'system-ui, -apple-system, Segoe UI, sans-serif'),
    bodyStack: fontStack(t.bodyFont, 'system-ui, -apple-system, Segoe UI, sans-serif'),
    colorBg: bg,
    colorSurface: surface,
    colorText: textColor,
    colorMuted: muted,
    colorPrimary: primary,
    colorPrimaryText: primaryText,
    colorAccent: accent,
    colorFocus: focus,
    colorHairline: surfaceIsDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.16)',
    overlayOpacity: clampOverlay(t.overlayOpacity, DEFAULT_THEME.overlayOpacity),
    // Overlay ink is what guarantees text stays legible over arbitrary media.
    overlayColor: surfaceIsDark ? '#000000' : '#ffffff',
  };
}

function buildFields(input) {
  const list = Array.isArray(input) ? input : [];
  const fields = list
    .map((raw, index) => {
      const name = text(raw?.name).replace(/[^a-z0-9_-]/gi, '');
      if (!name || name === HONEYPOT_NAME || name === 'form-name') return null;
      const type = ALLOWED_INPUT_TYPES.has(text(raw?.type)) ? text(raw?.type) : 'text';
      return {
        name,
        id: `field-${name}`,
        label: text(raw?.label, name),
        type,
        multiline: type === 'textarea',
        required: bool(raw?.required, index === 0),
        autocomplete: text(raw?.autocomplete),
        placeholder: text(raw?.placeholder),
      };
    })
    .filter(Boolean);

  // Never ship a lead form with nothing to submit.
  if (fields.length === 0) {
    return [
      {
        name: 'name',
        id: 'field-name',
        label: 'Full name',
        type: 'text',
        multiline: false,
        required: true,
        autocomplete: 'name',
        placeholder: '',
      },
      {
        name: 'email',
        id: 'field-email',
        label: 'Email address',
        type: 'email',
        multiline: false,
        required: true,
        autocomplete: 'email',
        placeholder: '',
      },
    ];
  }
  return fields;
}

function buildBackground(input, theme, warnings, panelLabel) {
  const raw = input ?? {};
  const declared = text(raw.type, 'none');
  const image = mediaPath(raw.image);
  const video = mediaPath(raw.video);
  const poster = mediaPath(raw.poster) || image;

  let type = declared;
  if (type === 'video' && !video) {
    warnings?.push(`[media] ${panelLabel}: type is "video" but no video file is set.`);
    type = poster ? 'image' : 'none';
  }
  if (type === 'image' && !image) {
    type = 'none';
  }

  if (type === 'video' && !poster) {
    warnings?.push(
      `[media] ${panelLabel}: video has no poster. Reduced-motion visitors will see a flat colour.`
    );
  }

  return {
    type,
    image,
    video,
    poster,
    // Decorative by default: an empty alt keeps screen readers out of the
    // background layer unless the editor deliberately describes it.
    alt: text(raw.alt),
    focalPoint: ['top', 'center', 'bottom'].includes(text(raw.focalPoint))
      ? text(raw.focalPoint)
      : 'center',
    overlayOpacity: clampOverlay(raw.overlayOpacity, theme.overlayOpacity),
    overlayColor: theme.overlayColor,
  };
}

function buildPanels(input, theme, warnings) {
  const list = Array.isArray(input) ? input.slice(0, 3) : [];
  const panels = list.map((raw, index) => {
    const key = text(raw?.key, `panel-${index + 1}`).replace(/[^a-z0-9-]/gi, '') || `panel-${index + 1}`;
    const label = `panel ${index + 1}`;
    const ctaHref = text(raw?.ctaHref);
    return {
      key,
      index,
      number: index + 1,
      panelId: `${key}-region`,
      headerId: `${key}-header`,
      eyebrow: text(raw?.eyebrow),
      title: text(raw?.title, `Panel ${index + 1}`),
      bodyHtml: renderMarkdown(raw?.body),
      showForm: bool(raw?.showForm, index === 0),
      ctaLabel: text(raw?.ctaLabel),
      ctaHref: /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(ctaHref) ? ctaHref : '',
      background: buildBackground(raw?.background, theme, warnings, label),
    };
  });

  if (panels.length === 0) {
    warnings?.push('[content] No panels defined in site.yml — rendering an empty page.');
  }
  // Exactly one panel owns the lead form; the first one that asks for it wins.
  let formSeen = false;
  for (const panel of panels) {
    if (panel.showForm && !formSeen) {
      formSeen = true;
    } else {
      panel.showForm = false;
    }
  }
  if (!formSeen && panels.length > 0) panels[0].showForm = true;

  return panels;
}

function load() {
  /** @type {string[]} */
  const warnings = [];

  let parsed = {};
  try {
    parsed = /** @type {Record<string, any>} */ (yaml.load(RAW) ?? {});
  } catch (error) {
    warnings.push(`[content] site.yml failed to parse: ${(error && error.message) || error}`);
    parsed = {};
  }

  const theme = buildTheme(parsed.theme, warnings);
  const panels = buildPanels(parsed.panels, theme, warnings);
  const brand = parsed.brand ?? {};
  const formInput = parsed.form ?? {};
  const footer = parsed.footer ?? {};

  const site = {
    brand: {
      // BCP 47 shape only, so a typo cannot produce an invalid <html lang>.
      lang: /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(text(brand.lang))
        ? text(brand.lang)
        : 'en',
      siteTitle: text(brand.siteTitle, 'Untitled site'),
      headline: text(brand.headline, text(brand.siteTitle, 'Untitled site')),
      subheadline: text(brand.subheadline),
      metaDescription: text(brand.metaDescription),
      logo: mediaPath(brand.logo),
      logoAlt: text(brand.logoAlt),
    },
    theme,
    analytics: {
      // G-XXXXXXX / GTM-XXXXXX only; anything else is dropped rather than
      // injected into a script tag.
      ga4Id: analyticsId(parsed.analytics?.ga4Id, /^G-[A-Z0-9]{4,20}$/i),
      gtmId: analyticsId(parsed.analytics?.gtmId, /^GTM-[A-Z0-9]{4,20}$/i),
    },
    form: {
      name: FORM_NAME,
      honeypot: HONEYPOT_NAME,
      submitLabel: text(formInput.submitLabel, 'Send'),
      helpText: text(formInput.helpText),
      requiredNote: text(formInput.requiredNote, 'Fields marked with an asterisk are required.'),
      successHeading: text(formInput.successHeading, 'Thanks — we got it.'),
      successBody: text(formInput.successBody, 'We will be in touch shortly.'),
      fields: buildFields(formInput.fields),
    },
    panels,
    footer: {
      legalName: text(footer.legalName),
      phone: text(footer.phone),
      email: text(footer.email),
      privacyUrl: text(footer.privacyUrl),
      note: text(footer.note),
    },
    warnings,
  };

  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.warn(`leadcard ${warning}`);
    }
  }

  return site;
}

export const site = load();

/**
 * Google Fonts URL for the two configured families. Returns null when both
 * resolve to a system stack we do not need to fetch.
 */
export function googleFontsHref() {
  const families = [...new Set([site.theme.headingFont, site.theme.bodyFont])]
    .filter((f) => f && !/^system(-ui)?$/i.test(f))
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700`);
  if (families.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}

/** CSS custom properties consumed by tailwind.config.mjs and global.css. */
export function themeCssVariables() {
  const t = site.theme;
  return [
    `--font-heading: ${t.headingStack};`,
    `--font-body: ${t.bodyStack};`,
    `--color-bg: ${t.colorBg};`,
    `--color-surface: ${t.colorSurface};`,
    `--color-text: ${t.colorText};`,
    `--color-muted: ${t.colorMuted};`,
    `--color-primary: ${t.colorPrimary};`,
    `--color-primary-text: ${t.colorPrimaryText};`,
    `--color-accent: ${t.colorAccent};`,
    `--color-focus: ${t.colorFocus};`,
    `--color-hairline: ${t.colorHairline};`,
    `--overlay-color: ${t.overlayColor};`,
    `--overlay-opacity: ${t.overlayOpacity};`,
  ].join('\n    ');
}

export default site;

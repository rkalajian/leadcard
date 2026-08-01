# leadcard

A three-panel mobile microsite template. One page, three stacked accordion
panels, a lead form in the first one. Everything a client sees — copy, colours,
fonts, background media, form fields, analytics IDs — is edited through a CMS,
so a new client site needs zero code changes.

**Stack:** Astro (static output) · Tailwind CSS · Decap CMS (Netlify Identity +
Git Gateway) · Netlify Forms.

---

## How it works

```
src/data/site.yml        <- the ONLY file an editor ever changes
        |
        v
src/lib/site.js          <- reads + validates it at build time
        |                   (contrast guardrails, markdown sanitising,
        |                    analytics-ID pattern checks)
        v
src/pages/index.astro    <- renders the page
        |
        v
dist/                    <- plain static HTML, deployed to Netlify
```

`public/admin/` is the Decap CMS app. When an editor saves, Decap commits the
new `src/data/site.yml` to this repo through Git Gateway, Netlify rebuilds, and
the site updates. No database, no server, no build step the client has to think
about.

---

## Local development

```bash
npm install
npm run dev          # http://localhost:4321
```

Editing `src/data/site.yml` hot-reloads the page.

To run the CMS locally without a Netlify deploy, open a second terminal:

```bash
npm run cms:proxy    # decap-server on :8081
```

then visit **<http://127.0.0.1:4321/admin/index.html>**. `local_backend: true`
in `public/admin/config.yml` makes the CMS write to your working copy instead of
Git. It is ignored on any non-localhost host, so it is safe to leave enabled.

> Note the `index.html` and the `127.0.0.1`. Astro's dev server serves files
> from `public/` verbatim and does not resolve `/admin/` to `/admin/index.html`.
> On Netlify it does, so the deployed URL is just `/admin/`.

Other scripts:

| Script            | What it does                          |
| ----------------- | ------------------------------------- |
| `npm run build`   | Static build into `dist/`             |
| `npm run preview` | Serve the built `dist/` locally       |

---

## Setting up a new client site

1. **Create the repo.** Use this repo as a GitHub template (or clone and push to
   a fresh repo). One repo per client — content lives in the repo, so client
   content must never be shared.
2. **Create the Netlify site** from that repo. `netlify.toml` already sets the
   build command (`npm run build`) and publish directory (`dist`).
3. **Enable Identity.** Netlify dashboard → *Site configuration → Identity →
   Enable Identity*. Then under *Registration preferences* choose
   **Invite only**. Do not leave it open — open registration would let anyone
   request an account that can edit the site.
4. **Enable Git Gateway.** *Identity → Services → Git Gateway → Enable*. This is
   what lets the CMS commit without the client having a GitHub account.
5. **Set the branch.** If the repo's default branch is not `main`, update
   `backend.branch` in `public/admin/config.yml` to match.
6. **Invite the client.** *Identity → Invite users*. They get an email, set a
   password, and land on `/admin/`.
7. **Hand over the content.** Replace `src/data/site.yml` defaults and the
   placeholder images in `public/media/` — or just let the client do it in the
   CMS.

### Netlify Forms

Nothing to configure. The build emits a real `<form data-netlify="true">` into
`dist/index.html`; Netlify's post-processing finds it and registers the form
named `panel-1-lead`. Submissions land in *Forms → panel-1-lead*, and you can
add notification emails there.

The form uses a honeypot field (`bot-field`) for spam. If a site gets targeted,
add Netlify's reCAPTCHA on top from the Forms settings.

---

## Content model (`src/data/site.yml`)

| Section     | What it controls                                                              |
| ----------- | ----------------------------------------------------------------------------- |
| `brand`     | Page language, business name, headline, sub-headline, meta description, logo   |
| `theme`     | Heading/body font (curated Google Fonts), the seven palette colours, tint      |
| `analytics` | Optional GA4 measurement ID and/or GTM container ID                            |
| `form`      | Button and thank-you copy, plus the list of form fields                        |
| `panels`    | Up to three panels: title, body markdown, background media, call-to-action     |
| `footer`    | Legal name, phone, email, privacy link, small print                            |

Panels are rendered in order. The panel with `showForm: true` gets the lead form
(the first one wins if more than one is set; if none is set, panel 1 gets it).

Background media per panel is `none`, `image`, or `video`. Videos should always
have a `poster` — it is what reduced-motion visitors see.

---

## Accessibility

The template targets **WCAG 2.2 AA**, and the build actively defends it rather
than trusting whatever an editor types:

- **Contrast (1.4.3).** Every foreground/background pair in the palette is
  measured at build time (`src/lib/contrast.js`). Anything under 4.5:1 is
  replaced with black or white and a warning is printed in the build log. Panel
  backgrounds get a tint overlay whose opacity is clamped to a 0.45 floor, so
  text stays legible over any photo or video a client uploads.
- **Tap targets (2.5.8).** Every control is at least 44×44 CSS px — well past
  the 24×24 minimum.
- **Focus (2.4.11, 2.4.13).** A single 3px high-contrast focus ring, never
  removed without replacement. Nothing is sticky or fixed, so a focused element
  cannot be obscured.
- **Motion (2.3.3).** Under `prefers-reduced-motion: reduce` the accordion opens
  instantly, smooth scrolling is off, and background videos are never given a
  `src` at all — so the file is not even downloaded and the poster image stays.
- **Accordion semantics.** Real `<button>`s inside headings, with
  `aria-expanded` / `aria-controls`, and collapsed regions set to
  `visibility: hidden` so they leave both the tab order and the accessibility
  tree. Arrow/Home/End move between headers.
- **Forms (1.3.5, 3.3.2).** Every field has a visible `<label for>`, an
  `autocomplete` token where one applies, and native HTML5 validation. Required
  fields are marked with text — never colour alone.
- **Structure.** Skip link first in the tab order, one `<h1>`, `<html lang>`
  from the CMS, and no `maximum-scale` on the viewport so pinch zoom works.

Re-check after changing anything visual:

```bash
npm run build
npx --yes @axe-core/cli http://localhost:4321 --exit    # against npm run dev
npx --yes lighthouse http://localhost:4321 --only-categories=accessibility
```

### Things the build cannot check for you

- Alt text quality on client-uploaded images. Blank alt means "decorative" and
  hides the background layer from screen readers; that is the right default for
  a background, but if a client uploads an image that carries real information,
  it needs a real description.
- Background videos with no poster. The build warns, but it cannot invent one.
- Whether the client's copy actually reads well at 200% zoom.

---

## Project layout

```
public/
  admin/index.html     Decap CMS + Netlify Identity widget
  admin/config.yml     CMS field definitions (mirrors src/data/site.yml)
  media/               Uploaded and placeholder background media
  favicon.svg
src/
  components/
    Accordion.astro       Single-open state machine + keyboard support
    Panel.astro           Header button + collapsible region (ARIA wiring)
    BackgroundMedia.astro Image/video background, tint overlay, reduced motion
    PanelForm.astro       Netlify Forms lead form
    PanelInfo.astro       Sanitised markdown body + call-to-action
    Analytics.astro       Optional GA4 / GTM injection
  data/site.yml        CMS-managed content (the one file editors touch)
  layouts/BaseLayout.astro
  lib/site.js          Build-time loader, validation, sanitising
  lib/contrast.js      WCAG contrast maths and guardrails
  pages/index.astro
  styles/global.css
netlify.toml
```

> `src/data/` rather than `src/content/` is deliberate: `site.yml` is a single
> configuration document read synchronously at build time, not an Astro content
> collection. Keeping it out of `src/content/` avoids Astro auto-generating a
> collection for it.

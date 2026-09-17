# Steadyshield Legal — cinematic legal-brand website

> Justice. Precision. Protection.

A production-ready, cinematic single-page site for a fictional premium law brand.
Dark editorial design system, two cinematic intros — a drawn seal (title cards →
seal drawn and struck → doors part, seal lands in the hero) for daylight and
devices without WebGL, and a WebGL courtroom (gavel strike → particle shield) for
dark mode — a living hero seal (layered SVG in 3D: counter-turning bezels, light,
dust, scales that tap and settle; tilts with the pointer, turns away on scroll),
a persistent Three.js stage that reacts to scroll and pointer,
GSAP/ScrollTrigger scroll choreography, Lenis smooth scroll, a custom cursor with
magnetic buttons, and a fully-featured **static / reduced-motion experience** that
degrades gracefully with no JavaScript or no WebGL.

On top of that sits a **smart UI layer** (`smart.css` + `smart.js`, no dependencies):
a ⌘K command palette, a light "daylight" theme, live filtering and a detail
drawer for the practice areas, a three-question matter-triage tool, bookmarkable
insights, an FAQ accordion, animated counters, toasts, an action dock, a section
rail, and a contact form with inline validation and draft recovery.

---

## Run it

The site uses ES modules and an import map, so it must be served over HTTP (not
opened as a `file://`).

```bash
# any static server works — pick one
npx serve .
# or
python -m http.server 8080
# then open http://localhost:8080
```

No build step. No dependencies to install — Three.js, GSAP, ScrollTrigger and
Lenis load from CDN (jsDelivr) and are the only external requests besides Google
Fonts.

---

## File map

```
index.html              Semantic markup, SEO meta, JSON-LD (Organization +
                        LegalService + FAQPage), import map, script tags.
assets/css/main.css     Full design system + every section + responsive +
                        prefers-reduced-motion + no-JS / no-WebGL fallbacks.
                        Theme-sensitive surfaces are tokenised, and the light
                        ("daylight") palette lives here as [data-theme="light"].
assets/css/smart.css    Every smart-layer component: command palette, filter bars,
                        detail drawer, triage, metrics, FAQ, toasts, dock, rail,
                        consent bar, shortcuts sheet, smart-form states.
assets/js/main.js        Interaction layer (classic script). Lenis, ScrollTrigger
                        choreography, custom cursor, magnetic UI, nav + mobile
                        menu, intro orchestration, synthesised sound design,
                        section modules (courtroom pin, horizontal "Our Approach",
                        testimonials carousel, contact form).
assets/js/smart.js       Smart UI layer (classic script, zero dependencies).
                        Loads BEFORE main.js and sets window.__SMART__ so main.js
                        hands over the carousel and the contact form. Contains the
                        theme engine, command palette, practice filter + drawer,
                        matter triage, insights filter + bookmarks, FAQ, counters,
                        testimonial carousel, smart form, rail, dock, toasts,
                        consent bar, shortcuts sheet and the global key map.
assets/js/scene.js       WebGL layer (ES module). Cinematic intro renderer:
                        panelled courtroom (back wall, bench, sound block), a
                        warm overhead light shaft with drifting motes, a turned
                        walnut gavel with brass bands, the strike (flash +
                        shockwave + shake), then the dissolve into the shield. +
                        persistent stage renderer (dust halo behind the hero;
                        shield layers that assemble in "Our Approach" and open
                        in the finale). Device-aware quality tiers. The hero's
                        emblem is the SVG seal in index.html, driven by
                        initHeroSeal() in main.js.
assets/img/             Placeholder shield icons + OG image (regenerate for prod).
robots.txt · sitemap.xml · site.webmanifest
```

### How the two script layers talk

`main.js` runs first, detects capability, and writes `window.__SS`
(`{ prefersReduced, coarse, quality, useWebGL, soundOn, lenis, audio }`).
`scene.js` reads that object and dispatches DOM events the interaction layer
listens for:

| event | fired by | effect |
|---|---|---|
| `ss:gavel-impact` | scene.js · main.js (seal strike) | shockwave + wordmark reveal + gavel sound |
| `ss:intro-complete` | scene.js · main.js (seal) | dismiss intro overlay, unlock scroll, refresh ScrollTrigger |
| `ss:intro-skip` | main.js (skip button) | fast-forwards the intro timeline |
| `ss:stage-live` | scene.js | fades in the `#stage` canvas |
| `ss:approach` | main.js | `{progress}` drives the 5-layer shield assembly |
| `ss:finale-enter` / `ss:finale-leave` | main.js | drives the shield "opening" |

Which intro plays is decided in `<head>` (`html[data-intro="seal"|"court"]`) and
confirmed by `main.js`; it plays once per tab (add `?intro` to the URL to replay).

If the WebGL module never signals (CDN blocked, GPU disabled), `main.js` runs a
CSS-only intro after a 3.2 s safety timeout and the `.stage-fallback` gradient
covers the background.

---

## The smart UI layer

Everything below is in `assets/js/smart.js` + `assets/css/smart.css`. No build
step and no libraries — it runs even if the GSAP/Three CDN is blocked.

| Feature | Where | Notes |
|---|---|---|
| **Command palette** | `⌘K` / `Ctrl+K` / `/`, or the nav search button | Fuzzy search over sections, practice areas, insights, FAQ questions and actions. Ranks on the best-scoring field, so a literal hit in a practice area's tags beats a loose match elsewhere. Full keyboard nav, `role="combobox"` + `listbox`. |
| **Reading mode** | Nav toggle, or `T` | `data-theme="light"` on `<html>`. Warm paper ground, deep ink type; the WebGL stage stands down. Resolved before first paint by an inline script, persisted to `localStorage`, follows the OS until the visitor chooses. The courtroom, finale and footer stay dark as deliberate inverted islands. |
| **Practice filter** | `#practice` toolbar | Live token search across titles, summaries, tags *and* the drawer copy, plus category chips with live counts and an empty state. Filtering uses strict token matching — fuzzy is right for a palette and far too loose for a filter. |
| **Detail drawer** | Click any practice panel | Modal `<aside>` with focus trap, `Esc` to close, `←`/`→` to walk the areas, and an "Enquire about this" button that pre-fills the contact form's matter type. |
| **Matter triage** | `#triage` | Three weighted questions → ranked practice areas. Answers are held as a history so **Back** is lossless. Nothing leaves the browser. |
| **Insights** | `#insights` toolbar | Category chips, live search, and per-visitor bookmarks in `localStorage` with a "Saved" filter. |
| **FAQ accordion** | `#faq` | Single-open, `grid-template-rows` animation, `aria-expanded` + `aria-controls`. The FAQPage JSON-LD is kept in step with the visible copy. |
| **Counters** | `#trust` | IntersectionObserver, eased count-up, and the final value is already in the HTML so the no-JS render is correct. |
| **Testimonials** | `#testimonials` | Autoplay with a visible per-slide progress fill, dots, drag/swipe, arrow keys, and pause on hover/focus/tab-hidden. |
| **Smart form** | `#contact` | Per-field rules with inline errors, a completion meter, a character counter, matter-specific guidance, draft autosave/restore, and a submitting state. |
| **Action dock** | bottom-right | Back-to-top with a scroll-progress ring, shortcuts, consultation, and it adopts the persistent sound toggle once the intro completes. |
| **Section rail** | right edge | Scroll-spy dots built from every `[data-cmdk-section]`, with hover labels. |
| **Toasts / consent / shortcuts** | global | Toast host with actions, a storage-consent bar, and a `?` shortcuts sheet. |

### Keyboard map

`⌘K`/`Ctrl+K` or `/` palette · `T` theme · `C` contact · `G` top · `?` shortcuts ·
`Esc` closes any layer. Modifier and typing contexts are excluded.

### How the two script layers cooperate

`smart.js` is loaded **before** `main.js` and sets `window.__SMART__ = true`
synchronously. `main.js` checks that flag and skips its own `initQuotes()` /
`initForm()`, which `smart.js` supersedes. `smart.js` does its own work on
`DOMContentLoaded`, by which point `main.js` has published `window.__SS`, so it
can honour the same `prefersReduced` / `coarse` / Lenis decisions.

## Performance & accessibility notes

- **Quality tiers** (`main.js`): `high` (desktop), `medium` (tablet / small
  viewport → DPR 1, fewer particles, no antialias), `low` (coarse pointer + ≤4
  cores, or ≤3 GB RAM, or <560 px → **WebGL disabled**, CSS gradient background).
- `prefers-reduced-motion: reduce` → intro skipped, WebGL disabled, Lenis off
  (native scroll), all scroll animations resolve to final state, custom cursor
  off, the tall pinned sections collapse to normal flow. The result is a complete,
  legible static site.
- Intro renderer is **disposed** (`renderer.dispose()`, geometry/material
  teardown) ~1.4 s after the transition to free GPU memory.
- Stage render loop pauses on `visibilitychange`.
- Semantic landmarks, skip link, visible focus states, `aria-*` on the nav,
  mobile menu, sound toggle and form status. Colour contrast meets WCAG AA for
  body and large text on the dark ground.
- Sound never autoplays — it is synthesised with the Web Audio API (no asset
  files) and only starts after the user presses the toggle.
- Every smart-layer overlay (palette, drawer, shortcuts) is a real `dialog` with
  `aria-modal`, a focus trap, `Esc` to dismiss, and focus returned to the opener.
  The scroll lock is depth-counted so stacked layers unlock correctly.
- All browser storage goes through a `try`/`catch` wrapper, so private mode or
  blocked cookies degrade to "nothing remembered" rather than throwing.
- Under `prefers-reduced-motion` the counters snap to their value, the carousel
  autoplay and its progress fill stop, overlay transitions collapse, and filtered
  panels are hidden outright rather than animated out.

---

## Replace before publishing (placeholders)

- [ ] Firm **address, phone, email, hours** — `index.html` (contact section +
      JSON-LD `LegalService` + `footer`).
- [ ] Canonical domain — currently `https://www.steadyshieldlegal.com/` in
      `index.html`, `sitemap.xml`, `robots.txt`.
- [ ] **Testimonials** — three placeholder quotes marked "Client name, to be
      confirmed". Use genuine, attributable reviews only.
- [ ] **Insights** cards — placeholder titles / dates / reading times; wire to a
      CMS or MDX.
- [ ] **Trust section** — the three counters are wired to values that are true of
      the site itself (9 practice areas, the 5-stage process, the 24 h response
      target). Add headline figures — case volumes, success rates, years — only
      when you have verified data; change the number in `data-count` and the
      static text beside it together.
- [ ] **Practice area detail** — the drawer copy lives in the `AREAS` map at the
      top of `assets/js/smart.js`. Review it with the firm before publishing.
- [ ] **Matter triage weights** — the `QUESTIONS` table in `smart.js` decides
      which areas a visitor is routed to. Tune it to how the firm actually
      allocates work.
- [ ] **Consent bar** — currently records a choice in `localStorage` and nothing
      else, because the site sets no third-party cookies. Wire it to a real CMP
      if you add analytics or embeds. It deliberately waits for `ss:site-ready`
      (or `ss:intro-complete`) so it can never appear over the intro.
- [ ] **Gavel geometry** — the head and handle are `LatheGeometry` profiles at
      the top of `runIntro()` in `scene.js`, and `HANDLE` sets the wrist pivot.
      If you swap in a `.glb`, keep the pivot at the top of the handle so the
      swing stays an arc about the wrist.
- [ ] Contact form **submit handler** — validation, the completion meter and the
      draft recovery are real; the transport is a placeholder `setTimeout` in
      `form.init()` in `smart.js`. Point it at your intake system / serverless
      function and keep the busy/error states.
- [ ] `assets/img/*` — regenerate `icon-192/512.png`, `logo.png`, `og-cover.jpg`
      as real brand assets.
- [ ] Privacy Policy / Terms / Disclaimer pages — footer links are `#`.
- [ ] Consider self-hosting fonts and pinning the CDN libs locally for full
      offline / CSP control.

---

## Porting to the requested Next.js + R3F stack

The design is structured to move over cleanly:

| here | Next.js / R3F target |
|---|---|
| `index.html` sections | one component per `<section>` under `app/(marketing)/` |
| `main.css` tokens (`:root` custom properties) | keep as CSS variables; map to `tailwind.config` `theme.extend` |
| `main.js` module functions (`initNav`, `initReveals`, …) | `useEffect` hooks or small client components; keep GSAP context per component with `gsap.context()` |
| `smart.js` modules (`cmdk`, `drawer`, `practice`, `triage`, `insights`, `form`) | one client component each; the `AREAS` and `QUESTIONS` tables become plain data modules (or CMS queries) |
| `smart.js` `theme` module | a `ThemeProvider` + the same inline pre-paint script in `app/layout.tsx` |
| `store` (localStorage wrapper) | keep as-is, or swap for `useLocalStorage`; keep the try/catch |
| Lenis setup | `<ReactLenis root>` wrapper (`lenis/react`) |
| `scene.js` intro renderer | `<Canvas>` in an `IntroOverlay` client component; gavel/dust/beam as `<mesh>` primitives; timeline via `@react-three/drei` `useGSAP` |
| `scene.js` stage renderer | a single persistent `<Canvas>` fixed behind content; shield/approach/finale groups as components driven by a scroll store (`useScroll` from drei or a Zustand store fed by ScrollTrigger) |
| procedural geometry (shield `Shape`, gavel primitives) | keep as-is, or swap for compressed `.glb` via `useGLTF` + `meshopt` — the shield silhouette helper `shieldShape()` is reusable |
| capability tiers | same detection in a `useDeviceTier()` hook; gate the `<Canvas>` `dpr` and `frameloop` |
| JSON-LD | `app/layout.tsx` `<script type="application/ld+json">` or `next-seo` |
| `sitemap.xml` / `robots.txt` | `app/sitemap.ts` / `app/robots.ts` |

Keep the same event contract (`ss:*`) if you want the intro and stage to remain
decoupled, or replace it with a shared Zustand store once both live in React.

# Resoniq brand

## Selected identity: the Dial Q

The mark is an amp knob seen head-on: a skirt of tick marks from 7 o'clock to
5 o'clock, a dial ring, and a copper pointer that runs from the shaft out
through the ring. The pointer breaking the ring is the Q's tail, so the mark
reads as a knob to players and as a letter to everyone else. The teal tick
where the pointer lands is the only teal in the mark: signal-teal still means
"live signal" throughout the product.

Files (all in `frontend/public/brand/`):

| File | Use |
| --- | --- |
| `mark.svg` | App UI, nav, small sizes (64-unit grid, tile background) |
| `app-icon.svg` → `app-icon-512/192/180.png` | Launchers, PWA, Apple touch icon (`node scripts/brand-icons.mjs`) |
| `favicon.svg`, `/favicon.ico` | Browser tabs (simplified: no ticks below 32px) |
| `wordmark.svg` / `wordmark-dark.svg` | Custom monoline wordmark (drawn as paths, no font dependency), for dark and light grounds |
| `lockup.svg` | Mark + wordmark, horizontal |
| `og.png` (from `social/og-default.svg`) | Default social preview |
| `social/tone-card-1080.svg`, `social/story-1080x1920.svg` | Social templates with `{{PLACEHOLDERS}}` |

Dynamic social cards for shared tones and posts come from `/api/og/tone/[id]`
and `/api/og/post/[id]`. They render only content that is already public.

### Wordmark

RESONIQ is drawn on a 40-unit cap height with a 6-unit round-capped stroke,
so it shares stroke logic with the icon set. The final Q reuses the dial: its
tail is the copper pointer. Don't set the name in a typeface where the
wordmark fits. In running text, write "Resoniq".

### Rules

- Minimum size: mark 20px, wordmark 72px wide.
- Clear space: one ring-stroke width on every side.
- Copper `#FF8A3D` is for gear, actions and the pointer. Signal-teal `#37E6C9` is for audio, live data and "inferred". Never swap them.
- Don't recolor the pointer, rotate the mark, or add effects beyond the app-icon gradient.

## Explorations (kept for the record)

`public/brand/explorations/` holds the four directions considered. They're
genuinely different ideas, not variations:

- **A. Dial Q** (selected). Knob plus letterform. It works at 16px and carries the provenance colors.
- **B. Pole Piece.** Six pickup pole pieces, one plucked and ringing. Very "guitar", but it reads as a pickup ad and loses the name.
- **C. Patch Cable.** An R and an O joined by a cable through a jack. Charming, but too literal and busy small.
- **D. Decay.** Strings ringing out into a resonance chevron. Strong as a pattern, weak as a symbol. It may return as a texture.

Older concepts from October (`resoniq-knob|peak|pick|q|string|tube*.svg`) stay
in the folder untouched.

## Not done

No Figma or Canva files were made. During the final takeover, Canva search
found no Resoniq designs and its exploration tool returned an empty
recommendation; no Figma connector was available. The original icon/wordmark
family remains the source of the identity.

## Photographic direction

The landing's decorative SVG instrument components were replaced by three
original generated studio photographs, exported to seven local WebP files in
`public/images/`: `studio-guitar-*`, `studio-bassist-*`, `studio-pedals-*`.
They share copper practical lighting, restrained teal highlights, dark studio
surfaces and credible equipment textures. These images are illustrative;
they do not document an actual musician's rig.

`public/brand/og-studio.jpg` is the new 1200×630 default social image, composed
with the original wordmark. Rebuild it with `node scripts/brand-social.mjs`
from `frontend/`. Existing reusable SVG social templates remain available.
See [the takeover report](production-takeover.md) for source, model usage and
validation details.

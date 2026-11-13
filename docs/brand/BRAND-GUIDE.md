# ASTELVO by Sun — Brand assets v0.1

**Organize. Script. Explore.**

The owner approved concept 01 and its visual direction: layered A, play cutout, exploration star and periwinkle blue. These SVG masters are a deliberate geometric reconstruction of that raster concept, with outlined typography and simplified small-size variants. They are usable implementation assets, not a pixel-perfect vector trace of the generated board. The product interface on that board remains illustrative.

## Identity

- Public name: **ASTELVO by Sun**. Wordmark: **ASTELVO**; endorsement: **by Sun**.
- Tagline: **Organize. Script. Explore.** Preserve spelling, capitalization and punctuation.
- Product ID: SUN-009. Technical identity: `Sun.Workspace`.
- Layered strokes express organization; the negative-space triangle expresses Try It; the star connects exploration to the SUN family.

## Assets

All assets live in `assets/brand/`.

| Asset | Use |
|---|---|
| `astelvo-mark-color.svg` | Primary standalone mark; transparent background |
| `astelvo-mark-light.svg` | Single-colour light mark on dark surfaces |
| `astelvo-mark-dark.svg` | Single-colour dark mark on light surfaces |
| `astelvo-mark-small.svg` | Flat compact mark without detached star |
| `astelvo-lockup-dark.svg` / `.png` | Logo, endorsement and tagline on navy |
| `astelvo-lockup-light.svg` / `.png` | Logo, endorsement and tagline on white |
| `astelvo-app-icon.svg` | App tile master; transparent outer corners |
| `astelvo-app-icon-small.svg` | Optical app tile for 16–24 px |
| `astelvo-icon-{size}.png` | 16, 24, 32, 48, 64, 128, 256, 512 and 1024 px exports |
| `astelvo.ico` | Windows multi-resolution icon: 16–256 px |
| `tokens.json` / `tokens.css` | Brand colour values; not a complete application theme |

## Colour

| Role | Hex |
|---|---|
| Deep Space background | `#0B1020` |
| Midnight Slate surface | `#151D30` |
| ASTELVO Periwinkle | `#879BFF` |
| Deep accent | `#5865D8` |
| Soft White | `#F5F7FA` |
| Stellar Gray | `#9CA8BC` |
| SUN Solar Gold | `#F6C453` |

The intermediate mark layer uses `#7184F2`. Light lockups use a darker gold `#76530B` for the endorsement. Brand colours do not automatically establish contrast compliance for every UI text/background pairing; validate application states when implementing the theme.

## Usage

- Keep the aspect ratio and negative spaces intact. Never stretch, skew or rotate the mark.
- Minimum recommended full mark size: 32 px; use the starless compact variant at 16–24 px.
- Leave clear space of at least one eighth of the mark width around a standalone mark.
- Show the complete lockup at 420 CSS px or wider; use the mark alone where the tagline is too small to read.
- Use flat or monochrome marks for small UI placements. Glows and decorative backgrounds are optional presentation effects, not part of recognition.
- Do not add a security shield, database cylinder, planet or unrelated language logo to the mark.
- SVG text is outlined: rendering has no installed-font dependency. Set an accessible label at the consuming UI; decorative duplicates should be hidden from assistive technology.

## Typography and provenance

The raster concept's typography is approximated with Liberation Sans Bold and Regular converted to paths, with deliberate wordmark tracking. No font binary is distributed. The accompanying `FONT-LICENSE.txt` preserves the upstream Liberation Fonts OFL notice. A future typography revision should update the assets together rather than substituting fonts inside one logo.

## Rebuilding and validation

Run `python3 scripts/brand/build_brand.py` from the repository root. Requirements: Python 3, fonttools, Pillow, Inkscape and Liberation Sans Regular/Bold. Override the font directory with `ASTELVO_FONT_DIR`. Existing assets are committed; these tooling dependencies are not needed to use them. The generator writes a QA preview at the repository root; it is not a runtime dependency.

Validation performed: SVG XML parsing, no embedded scripts/external font references, PNG dimensions/alpha, ICO frame sizes, and visual review of both lockups and actual-size icon exports. OS installer/taskbar validation remains part of M0/M5 packaging work. Brand generation does not complete the desktop milestone.

Commercial naming/logo similarity clearance remains pending; visual approval is not a clearance claim. These files do not grant third-party rights to the brand.

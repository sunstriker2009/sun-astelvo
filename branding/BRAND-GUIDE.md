# ASTELVO by Sun — Brand Guide

**Organize. Script. Explore.**

The owner approved concept 02: three layered script files over a sun arc, a play cutout and periwinkle blue. This supersedes concept 01's layered A and detached star. These SVG masters are a deliberate geometric reconstruction of that raster concept, with outlined typography and simplified small-size variants. They are usable implementation assets, not a pixel-perfect vector trace of the generated board. The product interface on that board remains illustrative.

## Identity

- Public name: **ASTELVO by Sun**. Wordmark: **ASTELVO**; endorsement: **by Sun**.
- Tagline: **Organize. Script. Explore.** Preserve spelling, capitalization and punctuation.
- Product ID: SUN-009. Technical identity: `Sun.Workspace`.
- Layered script files express organization; the negative-space triangle expresses Try It; the sun arc connects the workspace to the SUN family.

## Assets

Approved production assets live in `branding/assets/`; archival material lives in `branding/archive/`. All migrated files retain their original Git blob hashes.

| Asset | Use |
|---|---|
| `symbol-color.svg` | Primary standalone mark; transparent background |
| `symbol-light.svg` | Single-colour light mark on dark surfaces |
| `symbol-dark.svg` | Single-colour dark mark on light surfaces |
| `symbol-small.svg` | Flat compact files-and-arc mark without script strokes |
| `lockup-dark.svg` / `.png` | Logo, endorsement and tagline on navy |
| `lockup-light.svg` / `.png` | Logo, endorsement and tagline on white |
| `icons/app-icon.svg` | App tile master; transparent outer corners |
| `icons/app-icon-small.svg` | Optical app tile for 16–24 px |
| `icons/icon-{size}.png` | 16, 24, 32, 48, 64, 128, 256, 512 and 1024 px exports |
| `icons/app.ico` | Windows multi-resolution icon: 16–256 px |
| `tokens.json` / `tokens.css` | Brand colour values; not a complete application theme |

The README uses the owner-approved panoramic artwork, `branding/assets/readme-banner-v1.png`, at full available width on both GitHub themes. It is a separate raster presentation asset, not an output of the vector generator. Preserve its aspect ratio; do not crop or stretch it.

The compact `lockup-dark.svg` and `lockup-light.svg` remain available for internal screens, documentation and other compact placements. The former duplicate PNG aliases are retired and preserved in Git history; the generator no longer emits them. This banner changes the README presentation, not the icon identity.

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
- Minimum recommended full mark size: 32 px; use the simplified compact variant at 16–24 px.
- Leave clear space of at least one eighth of the mark width around a standalone mark.
- Show the complete lockup at 420 CSS px or wider; use the mark alone where the tagline is too small to read.
- Use flat or monochrome marks for small UI placements. Glows and decorative backgrounds are optional presentation effects, not part of recognition.
- Keep the sun arc and three file layers together. Do not substitute the superseded layered A or detached star, or add a security shield, database cylinder, planet or unrelated language logo.
- SVG text is outlined: rendering has no installed-font dependency. Set an accessible label at the consuming UI; decorative duplicates should be hidden from assistive technology.

## Typography and provenance

Concept 02's typography is approximated with Liberation Sans Bold and Regular converted to paths, with deliberate wordmark tracking. No font binary is distributed. The accompanying `FONT-LICENSE.txt` preserves the upstream Liberation Fonts OFL notice. A future typography revision should update the assets together rather than substituting fonts inside one logo.

## Rebuilding and validation

Run `python3 scripts/brand/build_brand.py` from the repository root. Requirements: Python 3, fonttools, Pillow, Inkscape and Liberation Sans Regular/Bold. Override the font directory with `ASTELVO_FONT_DIR`. Existing assets are committed; these tooling dependencies are not needed to use them. The generator writes a QA preview to `branding/archive/intermediate/brand-preview.png`; it is not a runtime dependency.

Validation performed: SVG XML parsing, no embedded scripts/external font references, PNG dimensions/alpha, ICO frame sizes, and visual review of both lockups and actual-size icon exports. OS installer/taskbar validation remains part of M0/M5 packaging work. Brand generation does not complete the desktop milestone.

Commercial naming/logo similarity clearance remains pending; visual approval is not a clearance claim. These files do not grant third-party rights to the brand.


## SUN reference-layout migration

- The README banner is preserved byte-for-byte under `branding/assets/readme-banner-v1.png` and `branding/archive/originals/readme-banner-v1.png` (blob SHA `6abd707eefaf79659047346311083937bdec5ad1`). The original layered concept file has not been established as identical to this banner; no such claim is made.
- All existing approved SVGs, PNGs, tokens, font-license notice and ICO were moved to generic names without regenerating artwork. The generator was updated to write those canonical paths and the QA preview to the archive.
- The current symbol SVGs are approved geometric reconstructions of concept 02, **not** pixel-exact traces or a separately approved transparent raster canonical source. Do not invent a raster master.
- Superseded duplicate lockup PNG aliases were removed, with their bytes retained in Git history.
- Follow the [SUN standard](https://github.com/sunstriker2009/sun-ecosystem/blob/main/docs/governance/PRODUCT-BRANDING.md) and the [FOUNDRY adoption checklist](https://github.com/sunstriker2009/sun-foundry/blob/main/branding/ADOPTION-CHECKLIST.md) for future product migrations.

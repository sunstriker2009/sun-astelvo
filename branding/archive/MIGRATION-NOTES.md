# ASTELVO branding migration (SUN reference layout)

This migration preserves the owner-approved concept 02 identity and all existing asset bytes. The README banner is unchanged, with its path updated.

| Legacy | New canonical path |
| --- | --- |
| `assets/brand/astelvo-readme-panoramic-v1.png` | `branding/assets/readme-banner-v1.png` |
| `assets/brand/astelvo-mark-{color,light,dark,small}.svg` | `branding/assets/symbol-{color,light,dark,small}.svg` |
| `assets/brand/astelvo-lockup-{dark,light}.{svg,png}` | `branding/assets/lockup-{dark,light}.{svg,png}` |
| `assets/brand/astelvo-app-icon.svg` | `branding/assets/icons/app-icon.svg` |
| `assets/brand/astelvo-app-icon-small.svg` | `branding/assets/icons/app-icon-small.svg` |
| `assets/brand/astelvo-icon-{size}.png` | `branding/assets/icons/icon-{size}.png` |
| `assets/brand/astelvo.ico` | `branding/assets/icons/app.ico` |
| `assets/brand/tokens.{json,css}` | `branding/assets/tokens.{json,css}` |
| `assets/brand/FONT-LICENSE.txt` | `branding/assets/FONT-LICENSE.txt` |
| `docs/brand/BRAND-GUIDE.md` | `branding/BRAND-GUIDE.md` (legacy pointer retained) |
| `assets/brand/astelvo-files-sun-arc-v02-{dark,light}.png` | Retired duplicate exports; use `branding/assets/lockup-{dark,light}.png` |

Icon sizes: 16, 24, 32, 48, 64, 128, 256, 512, 1024.

The approved README artwork is archived at `branding/archive/originals/readme-banner-v1.png` with the same Git blob SHA as the active banner: `6abd707eefaf79659047346311083937bdec5ad1`. This does not establish that the flattened banner is identical to the original concept board or layered source.

All renamed assets reused their existing Git blob SHA, without image regeneration. The Python brand generator now targets the canonical paths and no longer creates duplicate alias exports; it writes its QA preview under `branding/archive/intermediate/`.

**Outstanding verification:** Run the generator with its documented local dependencies and confirm output equivalence before relying on regenerated assets; check any external consumers of old asset paths. Branding migration does not constitute desktop application implementation or trademark clearance.

## Raster adoption — 2026-11-14

The owner approved returning to concept 02 with raster variants, then approved the transparent symbol. The panoramic README banner is unchanged. Existing SVGs and their raster exports are preserved below, outside active assets. New PNG/ICO exports reuse the size-based paths; external caches may require refresh.

| Previous path | Archive path |
| --- | --- |
| `branding/assets/icons/app-icon-small.svg` | `branding/archive/retired/vector-v0.2/icons/app-icon-small.svg` |
| `branding/assets/icons/app-icon.svg` | `branding/archive/retired/vector-v0.2/icons/app-icon.svg` |
| `branding/assets/icons/app.ico` | `branding/archive/retired/vector-v0.2/icons/app.ico` |
| `branding/assets/icons/icon-1024.png` | `branding/archive/retired/vector-v0.2/icons/icon-1024.png` |
| `branding/assets/icons/icon-128.png` | `branding/archive/retired/vector-v0.2/icons/icon-128.png` |
| `branding/assets/icons/icon-16.png` | `branding/archive/retired/vector-v0.2/icons/icon-16.png` |
| `branding/assets/icons/icon-24.png` | `branding/archive/retired/vector-v0.2/icons/icon-24.png` |
| `branding/assets/icons/icon-256.png` | `branding/archive/retired/vector-v0.2/icons/icon-256.png` |
| `branding/assets/icons/icon-32.png` | `branding/archive/retired/vector-v0.2/icons/icon-32.png` |
| `branding/assets/icons/icon-48.png` | `branding/archive/retired/vector-v0.2/icons/icon-48.png` |
| `branding/assets/icons/icon-512.png` | `branding/archive/retired/vector-v0.2/icons/icon-512.png` |
| `branding/assets/icons/icon-64.png` | `branding/archive/retired/vector-v0.2/icons/icon-64.png` |
| `branding/assets/lockup-dark.png` | `branding/archive/retired/vector-v0.2/lockup-dark.png` |
| `branding/assets/lockup-dark.svg` | `branding/archive/retired/vector-v0.2/lockup-dark.svg` |
| `branding/assets/lockup-light.png` | `branding/archive/retired/vector-v0.2/lockup-light.png` |
| `branding/assets/lockup-light.svg` | `branding/archive/retired/vector-v0.2/lockup-light.svg` |
| `branding/assets/symbol-color.svg` | `branding/archive/retired/vector-v0.2/symbol-color.svg` |
| `branding/assets/symbol-dark.svg` | `branding/archive/retired/vector-v0.2/symbol-dark.svg` |
| `branding/assets/symbol-light.svg` | `branding/archive/retired/vector-v0.2/symbol-light.svg` |
| `branding/assets/symbol-small.svg` | `branding/archive/retired/vector-v0.2/symbol-small.svg` |
| `scripts/brand/build_brand.py` | `branding/archive/retired/vector-v0.2/build_brand.py` |
| `docs/brand/preview.png` | `branding/archive/intermediate/concept-01-vector-preview.png` |

The previous `scripts/brand/build_brand.py` is archived and replaced by a compatibility launcher for the new raster-only export script. The historical generator is not supported in its archived location and must never write production assets.

### New sources and exports

- `branding/assets/symbol-canonical-v1.png`: the exact approved transparent PNG, also preserved in `archive/originals/`.
- `branding/assets/icons/icon-{size}.png` and `app.ico`: regenerated from that approved raster source.
- `branding/asset-manifest.json`: checksums, dimensions, source relationships and approval record.
- `scripts/brand/build_brand.sh`: ImageMagick 7 exports; neither approved master is modified.
- `branding/archive/intermediate/raster-icon-review.png`: native-size review sheet.

The guide and README now identify active raster assets. Product ID references in the README, brand guide and roadmap are aligned to SUN-002 in registry version 1.1. No milestone implementation status is changed.

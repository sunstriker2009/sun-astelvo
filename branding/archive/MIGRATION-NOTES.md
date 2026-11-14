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

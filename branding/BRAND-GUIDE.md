# ASTELVO by Sun — Brand Guide

**Organize. Script. Explore.** · SUN-002 · `Sun.Workspace`

## Approved identity

Concept 02 is the approved direction: three overlapping script files over a luminous sun arc, with a play triangle on the front file. Files express organization, the play triangle expresses Try It, and the arc connects ASTELVO to SUN. A letter A is optional and is not part of this identity.

On 2026-11-14 the owner returned to this direction after the A-shaped experiments and explicitly approved the transparent raster symbol shown in the conversation. The existing panoramic banner remains approved. The transparent symbol is a separately approved image-assisted derivative of that banner, **not a pixel-exact extraction or the original layered source**.

## Active assets

| Path relative to `branding/assets/` | Purpose |
| --- | --- |
| `readme-banner-v1.png` | Original approved 2172 × 724 panoramic banner, unchanged |
| `symbol-canonical-v1.png` | Approved 1254 × 1254 transparent RGBA raster symbol |
| `icons/icon-{size}.png` | Transparent PNG exports: 16, 24, 32, 48, 64, 128, 256, 512, 1024 px |
| `icons/app.ico` | Windows ICO with 16, 24, 32, 48, 64, 128, 256 px frames |
| `tokens.json` / `tokens.css` | Working brand palette; not a complete UI theme |
| `FONT-LICENSE.txt` | Retained license notice for historical typography work |

The owner selected **raster variants** to preserve gradients, material and glow. This product-specific decision overrides the ecosystem standard's default complementary SVG recommendation. SVG adaptations and their PNG exports are retired; do not use them as production masters or regenerate the active icons from vectors. No raster-in-SVG wrappers are provided.

Use the transparent color symbol on both light and dark surfaces. It is the same approved artwork, rather than a recolored theme variant. Flat monochrome and alternate light lockups are not approved production variants. Use the panoramic banner when the full name, endorsement and tagline are needed.

## Source provenance

- The original banner and its exact archive copy share Git blob SHA `6abd707eefaf79659047346311083937bdec5ad1`.
- The approved transparent symbol is preserved byte-for-byte in both `assets/symbol-canonical-v1.png` and `archive/originals/symbol-canonical-v1.png`.
- The symbol was produced by image-assisted background extraction from the approved banner and then explicitly approved. It preserves the three files, blue gradients, play triangle and blue-white arc; it is not claimed to preserve every source pixel.
- PNG icons and the ICO are deterministic exports of that approved symbol, without geometry changes, recoloring or fresh image generation.
- No editable layered source or original font file for the raster wordmark is available. Do not infer one from the archived geometric reconstruction.
- SHA-256 checksums and export sizes are recorded in `asset-manifest.json`.

## Palette and typography

| Role | Working hex |
| --- | --- |
| Deep Space | `#0B1020` |
| Midnight Slate | `#151D30` |
| Periwinkle | `#879BFF` |
| Deep accent | `#5865D8` |
| Intermediate layer | `#7184F2` |
| Soft White | `#F5F7FA` |
| Stellar Gray | `#9CA8BC` |
| SUN Solar Gold | `#F6C453` |

These values guide surrounding UI; the approved raster gradients remain authoritative. The banner uses white ASTELVO typography, a gold “by Sun” endorsement and the exact tagline **Organize. Script. Explore.** Preserve the original raster typography. Liberation Sans was an approximation used by the retired vector generator, not an identified source font for the raster banner.

## Usage and size review

Preserve aspect ratio, the three files, play triangle and arc together. Never stretch, rotate, recolor or add a forced A, detached star, security shield or database cylinder. Allow at least one eighth of the symbol width as surrounding clear space; the transparent source already includes padding.

Prefer 32 px or larger for the complete mark. At 16–24 px only the silhouette and arc remain useful; script strokes and the play triangle lose detail. These are direct downscaled raster exports, not separately approved simplified drawings. Avoid using the icon alone for actions that need a clear label.

The full banner should have sufficient rendered width for its tagline; provide ordinary text and accessible labels in the surrounding document or UI. Alt text should identify ASTELVO by Sun. Check contrast for the actual UI placement rather than assuming the palette establishes accessibility compliance.

The transparent symbol has been reviewed on white and navy, and all PNG sizes at native scale. ICO frame dimensions and alpha have been checked. Windows taskbar, installer and packaging validation remain part of the desktop milestones.

## Rebuild

Run `bash scripts/brand/build_brand.sh`, or the compatible `python3 scripts/brand/build_brand.py` entry point. Requires ImageMagick 7 and Bash. The script reads the approved transparent PNG, resizes with Lanczos, and exports RGBA PNGs and a multi-frame ICO. It does not overwrite either approved master or generate vectors. Different ImageMagick versions may encode different bytes; record tool version when replacing exports.

Review sheets belong in `archive/intermediate/`, never in application asset paths. New symbol revisions require approval and a versioned source filename. New README artwork requires a new versioned banner filename and an updated README reference.

See [archive history](archive/README.md), [migration mapping](archive/MIGRATION-NOTES.md), and the [SUN standard](https://github.com/sunstriker2009/sun-ecosystem/blob/main/docs/governance/PRODUCT-BRANDING.md). This branding update does not complete any application milestone or establish commercial naming clearance.

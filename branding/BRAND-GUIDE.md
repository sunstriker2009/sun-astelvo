# WORKBENCH by Sun — Brand Guide

**Product:** SUN-P001 (formerly ASTELVO)  
**Repository:** `sunstriker2009/sun-workbench`  
**Technical identity:** `Sun.Workspace`, `Sun.Workspace.*`, `@sun-workspace/*`  
**Tagline:** Organize. Script. Explore.

The owner approved the public product rename to WORKBENCH by Sun. This is the same product and SUN ID; it does not resume paused feature development or establish commercial naming clearance.

## Current approved raster artwork

The active source is the approved Workbench W2 package, installed through the branding ZIP workflow and merged in product PR #39. See `branding/revisions/current.json` and the immutable `v2.zip` snapshot for that installation; `v1.zip` preserves the previous asset tree. Do not regenerate or reconstruct the approved PNG artwork as SVG.

| Path | Use |
| --- | --- |
| `branding/assets/readme-banner.png` | Panoramic README banner |
| `branding/assets/symbol.png` | Canonical symbol |
| `branding/assets/icons/icon-{size}.png` | Supplied compact raster icons |
| `branding/assets/social-card.png`, `social-preview.png` | Supplied social exports |
| `branding/assets/refs/` | Historical/source references; not active app icons |

Preserve aspect ratio, transparency and supplied artwork. Alt text and surrounding UI identify WORKBENCH by Sun. Application build copies should derive from canonical assets, not archived concepts. Native executable resource-icon/metadata acceptance remains an open packaging gate.

## Historical material and working UI tokens

The older files/arc direction, raster extraction notes and retired vectors are historical. Original decisions and `branding/archive/` remain intact. The pre-W2 `branding/asset-manifest.json` and older reference copies do not certify current W2 bytes. Consult revision snapshots for installed provenance rather than treating old manifest checksums as current validation.

Existing working UI palette tokens remain in `branding/assets/tokens.json` and `tokens.css`. The legacy `--astelvo-*` CSS prefix is retained for compatibility; this rename does not assert that old UI palette values describe the W2 artwork. Theme/palette redesign is separate work.

The export scripts resize the supplied canonical symbol; they do not recreate a layered master or replace approved artwork. Any future artwork change uses a visually reviewed branding PR and the shared [SUN branding standard](https://github.com/sunstriker2009/sun-ecosystem/blob/main/docs/governance/PRODUCT-BRANDING.md).

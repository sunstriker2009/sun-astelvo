# ASTELVO → WORKBENCH

The owner explicitly approved WORKBENCH by Sun and repository `sunstriker2009/sun-workbench`. SUN-002, the purpose, tagline **Organize. Script. Explore.**, `Sun.Workspace` namespaces and `@sun-workspace/*` packages remain the same. Commercial clearance remains pending.

The public app/window title, UI labels, host-info product label, portable output folder/executable names and registry names use WORKBENCH. The approved Workbench W2 raster assets remain untouched.

## Compatibility

Existing workspaces and backups are not migrated by this naming change. The `astelvo-workspace` and `astelvo-draft-checkpoint` format identifiers, `.astelvo-writer.lock`, `.astelvo-recovery.json`, archive suffix, IPC channels, `window.astelvo`, `ASTELVO_DOTNET`/`ASTELVO_HOST_EXECUTABLE` overrides and `--astelvo-smoke` remain stable compatibility identifiers. The Electron profile folder and Windows AppUserModelID remain at their legacy identity so the name change does not create a second profile/shortcut identity. The host-info display product becomes WORKBENCH; desktop and host must ship as a matching bundle, as before.

Portable output becomes `WORKBENCH-{rid}/WORKBENCH.exe` on Windows or `WORKBENCH-{rid}/workbench` on Linux. Existing archives and storage identifiers are accepted by the same parsers without schema changes. Historical ADRs/evidence preserve the former name.

## Authorization

This is a naming migration only. The paused product-development state and disabled historical ASTELVO Development schedule stay paused. No release, publishing, feature milestone completion or commercial clearance is implied. Current Windows/native packaging acceptance remains open.

Workbench’s current registry ID after the [SUN family ID migration](https://github.com/sunstriker2009/sun-ecosystem/blob/main/decisions/sun-family-ids.md) is `SUN-P001`.

<p align="center">
  <img src="branding/assets/readme-banner-v1.png" alt="ASTELVO by Sun — layered script files over a sun arc. Organize. Script. Explore." width="100%">
</p>

# ASTELVO by Sun

**Organize. Script. Explore.**

A local code organizer and interactive scripting workspace. Organize scripts using folders, tags and smart collections, edit with language-aware tools, and try JavaScript, Python and C# through local runtime adapters.

## Project status

The first M1 organizer slice supports creating/opening a local workspace, nested folders, and manually saving/reopening JavaScript, Python and C# scripts. Scripts can be renamed, moved between folders and assigned a language. Exclusive workspace ownership and hash checks protect against competing instances and stale saves. The editor currently opens one script at a time; runners, formatting, tags, search and import/export remain planned.

Automated Windows portable acceptance passed for the merged foundation. The new organizer has local real-host and headless editor-flow validation; its Windows acceptance still needs a run after merge. Interactive clean-machine and governance follow-ups remain open.

## Development

See [local development](docs/operations/LOCAL-DEVELOPMENT.md) for prerequisites and build/start commands, and [foundation validation](docs/operations/M0-VALIDATION.md) for evidence and pending gates.

## Brand

[Brand guide](branding/BRAND-GUIDE.md) · [Assets](branding/assets/) · [Archive](branding/archive/README.md)

The approved panoramic banner and transparent symbol are the raster sources of truth. PNG and ICO exports preserve their gradients; earlier SVG adaptations are archived.

## Planning

- [ASTELVO Roadmap](docs/ASTELVO%20Roadmap.md)
- [Milestones](docs/roadmap/MILESTONES.md)
- [Master checklist](docs/roadmap/MASTER-CHECKLIST.md)
- [Architecture](docs/architecture/OVERVIEW.md)
- [Repository adoption evidence](docs/operations/REPOSITORY-ADOPTION.md)
- [Repository setup](docs/REPOSITORY-SETUP.md)

SQL/database connections, Kubernetes and additional execution providers are future extensions. Local user scripts run with the user's OS permissions; separate processes are not a security sandbox.

Governance: [SUN Git Workflow & Merge Policy](https://github.com/sunstriker2009/sun-ecosystem/blob/main/docs/governance/GIT-WORKFLOW.md). Product ID SUN-002; capability namespace Sun.Workspace.

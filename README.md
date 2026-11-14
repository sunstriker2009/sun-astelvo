<p align="center">
  <img src="branding/assets/readme-banner-v1.png" alt="ASTELVO by Sun — layered script files over a sun arc. Organize. Script. Explore." width="100%">
</p>

# ASTELVO by Sun

**Organize. Script. Explore.**

A local code organizer and interactive scripting workspace. Organize scripts using folders, tags and smart collections, edit with language-aware tools, and try JavaScript, Python and C# through local runtime adapters.

## Project status

M0 foundation is in progress. The first development scaffold includes an Electron/React/Monaco editor and a local .NET 10 information-only host over framed stdio. The buffer is temporary; saving and script execution are not implemented. Builds and IPC tests pass locally; desktop launch and Windows packaging acceptance remain pending.

## Development

See [local development](docs/operations/LOCAL-DEVELOPMENT.md) for prerequisites and build/start commands, and [foundation validation](docs/operations/M0-VALIDATION.md) for evidence and pending gates.

## Brand

[Brand guide](branding/BRAND-GUIDE.md) · [Assets](branding/assets/) · [Archive](branding/archive/README.md)

## Planning

- [ASTELVO Roadmap](docs/ASTELVO%20Roadmap.md)
- [Milestones](docs/roadmap/MILESTONES.md)
- [Master checklist](docs/roadmap/MASTER-CHECKLIST.md)
- [Architecture](docs/architecture/OVERVIEW.md)
- [Repository adoption evidence](docs/operations/REPOSITORY-ADOPTION.md)
- [Repository setup](docs/REPOSITORY-SETUP.md)

SQL/database connections, Kubernetes and additional execution providers are future extensions. Local user scripts run with the user's OS permissions; separate processes are not a security sandbox.

Governance: [SUN Git Workflow & Merge Policy](https://github.com/sunstriker2009/sun-ecosystem/blob/main/docs/governance/GIT-WORKFLOW.md). Product ID SUN-009; capability namespace Sun.Workspace.

# Using the SUN repository template

1. On GitHub, open `sunstriker2009/sun-repo-template`.
2. Enable **Settings → General → Template repository** on the source repository (one-time setup).
3. Select **Use this template → Create a new repository**.
4. Choose a product repository name and visibility.
5. Follow `docs/REPOSITORY-SETUP.md` in the generated repository.
6. Run the initial CI, then configure required checks and protected main.
7. Use PRs and squash merges for subsequent changes.

This template is intentionally stack-agnostic; it does not compile .NET or Next.js projects. It only provides baseline repository checks and governance scaffolding.

# SUN repository setup checklist

This repository was generated from the SUN generic repository template.

## 1. Customize

1. Rename README title and replace starter text with the product description.
2. Replace commented CODEOWNERS examples with real users/teams who have access.
3. Add stack-specific CI (e.g. .NET 10, Next.js); generic CI checks repository structure only.
4. Add a license if appropriate; choose it deliberately for the product.
5. Confirm workflow permissions are restricted to what each job needs.

## 2. GitHub repository settings (not copied by templates)

- Disable merge commits and rebase merges; allow squash merges only.
- Enable auto-delete head branches and optionally auto-merge.
- Configure main branch ruleset: PR required, strict required checks, resolved conversations, no bypass.
- Require reviewer approval / CODEOWNERS for security-sensitive changes.
- Configure secrets and environments individually; never commit credentials.
- Run CI on main first, then select the exact check names in ruleset settings.
- Test that a deliberately failing CI PR cannot merge.

## 3. Expected checks

- `repository-validation` on pushes to main and PRs.
- `conventional-title` on PRs only.
- Product-specific CI checks must be added and protected separately.

## 4. Bootstrap tool

Optional governance auditing and settings provisioning:
https://github.com/sunstriker2009/sun-repo-bootstrap

Policy source:
https://github.com/sunstriker2009/sun-ecosystem/blob/main/docs/governance/GIT-WORKFLOW.md

**Caution:** A template does not transfer branch rulesets, merge options, secrets, deployment environments, approvals or workflow run history.

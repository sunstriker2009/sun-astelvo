# ASTELVO repository adoption

Inspected 2026-11-12.

| Control | Evidence | Remaining validation |
|---|---|---|
| Repository | Public; main; SUN template files present | Product documentation customization |
| Main | Branch API reports protected=true | Exact rules, strict checks and bypass behaviour |
| Merge methods | Squash enabled; merge/rebase disabled | Merge acceptance |
| Auto-merge | Enabled | Protection-respecting behaviour |
| Sensitive review | Unverified | CODEOWNERS and enforced human review |
| CI | Template structure/title workflows inspected | First product PR and fail-CI blocking evidence |
| Product builds | Absent from template | Add with M0 implementation |

No settings changed in the documentation PR. Audit before bootstrap apply: existing named rulesets cannot be overwritten. Bootstrap verifier currently expects zero mandatory approvals; stronger review needs separate audit or a reviewed provisioner enhancement. Do not weaken protection to pass it.

[SUN governance](https://github.com/sunstriker2009/sun-ecosystem/blob/main/docs/governance/GIT-WORKFLOW.md).

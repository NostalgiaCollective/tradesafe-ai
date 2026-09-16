# Release decisions for review — proposals, not approvals

No retention job, deletion policy, legal conclusion or checklist publication is activated here.

| Decision | Concrete proposal for review | Required owner/evidence |
| --- | --- | --- |
| Privacy notice and collection | Explain company/member access, normalized photos with EXIF removal, retained author/upload times, and the difference between drafts and immutable finalized records. Ask users to avoid unrelated personal data in photos/captions. | Product owner and qualified privacy reviewer approve notice and jurisdiction coverage. |
| Retention | Retain current data while a policy is decided. Specify separate periods and purposes for drafts, finalized reports/evidence/PDFs, invitations, audit history, recovery material and backups. No blanket period is inferred. | Product/legal decision; map contractual, incident and legal-hold needs before any deletion implementation. |
| Deletion/export requests | Provide an authenticated support intake; verify requester/company authority, identify legal holds and immutable-record obligations, then approve a scoped export or deletion plan with audit evidence. No immediate self-service erase of finalized evidence. | Named support owner, identity-verification procedure and approved response commitments. |
| Safety content | Keep current version marked pending qualified review. Review each question for trade/jurisdiction/source/version, competence assumptions, wording and evidence requirements; approve a new version explicitly. Preserve all old snapshots. | Named qualified reviewers and signed/versioned acceptance matrix. Source links or passing tests are not approval. |
| Recovery objectives | Agree RPO/RTO, backup cadence, independent encrypted destination, access and recovery-key custodians after a measured isolated drill. | Operations owner, authorized compatible isolated target and database export access. |
| Abuse/capacity | Review the new ten-minute budgets against observed team use before production. Monitor sanitized rejection/duration events and provider capacity. Do not turn a resource budget into paid access. | Named operations owner; capacity/load assessment and escalation playbook. |

Production remains blocked on these decisions, delivered signup/magic-link validation, sender/domain review, an actual isolated database-plus-Storage restore drill, operational ownership/alerts, broader device coverage and the existing separate billing reconciliation. The staging phase does not establish production readiness.

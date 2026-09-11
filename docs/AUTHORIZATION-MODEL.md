# Phase 2 permission matrix

Defined before implementation, 2026-09-11. Membership is per company and individually authenticated. Roles confer application access only, never statutory competence, certification or permission to perform regulated work.

| Operation | Worker | Supervisor | Owner |
| --- | --- | --- | --- |
| Read company identity, members, reports and actions | Yes, active company only | Yes | Yes |
| Create own draft | Yes | Yes | Yes |
| Save/finalize/amend own report | Yes | Yes | Yes |
| Save/finalize/amend another member's report | No | Yes | Yes |
| Update assigned action, request verification | Yes | Yes, any action | Yes, any action |
| Assign/reassign actions; close with verification; reopen | No | Yes | Yes |
| Update business settings; invite/revoke invitations | No | No | Yes |
| Change roles/remove members | No | No | Yes; last active owner protected |
| Grant paid access / change finalized observations | No | No | No |

All mutations go through authenticated Next handlers and narrowly checked database functions. New tables expose SELECT through RLS, with no direct client INSERT/UPDATE/DELETE grants. Every function checks `auth.uid()` and current membership; company/role supplied by a client never establishes authority. Company-row locks serialize membership changes with commands, so removal revokes subsequent operations. Owner changes cannot leave a company ownerless.

Invitations are expiring, revocable, one-use records, bound to the intended verified Auth email. The owner supplies a link through their existing communication channel; the app does not claim to send email. Only a digest is retained. Acceptance checks current `auth.users` email/confirmation, not editable user metadata. It cannot downgrade an existing member or revive a removed user using an old consumed invite. Owners may explicitly issue a fresh invitation to a removed account.

Finalization records observations even with unresolved findings. Corrective-action verification requires supervisor/owner permission; the verification actor/time and previous values are recorded in an append-only event stream. This does not establish professional qualification. Historic reports remain read-only legacy records. Backfill creates one separate company for each legacy user, with raw conflicting profile values preserved for owner review; no name/domain-based merging.

Real Supabase Auth/Data API verification remains a release gate even if local PostgreSQL tests pass.

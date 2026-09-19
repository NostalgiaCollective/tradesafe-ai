# Company and crew onboarding

Scope: existing staging only. No outbound invitation or signup email, credential reset, production change, paid resource or deletion. Provider-assisted synthetic accounts are not delivered-email signup evidence.

## Inspected gaps and bounded checklist

- [x] Existing SQL company creation and owner membership are atomic; same-ID retries are already idempotent. Existing role checks, company isolation, invitation acceptance, expiry/revocation and last-owner protection are retained.
- [x] Retain company/first-draft attempt IDs in tab-scoped storage through interrupted responses and reload. Business name remains the only required setup; optional business details do not change historical snapshots.
- [x] Preserve validated company/list/step destinations through authentication; reject authentication/API destinations and arbitrary query fields. Ask multiple-company users which workspace they intend to use.
- [x] Make pending invitations discoverable for the verified intended account. Add a read-only invitation-context RPC; keep actual access changes in the existing guarded command.
- [x] Keep invitation tokens in private fragments then tab-scoped storage, never query strings, operational logs, analytics or public diagnostics. Explain wrong account, expired, revoked, accepted and removed access separately; retain the invitation through sign-in and reload.
- [x] Put crew invitation controls before optional business details, add copying and immediate list feedback, and explain roles and last-owner protection.
- [x] Focused database and browser verification: no/one/multiple companies, interrupted/duplicate creation, invitation lifecycle, first draft, role/isolation boundaries and historical snapshots.
- [x] Apply only the new read-only migration after isolated staging identity/state checks; preserve all prior migrations.
- [ ] Exact-commit CI, existing staging deployment, hosted checks and final durable delivery receipt.

Detailed test/migration/deployment receipts are maintained in `.staging/reliability-workflow-checkpoint.json` (`onboardingPhase`). Synthetic credentials and invitation links remain in ignored `.staging/` files.

## Physical acceptance, reported September 19

Daniel reports that the tested iPhone report/photo/finalization/PDF/correction workflow is connected and working, and amendments persist. This is user-reported acceptance, separate from automated results. It does not establish untested permissions, other devices, this new onboarding phase, caption persistence as an individually reported check, or production readiness.

Fresh delivered-email signup, isolated restore, qualified safety/content and privacy decisions, operational ownership, capacity/device coverage and billing reconciliation remain separately gated.

## Local verification

54 automated tests passed; lint passed with the existing font warning, typecheck/build passed, and 30 HTTP smoke checks passed. Seven real local Chromium/API/database groups passed against isolated staging. Initial runner failures matched an empty framework alert and waited for unrelated network idleness; selectors were corrected without deleting records. A committed first company was reconciled after runner cancellation. The later expiry test demonstrated and verified the same-tab invitation navigation fix.

The service credential correctly lacks direct invitation-table mutation privileges. Only the newly created synthetic expiry row was dated into the past through the existing staging SQL Editor, scoped by invitation, company and creator IDs. No grants changed. The additive read-only migration was applied once after confirming absence and prior command/admission/template/RLS inventory; anonymous execute is denied and authenticated execute is allowed. No existing migration was replayed.

Tab storage retains operation IDs and invitation context through reload; it does not save report observations offline. Invitation links remain recipient-bound and the original acceptance command rechecks every permission. A lost invitation-creation response may leave a pending link without a recoverable raw token; the owner can revoke it and create a new link. No duplicate company is created by a same-ID retry.

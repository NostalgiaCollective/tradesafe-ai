# Phase 4–6 pilot operations delivery

Completed on `astra/production-mvp` at `5d7a04efd2d021ec67f281381ea9b5f5d594e4b3`.

## Change

Upload and PDF resource logs now include a sanitized stable failure code when work fails. They still exclude credentials, tokens, report/customer text, photo bytes, provider errors and request bodies. The limited-pilot runbook documents health versus identity failures, authoritative-state recovery, incident triage and staging rollback. No migration, dependency upgrade, permission change, billing change or production deployment was made.

## Verification

- [Exact-commit CI run 35482146054](https://github.com/NostalgiaCollective/tradesafe-ai/actions/runs/35482146054) passed lint, 57 tests, browser listing, typecheck, build, 30 smoke checks and `npm audit --audit-level=high` before deployment.
- Render deployment `dep-danjla6k1f9s738vckf0` is Live. Served identity matches the full SHA, `astra/production-mvp`, canonical staging origin and isolated project `yqkiizimbtlygovkscoh`.
- Hosted retained-evidence verification passed: original photo SHA256 `a4afdb8b208e66413d9fb4cdfeeb041134a16519098d79f0a4918ae092428fec`; PDF SHA256 `75e5b18fb9a7bc971399c1fc0dfa3cfbce48511d0862a7ca8bad4c4de7cfd9f9`.
- Hosted interruption suite `.staging/interruption-hosted-788dd4.json` passed 11/11, including upload/PDF lost-response recovery, stale revision protection, account-change rejection and revoked/cross-company denial.
- Hosted non-email signup preflight passed four checks with `emailSent: false`. A first bounded attempt timed out at the protected identity request; it was not treated as a pass and one retry passed.
- Local tests passed: 57 unit/database tests, lint with the existing font warning, typecheck, build, 30 smoke checks and the unchanged high-severity audit gate.

## Open decisions

This supports a conditional limited pilot on isolated staging, not production readiness. WebKit/physical-device coverage, an authorized fresh signup recipient and email test, isolated restore infrastructure, qualified content review, privacy/retention/support decisions, named operational ownership, capacity/device acceptance and billing reconciliation remain open. Daniel’s statement that the current workflow is working as planned is recorded as overall user-reported acceptance only.

The complete decision register is [RELEASE-DECISIONS.md](RELEASE-DECISIONS.md), the runbook is [PILOT-OPERATIONS.md](PILOT-OPERATIONS.md), and the durable checkpoint is `.staging/reliability-workflow-checkpoint.json`.

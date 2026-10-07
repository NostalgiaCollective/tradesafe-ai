# Ontario electrician staging milestone

Baseline `6614b6c5e91cad607e395c1e61c57f6546f03c3c`. Daniel's “All systems go and looking good” is general feedback, not an itemized physical acceptance result. Earlier failures and acceptance history are preserved in the durable checkpoint.

Implementation: Site → Electrical job supplies versioned residential scope, circuit identifiers, business/LEC/personnel/qualification references, unresolved notification applicability, reported inspection outcomes, qualified assessment/procedure references and handover notes. Links reuse existing site briefs/acknowledgements, reports/photos, concerns, Actions and exports. Internal review, documentation, ESA status and certificate-photo attachment are independent.

Focused quality repairs: archived-site SQL errors now retain their actionable API code; a missing electrical return destination is explicitly validated; new field schema is shared by form and recording/export logic and tested against authoritative SQL. Full Windows parallel PGlite execution exhausted V8 memory after adding another integration database; test concurrency is bounded at two without omitting tests or changing assertions. The narrow existing Next glob adapter is unchanged.

Source/review details: `docs/content/ONTARIO-ELECTRICAL-WORKFLOW.md`. Additive migration: `20261007000100_electrical_jobs.sql`. No prior migration or historical template edited. Source prompts remain draft until a separately appointed qualified reviewer records a decision.

Verification pending at implementation checkpoint: exact-commit required quality and local-WebKit CI, one-time staging migration, Render identity, hosted Chromium journey and retained historical hashes. Local SQL tests already exercise scope validation, permissions, direct-write denial, immutable revisions, idempotency, stale saves, draft review state and authorized exports. Actual browser coverage is not inferred from test discovery.

Browser fixture: `tests/fixtures/electrical-job.mjs`; screenshots and hosted receipts will be saved under `test-results/electrical/` and `.staging/electrical-*.json`. Main checkpoint `.staging/reliability-workflow-checkpoint.json` field `electricalWorkflow`. No physical acceptance claimed.

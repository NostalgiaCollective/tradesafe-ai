# Electrical completion evidence and retained handover

Base: `88f6d5aca3e7ba7e34ba1d25298cff029d3a896f`. Feature branch: `astra/electrical-completion-evidence`.

This increment is local/draft-PR work only. No hosted migration, deployment, live account change or merge is authorized. The original development checkout and its untracked research/raw files are preserved.

## Implemented contracts

Action endpoints and limits are documented in [ACTION-COMPLETION-API.md](ACTION-COMPLETION-API.md). Completion notes/photos are separate immutable updates, never amendments to the original author's report. An assigned worker can submit progress or request verification; only existing supervisor/owner transitions verify closure. No notifications are sent.

`GET /api/sites/:site/package?start=YYYY-MM-DD&end=YYYY-MM-DD` authenticates the caller, rechecks current membership and returns `state`, `missingReports` and up to ten of the caller's ready retained generations. A missing PDF requires a separate, bounded `POST /api/reports/:report/exports`; the package endpoint never generates an unbounded collection of PDFs.

`POST /api/sites/:site/package?start=…&end=…&generation=<UUID>` requires same-origin and `X-Expected-Actor`. Owner/supervisor preparation reserves an immutable selection under that stable UUID, checks all attachments, spools the ZIP to private temporary disk, streams it into private storage, rechecks source revisions and current authorization, then records the receipt. A lost response retried with the same UUID returns the same retained bytes. Incompatible source changes require an explicit new generation. Existing worker package access remains permission-scoped and ephemeral; it does not grant access to another account's retained generation.

`GET /api/sites/:site/package?generation=<UUID>` requires the creating account, current owner/supervisor membership and current visibility of included records. It spools and verifies the complete retained ZIP before returning bytes; no public or signed URL is disclosed. Response headers include `X-Package-ID` and `X-Content-SHA256`. Download cancellation can interrupt transport; it cannot change the retained generation. Private temporary files are removed after cancellation/completion.

Limits remain 31 inclusive Toronto calendar days, 200 selected history entries, 100 files, 16 MiB/file. Retained owner/supervisor archives are limited to 50 MiB to fit the existing local Supabase global storage limit; worker one-time archives preserve the existing 64 MiB bound. No storage-plan change is required. Additional bounded snapshot limits: 500 completion updates, 1,000 action history events and 4 MiB structured snapshot. At most 20 retained preparations/site/24 hours, plus existing admission limits. No partial package is labelled complete. Errors include `package_limit`, `package_retention_limit`, `package_generation_limit`, `package_pending`, `package_missing`, `package_changed`, `conflict`, `denied`, `not_found`, and normal session/resource errors.

The package includes selected retained report PDFs unchanged and their source photos; separate amendments keep parent references. It includes exact briefing versions/acknowledgements, concern originals, selected action history, immutable completion updates/photos, and the latest retained electrical-job revision at the cutoff with its referenced certificate/defect evidence. Electrical context may predate the date range and is labelled accordingly. Current action status is distinct from history. No inferred historical values or compliance claim is added.

Consistency is a caller-authorized statement selection, verified immutable object bytes, a second matching selection, and final mutable revision/access checks. It is not an atomic database-and-storage snapshot. The ready ZIP is thereafter immutable; subsequent updates/reopening require a new generation to appear. Revocation blocks later downloads but cannot recall downloaded copies.

## Migrations and maintenance

Three new migrations: `20261012000100_retired_brief_content.sql` (reconciled independent repair), `20261012000200_action_completion_evidence.sql`, and `20261012000300_retained_site_packages.sql`. No applied migration was edited. The new `tradesafe-packages` bucket is private and denies direct authenticated storage access. Guarded server handlers retrieve it.

Unsubmitted photos may be deliberately tombstoned/removed by the current uploader with access or a supervisor. Submitted updates/photos cannot be removed. A storage upload racing cleanup may leave an unreferenced private object; retry the exact tombstoned removal after the upload finishes. No broad destructive sweeper is introduced. Abandoned pending package objects remain private and unissued; automatic reclamation is deferred, not claimed complete.

The existing synthetic restore harness now inventories the new tables/object references and ZIP bucket. Real-data backup/retention policy remains a separate release gate.

## Verification record

Original checkout baseline: 100/100 tests. Integrated local run: 110/110 tests, no skips; fresh and upgrade database behavior included. Subsequent completion-object verification receives focused tests and final CI. Local production build and 37 HTTP smoke checks passed. Audit: zero vulnerabilities. Lint: no errors, one pre-existing Next font warning. Exact final totals and CI URLs belong in the delivery/checkpoint after execution.

Fresh and upgrade PGlite tests execute actual PostgreSQL semantics in a single embedded session, preserving existing originals/evidence and proving guarded behavior. They are not concurrent-transaction evidence. The Linux CI harness separately orchestrates independent PostgreSQL transactions with observed row-lock waits for duplicate retries, stale updates, reassignment and revocation during upload completion. Browser coverage uses a real disposable Supabase database and actual WebKit uploads/downloads. Simulated response loss is explicitly injected. Neither is hosted or physical-phone acceptance.

The review ZIP named by the user was not found in the available files. Its described gaps were independently inspected and repaired; this does not claim to apply or resolve an unavailable external review. See the reconciliation record.

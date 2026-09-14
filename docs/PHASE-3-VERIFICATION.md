# Phase 3 staging verification — 2026-09-14

Private retained photographic evidence and authorized snapshot PDF exports are implemented and verified in **tradesafe-staging `yqkiizimbtlygovkscoh`**. The final real Phase 3 run tested clean application commit **`d9fdb858dac29e6f8b7f4bc5c4753af3f68d40db`** on `astra/production-mvp`, from 11:14:29.885 to 11:15:11.384 UTC. The delivery commit adds documentation only. This is staging evidence, not production approval.

The original project `flhsdtshwwuddzyguyhf` was not modified. No historical schema, database reset, migration replay, production deployment, main merge, checkout enablement, billing change, or AI expansion occurred. Existing synthetic records, prior test evidence, ignored configuration and unrelated `raw/` remain preserved.

## Actual results and provenance

| Check | Result | Tested state / evidence |
| --- | --- | --- |
| Final ordinary-session Phase 3 suite | 14/14 PASS | Clean `d9fdb85`; `test-results/staging-runs/phase3-2026-09-14T11-14-29.885Z.json` |
| Exact removed-object cleanup | PASS, 4 tombstones reconciled | Clean `d9fdb85`; `test-results/staging-runs/reconcile-2026-09-14T11-39-49.629Z.json`; one deliberately late object removed, already-absent objects accepted; referenced ready-photo hash independently verified intact |
| Phase 2 real Auth/RLS/Data API regressions | 15/15 PASS | Phase 3 working tree based on `0ad8b60`, before narrow cleanup repair; `test-results/staging-runs/integration-2026-09-14T10-37-26.610Z.json` |
| Phase 2 desktop/mobile browser workflows | 8/8 PASS, serial | Same Phase 3 working tree; `test-results/staging-runs/browser-2026-09-14T10-38-05.976Z.json`; no completed-onboarding or long natural-JWT-expiry rerun |
| Local tests | 30/30 PASS | Repeated on `d9fdb85`; image validation, transaction/RLS/immutability/export lease tests and existing domain regressions |
| Production smoke checks | 23/23 PASS | Build from `d9fdb85`, including six new fail-closed unconfigured evidence/export checks |
| Lint, typecheck, production build | PASS | One existing layout-font lint warning; PDFKit, sharp and licensed font present in production route traces |
| Dependency audit | Gate PASS | Zero high/critical; one existing moderate unused Anthropic filesystem-memory tool advisory, GHSA-p7fg-763f-g4gf |
| Secret/excluded-work checks | PASS | 33 application files scanned before commit; configured secrets absent from staged files and 61 client artifacts; raw/config/test artifacts excluded |
| PDF visual review | PASS, all 15 pages | Final original 6 pages / 3 photos, phone 4 pages / 1 photo, amendment 5 pages / 2 photos; Poppler-rendered and individually inspected |

Earlier Phase 3 runs (12/12 at 05:35 UTC and expanded 14/14 at 10:32 UTC) remain archived and are not represented as tests of the final clean commit. The failed cleanup inventories at 10:57 and 10:58 UTC are retained alongside the repaired 11:00 UTC inventory. Timestamped raw results are ignored local evidence; this document is the committed summary. CI for the final delivery SHA is recorded after push in `.staging/phase3-delivery.json` and GitHub Actions.

## Meaningful boundaries exercised

The final suite uses existing synthetic owner, supervisor, worker and outsider identities. Authorization assertions use ordinary Supabase Auth cookies/JWTs against real Auth, Data API and Storage endpoints. Administrative access is explicitly limited to constructing missing-object/interrupted-completion fault fixtures and testing safe operator cleanup; it is not RLS evidence.

- Desktop upload, truthful saved feedback, authenticated preview and saved-draft reload; uploader identity and server upload time retained with normalized-byte hash and safe UUID path.
- Invalid/oversized image bytes and malformed caption rejected before reservation; ten-photo limit; worker denied editing another author's draft. Local tests additionally exercise decoded pixel limits, format/animation handling and EXIF removal.
- Cross-company requests and guessed paths denied; direct metadata writes, completion/export/cleanup RPC bypasses denied. Ordinary Storage upload/upsert/sign/download/public-path attempts fail; deletion attempts leave authorized bytes intact.
- Pending upload blocks finalization. Same-byte retry and a deliberately lost response after remote completion do not duplicate evidence. Stored pending bytes reconcile only after integrity verification.
- Actual simultaneous upload/finalization requests either report the pending barrier or include the completed photo; the eventual finalized snapshot contains exactly the retained photo. Finalized attachment/removal/replacement attempts fail.
- Authorized draft removal returns a tombstone and accurate cleanup feedback; subsequent photo access fails. A deliberate late arrival at the removed object's exact path is safely reconciled without deleting referenced evidence or metadata records.
- PDF generation and download require current membership, including retry of an existing export. Anonymous, cross-company and wrong-origin requests fail; direct export bucket and metadata mutation bypasses fail.
- Missing-photo setup first exercises a live export lease, then durable `evidence_missing` failure. No partial PDF is returned. Restoring the exact expected bytes permits ordinary retry. No referenced evidence was deleted to manufacture this fixture or obtain a passing result.
- Phone upload/review and actual download button pass without horizontal overflow. The amendment retains its own two photos and finalized PDF; the original export remains unchanged.
- Removing membership denies photo/PDF download and generation using the already-existing browser session; the already-issued JWT sees no evidence/export metadata.

## Applied migrations and reconciliation

The three Phase 2 files were hash-checked against the previous journal and actual schema before changes: baseline `2b4eba5bfe820cf50083ec905f75eb898daedf90e71f99d59c95023ca940773d`, company workflow `2253ec31e618ed0bc58316325bc7df241a534d8ac45960ed3ce4808da9b9ee1d`, template v1 `40eb0b5da7e98d21e9352c341ec78e53b97f252b5039d0678bae3b5d2fc433eb`. Read-only staging checks confirmed 13 RLS public tables, three templates, expected workflow/finalization guards, no Phase 3 objects/buckets, and absent CLI migration history. They were not replayed.

Both reviewed additive migrations were executed once through the verified staging SQL Editor on 2026-09-14 and returned success:

| Migration | SHA256 | Actual post-application evidence |
| --- | --- | --- |
| `20260913000100_private_evidence_exports.sql` | `6153aaf9f97e1ee1e4424bc6821e37e2bb61265274c72122676f5ea149621dcb` | Both new tables RLS-enabled; ordinary direct writes and privileged completion/export RPCs denied; service completion allowed; both buckets private with 3 MiB/32 MiB limits; restrictive Storage policy present |
| `20260914000100_evidence_cleanup_guard.sql` | `7e51eef2d40a27dabdb5d244cf2a0b7cc87396a23fd43b2d2911a1e571c0a22f` | Narrow service-only cleanup candidate function resolves observed 42501 without granting broad report reads; repaired inventory, ordinary function denial, authorized app removal and exact operator cleanup pass |

The cleanup repair is a forward migration; the original applied migration remains unchanged. **CLI history is still absent. Do not run `db push` or replay files.** Future work must reconcile this journal, hashes and actual catalog first.

## Export inspection and operational contract

Representative PDFs are retained under `test-results/phase3/2026-09-14T11-14-29.885Z/` and the latest convenience files `finalized-with-photos.pdf`, `phone-export.pdf`, `amendment-with-photos.pdf`. Final render images are `final-original-1..6.png`, `final-phone-1..4.png`, and `final-amendment-1..5.png`. All pages were inspected: identity/creation/finalization/template data, explicit answers/findings, readable page breaks, every photo/caption/upload attribution, and limitations are present without clipping or overlap. The original PDF preserves the amendment's draft status at its export cutoff; the later amendment PDF identifies its original. No digital-signature, legal-compliance or PDF/UA claim is made.

See [implementation and design API contract](PHASE-3-EVIDENCE-EXPORTS.md) for permissions, endpoint/error shapes, 3 MiB / 20 MP / 10-photo limits, non-atomic upload reconciliation, tombstone cleanup, two-minute export lease, immutable versioned exports and required server/font/native-runtime setup. No signed URLs are issued: every new byte request rechecks membership. Already-delivered bytes cannot be recalled. Later corrective-action history is explicitly excluded from the original PDF and remains in the authorized Actions view; amendment indexing is labelled with the export cutoff.

## Remaining production blockers and next task

Qualified content review; supported account recovery and controlled email delivery; privacy/retention/deletion policy and consent; abuse/rate/storage/CPU controls and monitoring; backup/restore drill; secret rotation and production deployment verification; and billing reconciliation remain open. Checkout stays disabled. Failed/unreferenced PDF attempt objects are conservatively retained pending an approved retention policy. AI expansion remains deferred.

Next bounded task: implement and verify supported account recovery in isolated staging, including safe redirects and controlled real email delivery. A retention policy decision is required before accepting customer photographic evidence. Recovery/delivery instructions are in [the durable checkpoint](staging/PHASE-3-CHECKPOINT.md).

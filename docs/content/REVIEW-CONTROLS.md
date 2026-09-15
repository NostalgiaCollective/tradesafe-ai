# Safety content review and release controls

Audit date: 2026-09-15 UTC / September 14, 2026 in Ontario. This is a source audit, **not qualified content approval**.

## Findings and scope

Audited public home, layout metadata, all three trade pages and shared detail component, sign-in copy, all 51 template items, report creation/editor/finalized/legacy views, PDF generator/export UI, and the photo-analysis API instructions.

- Removed unsupported public certification/completeness claims: “MOL Certified Process”, “code-compliant” documents, “every code requirement”, “full” code checklists and PDF code-reference claims. Public pages now describe observation topics and link official context. No visual redesign.
- Removed public blanket EV-readiness, notification/inspection, fixture-limit and roofer certification claims. Their original checklist wording remains in frozen v1; each issue has a candidate and uncertainty record in [the matrix](REVIEW-MATRIX.md).
- Replaced obsolete public College of Trades attribution. Individual compulsory-trade authority, electrical contractor licensing and voluntary Roofer credentials are different questions. Source: [Ontario compulsory trades guidance](https://www.ontario.ca/page/compulsory-trades-and-enforcement), [STO Roofer profile](https://www.skilledtradesontario.ca/trade-information/roofer/).
- Photo AI instructions no longer impersonate a qualified inspector or request code violations/citations without verified text. They require visible observations, uncertainty and separation of installation/workplace safety. This is a prompt constraint, not a guarantee of model output. No live paid model request was made.
- Existing report/PDF limitations already distinguish observation finalization from certification and typed attribution from digital signatures. Those renderers, finalized snapshots and retained PDF bytes remain unchanged. Historical wording is visible with the existing pending-review notice.

## Edition, amendment and transition reconciliation

**Electrical:** 2024 OESC is the 29th edition, effective May 1, 2025; never rename it “2026 OESC”. ESA's FAQ Q4–5 ties earlier editions to notification/plan submissions and expiration, including residential notification inspection timing and consequences of electing newer rules. The FAQ cover incorrectly says 28th; the main ESA page identifies 29th. Confirm project history and ESA direction, rather than selecting by today's date. [Official FAQ](https://esasafe.com/assets/files/esasafe/pdf/About_ESA/2024-OESC-FAQs.pdf).

The June 22, 2026 Director's Order OESC-01-2024 rev 0 takes effect July 6, 2026. It replaces 2-010(1)(e) with a plan-review trigger above 12 kW for Section 64 installations or bidirectional EVSE. Other triggers are not displaced. This is not an installation-compliance finding. [Order](https://esasafe.com/assets/files/esasafe/pdf/About_ESA/Directors-Order-OESC-29thEdition-Final.pdf), [ESA plan-review context](https://esasafe.com/business-and-property-owners/electrical-plan-review/). Selected notification provisions 2-004/2-005 were read in the public Ontario amendment PDF; the complete copyrighted CEC/OESC and full current bulletin collection were not accessed. No claim of exhaustive order/bulletin review.

**Building:** the 2024 OBC initially took effect January 1, 2025. Current official indexed O. Reg. 163/24 is consolidated from July 22, 2026, last amendment 242/26, incorporating Ontario amendments dated July 17, 2026. History lists 203/24 (as amended by 447/24), 5/25, 247/25, 110/26, 119/26 and 242/26. Section 2 preserves specified 2012-code projects with permits issued by December 31, 2024, or plans substantially complete by that date and permit applications by March 31, 2025; construction must commence within six months of permit issuance. Confirm actual records. [Current regulation](https://www.ontario.ca/laws/regulation/240163), [242/26 commencement](https://www.ontario.ca/laws/regulation/r26242).

The accessible Publications Ontario compendium identified in search is dated January 16, 2025; it is insufficient to establish the current July 2026 technical provisions. Full current incorporated plumbing/roofing text and amendment deltas remain unverified. Direct Ontario page fetches failed; successful official indexed excerpts are explicitly distinguished in the matrix. No rule numbers have been supplied for those unreviewed technical items.

**Workplace:** O. Reg. 297/13 indexed consolidation starts January 1, 2021 (last amendment 751/20); ss.6–8 concern specified fall-protection methods and training, generally three-year validity. O. Reg. 213/91 current indexed history includes 112/26 and 116/26, consolidation from April 20, 2026. Complete current ladder/scaffold/fall technical provisions were not reviewed; an older `/v1` ladder excerpt was excluded from current-law findings. These are occupational duties, not OESC installation requirements. [Training regulation](https://www.ontario.ca/laws/regulation/130297), [Construction Projects regulation](https://www.ontario.ca/laws/regulation/910213).

## Minimal architecture

- Frozen `lib/domain/templates.ts` and `20260911000300_template_v1.sql` remain unchanged.
- `safety-review.json` is a versioned evidence record with all stable IDs, original wording, source locator, provision verification, jurisdiction, edition, effective context, check date, provisional classification, applicability, uncertainty and separate qualified-review fields.
- `getContentReview` returns a detached copy. `getCandidateTemplate` creates `2026-09-15-candidate-v2` with the provenance embedded, original-version reference and candidate wording. It fails if evidence no longer matches the historical question. There is no approval setter, promotion endpoint or automatic date-based template selection.
- Candidate IDs are absent from `ts_templates`; existing database report creation rejects them. The app still creates published v1 reports. Candidate review is a repository review task, not an administration system.
- No migration is necessary for an unpublished candidate. No staging migration was applied or replayed. A later qualified release needs a new immutable template insert, reviewed source/approval snapshot, explicit activation and reconciliation of migration history. It must never update previous templates or reports in place.
- A source checker cannot confer professional approval. Any eventual approval must identify a qualified reviewer, scope, exact candidate/source version, date, limitations and project applicability basis. All current approval fields remain pending/null.

## Decisions for qualified reviewers

1. Electrical reviewer: determine exact trade/licensing provisions and exceptions; review full licensed code/bulletins; GFCI/AFCI circuit/location scope; EV readiness versus equipment installation; ESS and plan review; conductor sizing; panel labels; enclosures; grounding/bonding; acceptance/energization boundaries.
2. Plumbing reviewer: reconcile current Part 7 and transitions; validate or replace 1:50 and 4.8 L claims with conditions; materials and product standards; backflow hazards; pipe supports; AAV and venting conditions; inspection-stage requirements. Decide whether duplicate credential items should be retired under a new ID/version policy.
3. Roofing/building reviewer: permit scope, structural design, roof assembly/eave/drainage conditions and actual product standards. Do not generalize underlayment UV requirements. Voluntary credential fields must remain optional where appropriate.
4. Occupational reviewer: reconcile current 213/91 and 297/13 provisions, training equivalencies/validity, site hazards, systems, ladders and scaffolds. WSIB legal mapping and exemptions, insurance contracts and waste/asbestos obligations need separate review.
5. Product/release owner after qualified review: determine sufficient project applicability fields (notification, plan, permit, construction start, scope/occupancy, location and authority direction) before activating a reviewed template. Today’s work date alone is insufficient. No professional approval or activation occurred in this task.

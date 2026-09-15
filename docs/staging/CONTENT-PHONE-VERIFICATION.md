# Content provenance and physical-phone continuation

Updated September 15, 2026 UTC (September 14 in Ontario). This supplements historical deployment receipts; it does not replace their evidence.

## Staging baseline

- Canonical service: https://tradesafe-staging-yqkiizimbtlygovkscoh.onrender.com
- Render `srv-dak9925g1s2s73bg1a4g`, Free, Ohio, manual deployment; branch `astra/production-mvp`.
- Before this content task: deployed commit `f8218247e5a7595bcd74bfb6b58cdb97dfca3b0b`, deploy `dep-dak9igou01pc73eb2eg0`, CI `34915479715` passed. Automated hosted gate/auth/draft/photo/PDF checks passed. Retained desktop and mobile PDF hashes are in the durable checkpoint and acceptance artifacts.
- The earlier Add Card blocker in `OVERNIGHT-DEPLOYMENT.md` was subsequently resolved by the user personally. No agent payment action occurred. Free resources and manual deployments remain the boundaries; production and checkout remain unchanged.

## Physical phone evidence

Device: user reports iPhone 14 Pro Max, Safari; iOS version unknown.

| Check | Manual observation |
|---|---|
| Staging gate/site access | USER-REPORTED success only |
| Account login | Pending |
| Create/resume synthetic draft | Pending |
| Attach harmless photo | Pending |
| Save/reload and photo retrieval | Pending |
| Open PDF | Pending |
| Fresh phone recovery | Not requested; wait until user is ready |

Pending one-action instruction: tap Sign In; report the resulting screen, or report an already-visible account form. Do not infer an account session from passing the HTTP Basic gate.

The 8:49 PM recovery email was requested by the prior hosted recovery runner at 2026-09-15 00:49:58 UTC and automatically consumed by 00:51:47 UTC. Its completed result is preserved. No further recovery email was sent for this task; the user should leave that old message unopened. Do not include recovery tokens or URLs in evidence.

## Content task

[Review matrix](../content/REVIEW-MATRIX.md): all 51 items; [controls and reviewer decisions](../content/REVIEW-CONTROLS.md). Public claims corrected; AI instructions constrained; candidate version `2026-09-15-candidate-v2` remains unpublished and pending qualified review. Frozen template module, migrations, finalized reports and retained PDFs unchanged. No database migration needed or applied.

Local validation: 39 tests passed, including all-trade published snapshot equivalence, detached candidate provenance and database rejection of candidate IDs; typecheck/build passed; 30 HTTP smoke checks passed; browser suite discovery found 10 tests. Lint has zero errors and the pre-existing font warning. Dependency audit has no high/critical issue; existing moderate Anthropic SDK memory-tool advisory remains (no broad dependency change in this bounded task).

Commit, CI, deployment and post-deployment evidence are recorded in `.staging/physical-phone-checkpoint.json` under `contentReview`. That ignored checkpoint holds no secret values. Private credential files remain ignored and are not copied into documentation.

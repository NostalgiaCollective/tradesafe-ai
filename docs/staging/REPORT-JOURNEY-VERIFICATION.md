# Focused report journey — September 17, 2026

Recovered branch `astra/production-mvp` at `0e01764b0e4d8027eb1b41388089eb5164ea8a9c`; remote and hosted staging matched. No newer work was rolled back. The only unrelated working-tree content was `raw/`, preserved. Delivery receipts and the exact recovery action are maintained in `.staging/reliability-workflow-checkpoint.json`.

## Bounded changes

- Dashboard gives the latest personal draft a prominent Resume action. New-report creation explains the saved draft and the next steps.
- Four stages: Job details, Observations, Photos, Review. Existing step-2/3/4 links retain their meaning; Photos uses step 5 internally. Stage changes preserve the document, selected file and caption in this open page. No offline persistence is promised.
- Optional notes and company metadata are collapsed. Photo controls precede saved thumbnails; users see the filename, input size, caption, pending state and nearby recovery messages. Interrupted uploads lock the original selection until a stable-ID retry confirms the result. Troubleshooting remains collapsed and available.
- Review links each missing item to its field and focuses it. Selected or incomplete photos block finalization with an explanation. Finalization explicitly explains the locked original and separate amendments.
- A primary Open PDF action appears immediately below the finalized report title. It prepares/reuses the retained export and opens it in a new tab; a prepared-file link and download action support browser fallback. Make a correction links to the separate amendment form.
- Larger touch targets, mobile 16px inputs, focus/scroll handling and live feedback support mobile and keyboard use. This is functional cleanup, not a visual redesign.

The initial hosted mobile-sized inspection found photos approximately 7,196 pixels down the observation page (total height 8,337). The separate Photos stage removes the need to scroll through observations to upload. Detailed layout measurements and screenshots are in ignored journey journals/test artifacts.

## Verification and recovery

`node --use-system-ca scripts/staging/report-journey.mjs` exercises local staging using existing synthetic accounts and the approved Chromium runtime. For hosted verification, set `EXPECTED_COMMIT` to the exact deployed SHA and add `--hosted`. Never run against production. The script journals report/amendment IDs before dispatch and preserves all test records. Completed checks are reused; inspect the journal and deployment identity before rerunning. A prior pass is not new-build evidence.

The focused harness covers actual UI creation, field-linked validation, navigation/input retention, expired-session sign-in recovery, dashboard resume, a recognizable synthetic orange-cone JPEG padded with valid JPEG comments to 3,600,000 bytes, required captions, finalization blocked by an unsubmitted photo, a real server upload whose successful response is deliberately interrupted, same-ID retry and duplicate taps, reload/full-image/caption persistence, finalization, PDF opening/download/content, separate amendment persistence, original byte hashes, immutable-save rejection and cross-company/anonymous denial. Response interruption is fault injection around a real server request, not a mocked successful integration. Chromium mobile emulation is not physical Safari evidence.

Existing historical browser harness selectors were aligned with the new stage/label/PDF controls; their full historical suites were not rerun. The separate `photo-feedback-browser.mjs --chromium` check passed empty selection, oversized input, validation/session/gate/permission/network failures, retained selection, progress, successful acknowledgement with list-refresh failure, and controls disabled without hydration. Upload responses in that check are intercepted UI tests, not real integration evidence. The runtime flag selects the already approved Chromium engine without attempting blocked WebKit.

PDF text and rendered pages are inspected with existing Poppler tooling. Artifacts are `test-results/journey-local/` and `test-results/journey-hosted/`; ignored `.staging/journey-{local,hosted}.json` contains the measurements, IDs, hashes and results. One initial local harness attempt used an incorrect exact accessible name for the full-image link; its synthetic report/photo remain preserved and the selector was corrected. Do not confuse that harness timeout with an application upload failure.

Local verification passed the complete real-browser flow above; 50 automated tests, typecheck, production build and 30 HTTP smoke checks pass. Lint has zero errors and one pre-existing font warning. All four rendered PDF pages were visually inspected. Photo controls now begin around 939 pixels from the page top in the measured mobile layout, accessible directly through the Photos stage. Screenshot inspection caught retained scroll after finalization; navigation now lands at the PDF section, and a focused local test verified that Open PDF is in the mobile viewport. Exact CI, hosted results and final deployment identity are recorded in the durable checkpoint after delivery.

## Physical evidence and limits

Daniel explicitly confirmed on iPhone Safari: a new photo uploaded; after reload its thumbnail and full image displayed correctly and the photo remained retained. Record these as user-confirmed passes only. The latest statement does **not** establish caption persistence, PDF acceptance, amendment acceptance, exact file size, build or device version.

Physical acceptance for the changed flow remains pending: sign in, resume/create a synthetic draft, enter job details and observations, move back and forward to check retained input, select a recognizable photo and caption, upload and wait for Saved, reload and check caption/thumbnail/full image, use a Review missing-field link if offered, finalize after reading the explanation, open the PDF and check text/photo/caption, then create an amendment, change one field, wait for Saved and reload; confirm the amendment persists and the original remains unchanged.

Windows Code Integrity blocks WebKit; no security bypass was attempted. Fresh signup email authorization, isolated restore infrastructure, qualified content/privacy review, named operational ownership, capacity/device acceptance and billing reconciliation remain governed by [the decision register](RELEASE-DECISIONS.md). No production-readiness claim is made.

No migrations, email, credential changes, paid resources or billing changes are part of this phase. Authorization, private storage, immutable finalized evidence, historical PDF hashes, 5 MiB input / existing normalized-output limits, 20 MP, 10 photos, supported formats and EXIF removal remain intact. Production, original Supabase, disabled checkout and branch-only Vercel suppression are preserved.

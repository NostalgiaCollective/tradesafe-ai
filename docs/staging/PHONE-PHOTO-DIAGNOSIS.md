# Physical phone photo upload diagnosis — 2026-09-15

## Manual evidence

User reports iPhone 14 Pro Max / Safari account sign-in, report reload, electrical draft creation, and job-address autosave/reload passed. These supersede the earlier pending login observation without erasing it.

Photo upload is **failed/pending**: selecting IMG_5197.jpeg with caption “Mortar relief” and tapping Upload photo produced no visible response. Selection remained and no retained photos were listed. Physical photo retrieval and PDF checks remain pending.

## Confirmed diagnosis

On the deployed pre-fix version, a WebKit mobile test using the existing account and an intercepted synthetic 422 upload response reproduced the feedback defect. The handler sent one POST; its button had no parent form, so unrelated report validation did not prevent submission. The error was at viewport coordinates -69 to -44 pixels, entirely above the visible area. File and caption remained selected.

Read-only inspection of an editable account draft returned HTTP 200 and zero ready/pending evidence rows. This does not identify the user's particular file rejection: the physical file's bytes, size, dimensions and request response are unavailable. There is no evidence to conclude oversized file, timeout, expired session or server failure caused that specific attempt. Browser emulation is not physical Safari evidence. No test writes were made to the inspected draft.

## Correction

- Upload status, saved confirmation and actionable errors appear directly beside Upload photo. Completed operations scroll that feedback into view.
- Busy status explains that upload/content checks are underway; it does not present a fabricated transfer percentage.
- Gate/session expiry, network failure and non-JSON responses provide recovery instructions. Failed requests preserve the selected file, caption and idempotent upload identifier.
- A confirmed saved upload remains confirmed even if refreshing the list fails. A separate refresh warning explains the next action.
- Oversize rejection reports the selected file size and existing 3 MiB limit. Server image decoding, 20 megapixel limit, MIME/content validation, EXIF removal, authorization and storage controls remain unchanged.

## Verification

`scripts/staging/photo-feedback-browser.mjs` exercises Chromium and WebKit with mobile dimensions. Intercepted cases cover oversize/no POST, server validation, session expiry, staging gate, denied permission, network failure, visible progress, acknowledged save followed by failed refresh, selection retention and unchanged retry IDs. Actual evidence endpoints reject missing sessions. It performs no evidence writes and never sends recovery emails.

Local: 16 browser checks passed; 42 unit/database/image/authorization/session tests passed; lint passed with the existing layout font warning; typecheck, production build and 30 HTTP smoke checks passed. Exact commit CI/deployment and hosted results are recorded in `.staging/physical-phone-checkpoint.json` and `test-results/photo-feedback/` after execution.

No migration, credential reset, recovery email, production change, visual redesign or historical report/PDF modification is included.

## Failed physical retest and staging trace

The user subsequently reported another physical Safari failure after deployment of 305e27e: a selected photo and caption followed by a tap produced no visible change. The phone's loaded build was not observed. The earlier feedback fix is insufficient evidence of physical success.

The follow-up adds a staging-only diagnostic box beside Upload photo. It shows the page's server-rendered commit, a fresh server identity check, client readiness, disabled/busy state, whether file/caption state exists, generic client-error count, and a bounded sequence of pointer/handler/validation/request/response/save stages. It never displays credentials, tokens, filenames, captions, image contents, account data or raw exception messages. Before client hydration it still shows the page build and `Client: waiting`. Production has no diagnostic box or identity request.

The former input-dependent disabled button gave no explanation when input state was missing. Upload now provides explicit missing-file/caption validation on tap and reads the selected native file at submission. File controls stay disabled with a loading explanation until hydration, preventing an early selection that React has not observed. Report-finalization and in-flight operation locks remain enforced. These changes address observable UI weaknesses; they do not establish the cause on the physical phone.

Expanded regressions use touch taps through the actual report UI on the separate synthetic draft with all observations unanswered. Tests check the center-point hit target, absence of parent form, visible missing-input feedback, all previous failure/retention/idempotency cases, and controls locked before hydration (JavaScript disabled). Hosted tests additionally compare page/server build labels with the exact deployed commit and check the pointer-to-save trace. Manual evidence remains failed/pending until the phone identifies its build and execution stage.

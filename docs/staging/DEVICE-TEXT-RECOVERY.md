# Recoverable field text

Staging-only concern and daily-brief editors offer **Keep unfinished text on this device**. This extends their existing save commands and revision checks; it does not cache authenticated pages or install a service worker.

## Supported scope

- Existing concern drafts and new, not-yet-created concerns: observation, location and immediate-step text. A new concern receives a stable UUID in its recovery URL before editing. After an ambiguous create, recovery fetches that ID before any save; it does not create another record.
- Existing daily-brief drafts: work description and task-step/hazard/control text. A new daily brief must first be created on the server. Crew, attendance, acknowledgements, dates, implementation assertions, assignments and commands are not retained locally. Applying changed hazard/control text resets the corresponding control to Proposed. Other current server fields remain current.
- Recovery after reload or browser closure requires reopening the application online, signing in as the same account, and passing current membership and record-edit checks. Local text is never automatically uploaded after reopening. The user compares it with the current server text and explicitly chooses **Use device text in current draft** or **Keep server text**. A second revision change refreshes the comparison. Normal save commands still reject races after that check.

## Device storage contract

The origin-local browser store has a versioned prefix and authenticated-user/company/kind/draft identifiers. Text projections and the server text/revision baseline are whitelisted; no photographs, credentials, acknowledgement/signature material, or submission/finalization/verification commands are written. Copies expire seven days after the last local edit. Limits: ten drafts, 1 MiB aggregate serialized UTF-8 data, 128 KiB per copy. Quota/storage failures preserve visible text and do not claim device success. Writes happen during editing, synchronously confirmed by reading back the value; browser-close events are not the persistence mechanism. A token detects conflicting local writes from another tab rather than overwriting them.

This is plain browser storage, not encrypted by this feature, not durable backup, and not a complete offline application. Browser data clearing, private-browser policies and device loss can remove it. Offline launching/sign-in and recovering unsaved file selections are outside scope.

## Access and removal

**Device drafts** is a secondary link in the existing workspace, not another dashboard. Its text and record links are shown only after authenticated server access checks. No service-role bypass is used. Revoked/denied copies are removed on a recovery/list access check; network failures retain the copy without revealing recovered text. Logging out prompts before deleting all device copies. Switching accounts removes previous-account copies; they are neither shown nor submitted under the new account. Opt-out and **Remove device draft** require confirmation. Server-confirmed text removes its matching local copy, without deleting a newer copy from another tab. Expired/unreadable entries are purged on the next storage check, not by a background retention service.

Existing finalized records, briefing acknowledgements, report exports and photographs are unchanged. Recording/submitting still requires the existing online UI action. No migrations or provider configuration changes are needed.

## Verification records

The durable checkpoint and `.staging/field-drafts-*.json` distinguish unit tests, disposable Ubuntu WebKit execution, local Chromium with staging synthetic records, and final hosted Chromium. Injected connection/response failures are simulations; browser storage, server persistence and authorization assertions are real integrations. Physical iPhone acceptance is separate and pending until Daniel confirms it.

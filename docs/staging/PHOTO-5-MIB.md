# 5 MiB photo input

Photo input now accepts up to **5,242,880 bytes (5 MiB), inclusive**. Client selection validation, server Content-Length and streamed-body checks share `lib/evidence/limits.mjs`. The mobile message states the exact limit and retains the selected file and caption on rejection.

JPEG, PNG and single-frame WebP remain supported. The 20-megapixel decoded-input limit, 10 ready/pending photos per report, required caption, authorization and private access remain unchanged. Normalization still applies orientation, removes EXIF, flattens transparency, resizes within 2400 pixels and encodes JPEG at quality 85. The normalized result must still fit **3 MiB**; that independent guard matches the existing database constraint and private JPEG-only storage bucket. Raw uploads are never stored. No migration or storage-policy relaxation is needed.

The browser sends the file as `application/octet-stream`, with caption and evidence ID in headers. There is no multipart/base64 request-body overhead. The installed Next.js proxy default is 10 MB, above the 5 MiB body boundary; no proxy or unrelated endpoint limit changes are needed. Hosted boundary verification checks the actual browser-to-staging path.

PDF export remains capped at 32 MiB, with existing authorization, integrity, immutable-snapshot and missing-evidence safeguards. The automated size test renders ten maximum-size normalized JPEGs under this budget.

## Verification and recovery

- `npm test` covers a deterministic valid JPEG between 3 and 5 MiB, exact 5 MiB input, one byte over, Content-Length and streamed rejection, normalization/EXIF stripping, and the ten-photo PDF budget. Existing evidence/security tests remain in the suite.
- `node --use-system-ca scripts/staging/photo-limit-browser.mjs --hosted` with `EXPECTED_COMMIT` set to the full deployed SHA uses actual WebKit mobile file uploads. It checks visible rejection above the limit, successful larger/boundary uploads, privately retained normalized bytes, photo and caption persistence after reload, and export on a dedicated synthetic report.
- `node --use-system-ca scripts/staging/photo-feedback-browser.mjs --hosted` checks mobile Chromium/WebKit feedback and retry behavior with intercepted failures. It supplements the real upload test.

Run these browser scripts serially because they use the same synthetic account. The real-upload receipt records its report ID immediately and supports recovery without recreating or rewriting a completed report. A receipt from a different hosted commit must be archived before a new run. Local real-upload testing already passed before resumption; preserve its original evidence.

Current delivery status, commit, exact-commit CI, deployment and recovery action are saved in ignored `.staging/photo-5mib-recovery-checkpoint.json`. Hosted real-upload results are saved in `.staging/photo-5mib-hosted.json`; supplemental results are in `test-results/photo-feedback/hosted.json`. These files contain verification provenance and are not substitutes for physical-device results.

## Combined iPhone retest

On the staging site in iPhone Safari, upload the previously rejected 3.45 MiB photo with a caption, wait for **Saved**, reload, and confirm that both the thumbnail and caption remain. Physical sign-in, dashboard reload, draft autosave and a smaller upload previously passed. This larger-photo/reload retest remains pending until the user performs it.

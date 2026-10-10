# Minimal pilot measurement

This offline tool is available for supervised rehearsal. It does not install analytics, capture browser activity, read databases or send information. No task observations have been collected from customers in this milestone.

Run on a reviewed local file:

```text
node scripts/operations/summarize-pilot.mjs tasks PRIVATE_OBSERVATIONS.jsonl
node scripts/operations/summarize-pilot.mjs logs PRIVATE_SANITIZED_EVENTS.jsonl
```

Keep inputs in ignored `.staging/` with existing private-file controls; never commit or upload raw logs. The tool writes only an aggregate report to stdout. Review even aggregates before external sharing. It fails with a generic error and no partial report on conflicting trials, invalid task fields or bounds violations. File paths and input values are not echoed in errors. It performs no automatic retention or cleanup.

## Task observations

One JSON object per line. This is a **synthetic schema example**, not a measured result:

```json
{"event":"pilot_task","trial":1,"week":1,"business":"B1","role":"worker","task":"concern","evidence":"observed_field","outcome":"complete","start":"warm","durationMs":45000}
```

Only these exact fields are accepted. No free text, record IDs, user IDs, route/query, email, company name, photo or device-storage data. Business labels B1/B2/B3 are local cohort aliases; keep any mapping separately private. A trial is an operator-issued positive integer, unique across the selected input window. Reimporting the same trial is counted once; conflicting outcomes fail until the observer resolves the record, rather than silently replacing it. Field-order differences do not alter grouping.

Week: 1–4. Role: worker/supervisor/owner. Task: onboarding/sign_in/recovery/brief/acknowledgement/concern/progress/verification/export/resume. Evidence: automated/observed_field/customer_statement. Outcome: complete/assisted/failed/abandoned. Start: warm/cold/unknown. Duration: integer milliseconds, 0–86,400,000. Customer statements must omit duration and use unknown start; they cannot supply measured timings.

An observer starts timing at the agreed task instruction and stops on checked completion/failure/abandonment. Confirm completion by the authorized saved record and reload/export when relevant, not a click or a success toast alone. Assign a fresh trial for a new independent attempt; retries within one task stay one trial. Keep failed and abandoned attempts. Do not log a statement as observed_field. Cold requires an observed hosting-idle/restart context; otherwise use unknown.

Output groups by week, business, role, task, evidence and start condition. Each group contains counts by outcome and median/nearest-rank p95 duration with sample count. No readiness verdict or statistical significance is inferred. Customer statements have zero timing samples. Compute independent completion as complete divided by all outcomes, keeping assisted separate. Different evidence types never share that denominator.

## Existing operation events

Logs mode recognizes existing `request_failed` with a known application error code, `resource_work` for upload/pdf with complete/failed and integer duration, and `recovery_dispatch` provider_unconfirmed. Other fields are dropped, never echoed. Unknown/malformed lines are counted as ignored. A known resource event with invalid timing fails rather than contaminating performance results. The operator must inspect aggregate ignored counts for coverage; this is not a lossless log archive.

No route, actor, payload, provider error, arbitrary failure text or identifier is emitted. Resource failures may also create request_failed entries: **do not add the two counts as distinct incidents**. These logs lack total requests and cannot provide availability, task completion, unique incidents or error-rate denominators. Recovery provider acceptance/unconfirmed events cannot prove inbox delivery. Use a time-windowed operator-selected file; the tool does not infer dates from provider log prefixes. Supply JSON event messages one per line, not full provider log exports containing unrelated data.

Bounds: 8 MiB input, 16 KiB per line, 10,000 nonblank lines. File streams use 16 KiB chunks; results remain bounded. The operator must narrow an oversized window. No silent truncation. Raw local files may contain sensitive data even when aggregate output does not; do not export them to a new destination without authorization.

For real-data collection, approve purpose, consent, access and retention through the readiness matrix first. Proposed retention and operator responsibilities are in the pilot runbook. Existing application feedback already supplies a private support reference, route without query parameters, version and server time; do not build another feedback database.

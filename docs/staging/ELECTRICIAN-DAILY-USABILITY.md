# Electrician daily-work usability

Baseline: `06d6a3bb0c85c87dbd826726eeacf4bb1997d83e`. The existing electrical migration is already applied. This change needs no migration and leaves source content, report snapshots and export formats unchanged.

## Demonstrated gaps and repairs

* Electrical-job links allowed unsaved text to be discarded during in-app navigation. Hosted Chromium reproduced this on the baseline. The job now uses the existing unsaved-work guard, including unrecorded review/check notes. Inputs wait for the client request controller before allowing editing. Successful review/check recording clears the submitted note.
* The observation/photo link always opened a new report. The existing electrical page now offers authorized saved reports and briefs, a direct resume action, and separate links for new work. Workers' follow-up counts are limited to assigned actions; supervisors see their authorized site counts. Retrieval is company/site scoped, RLS filtered and bounded to eight recent links of each kind, with routes to the complete lists. No observation bodies or photo bytes are fetched for this navigation.
* Missing-documentation reminders named problems without opening the field. Each reminder now reveals and focuses its field; Inspection records opens the reported ESA status. Read-only users reach the containing section. Brief/report return links retain the job route, and navigation storage retains only panel/scroll position. Saved revision downloads explicitly exclude unsaved changes and direct users to Daily handover for current outstanding actions.

Internal review, user-recorded ESA status, certificate-photo evidence and documentation status remain independent. No new legal requirement or qualified approval is introduced. Existing electrical revision export wording/order is preserved by mapping field-linked reminders back to the original strings.

## Verification contract

`tests/electrical-job.test.mjs` covers real reminder destinations and validated return routes, alongside the existing database authorization/revision/immutability tests. `tests/fixtures/electrical-job.mjs` extends the existing browser journey with field focus, unsaved navigation, report/brief resume, return position, saved-export boundaries and mobile/desktop captures. Its connected workday also checks worker/supervisor follow-up counts against persisted assignment.

Run required `quality` and `local-webkit` jobs on the exact release commit before Render deployment. WebKit executes against disposable local Supabase on Ubuntu, not an iPhone. Local Chromium with the isolated staging database and hosted Chromium are recorded separately. Failed attempts stay in the local receipts; neither discovery nor skipped checks count as executed coverage.

Receipts, exact CI/deployment status and recovery instructions: `.staging/reliability-workflow-checkpoint.json`, key `electricalDailyUsability`, and `.staging/electrical-usability-delivery.md`. Screenshots: `test-results/electrical-usability/`. Physical acceptance remains pending until Daniel confirms the changed behavior.

## Limits

One electrical context per site; other work settings use general records. Electrical text has server saving and in-page recovery, not device-draft storage. Navigation storage contains no form text. The electrical revision HTML and site evidence package remain separate exports with explicit inclusion rules. Source content remains draft and the existing qualified-review, domain/email, hosted-recovery and operational release gates remain open.

# First observed electrician rehearsal

Prepared October 10, 2026. **Participant results are blank.** Automated access checks are preparation, not an observed rehearsal or physical-phone acceptance.

Scenario: a supervisor records a documentation concern during a synthetic kitchen renovation, delegates follow-up to a worker, reviews the worker's progress, then retrieves the evidence. No real electrical work, customer information, qualification or safety approval is represented.

## Before starting

Use two people and separate signed-in devices/browser profiles if possible. If Daniel plays both roles, label it a one-person two-role rehearsal; it does not prove independent worker onboarding. Open Safari directly on iPhone. Record browser/device and actual observed times on the scorecard. The observer should wait before helping and record every hint or takeover.

The coordinator opens ignored `.staging/electrician-rehearsal-private.json` privately. It contains the existing **SUPERVISOR** and **WORKER** account entries, direct job/site links and the path to the staging access-gate file. The gate password is different from the account password. Do not paste either into the scorecard, chat or screenshots. No accounts were reset or newly provisioned. Both memberships are active in the practice company.

Prepared site: **PRACTICE — Electrician rehearsal - kitchen renovation**, in **PRACTICE — First workday practice**. Start at [the prepared electrical job](https://tradesafe-staging-yqkiizimbtlygovkscoh.onrender.com/sites/008b86c1-3472-46c5-9f85-766e469c3fd5/electrical). The private file is authoritative if a future rehearsal receives a different site ID. This link grants no access by itself.

Put `.staging/electrician-rehearsal-photo.jpg` on the supervisor's test device using your existing local file-transfer method before timing starts. It is a labelled synthetic training panel, not a real installation. The observer's writable sheet is `.staging/electrician-rehearsal-scorecard.csv`. Its results must remain private; do not commit completed copies. Allow about 25 minutes for the whole session; this is a planning allowance, not a measured result.

## Participant instructions

1. **Supervisor:** open the prepared link, pass the staging gate if asked, and use **Sign In**. Check **Electrical job**, the practice site and **TRAINING PANEL A / CIRCUIT 4**. Reload once. Leave unresolved credential and ESA fields unresolved.
2. Select **Report a concern**. In **What did you observe?**, enter `SYNTHETIC: training circuit label needs a clearer job-note reference.` In **Where on this site?**, enter `Practice kitchen / training panel A`. Select **Save concern draft** and wait for **Saved concern draft — saved to server**.
3. Select the supplied image with **Photo file**. Enter `SYNTHETIC training panel A / circuit 4` in **Photo caption**, then **Upload photo**. Wait for **Photo saved and retained.** Reload and check the text, caption and image. Select **Submit concern**, then **View concern and follow-up**. This is recorded in the app; nobody was notified.
4. Select **Open follow-up action**, then **Update progress** if collapsed. Expand **Assignment, due date and immediate controls**. In **Responsible member**, choose the worker whose account is marked WORKER in the private file. Use **Due date (optional)** to choose today's date and **Save progress**. Wait for **Action update saved.** Tell the worker directly that the app record is ready; there is no notification service.
5. **Worker:** use your own account and **Sign In**, then **My work**. Find the practice site's assigned action and open **Update progress**. Set **Status after saving** to **In progress**. In **Progress or resolution notes**, enter `SYNTHETIC: training panel A / circuit 4 reference reviewed; no physical work performed.` Select **Save progress**, wait for **Action update saved.**, reload and confirm your note remains. Then choose **Awaiting verification** and **Request verification**. Check the saved state.
6. **Supervisor:** return to the action and reload. Open **Review and verify**. Read the original finding and worker note; open the original concern and photo if needed. Add `SYNTHETIC supervisor review: practice reference checked.` to the saved notes, select **Closed — verified** under **Status after saving**, then **Verify and close**. Reload and check the recorded verifier and time. This closes a practice action, not a safety approval.
7. Return to the site. Under **Evidence package**, set **Package from** and **Package through** to the date of this session in America/Toronto. Select **Download evidence package**. Open `index.html` inside the ZIP and check the concern, caption/photo, assignment/progress/verification history and current closed state. Separately open **Electrical job → Download electrical job record** and compare the saved job entries. The job record is a separate download; it is not silently included in the ZIP.

If a request fails, stop timing at the agreed failure point and record the failure before helping. Keep entered text visible, retry the same operation using the displayed retry control, and do not create a second concern. No connection fault is injected into this first observation. Existing automated interruption evidence is reused; a later specifically observed recovery exercise can be scheduled separately.

## Observer rules and handoff

Use the blank [scorecard template](templates/electrician-observer-scorecard.csv). Completion means a checked saved record, not opening a page. Record elapsed seconds, independent/assisted/failed/abandoned, hints/takeover, the exact confusing interface label, safe failure stage and whether export values match saved entries. Leave unknowns blank. Do not copy credentials, report bodies, personal details or URLs with query/token values into notes. Comments should describe the interface, not customer content.

After observation, preserve the original scorecard. If aggregate measurement is wanted, translate enumerated outcomes into the existing [measurement schema](PILOT-MEASUREMENT.md); label these `observed_field` only when directly observed. Participant comments stay separate. No outcomes are generated from preparation receipts. Existing records are retained; rerunning the preparation script never resets the exercise. Use a new deliberately prepared scenario for an independent repetition.

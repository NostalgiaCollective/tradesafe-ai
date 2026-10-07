# Focused workday quality review — 2026-10-07

Independent review. No Claude Code findings were available in the repository or supplied session context. `CLAUDE.md` only references `AGENTS.md`; this record does not claim to resolve Claude's review. Baseline: `87a3886422dbe661cab9b0979f48eb54739abb77`, confirmed in Git and served staging identity. Unrelated `raw/` remains untouched.

## Demonstrated defects and repairs

| Severity | Location | Observable consequence and repair |
| --- | --- | --- |
| High workflow impact | `app/briefs/[id]/BriefEditor.jsx`, participating crew | A revoked participant remained checked and disabled. Authoritative SQL correctly rejected further saves containing that participant, so the form could not recover. A selected inactive participant can now be removed, which also removes draft attendance. They cannot be added back. Historical versions and acknowledgements remain untouched. |
| Medium usability | `BriefEditor.jsx`, record operation | Recording with one missing control displayed a generic list of every requirement, with no route back to the missing field. `lib/domain/brief-readiness.mjs` produces field-specific navigation help; “Complete before recording” reveals the relevant step and focuses its control. Server validation remains authoritative. SQL comparison tests keep required-field guidance aligned. No answers or controls are filled automatically. |
| Medium recovery | `app/briefs/[id]/BriefRecord.jsx` | A failed top-of-page “Revise brief” left recovery below the entire record at phone width. Failure now moves focus and scroll to the existing feedback/retry region. The original command/version/request identifier is retained; no new mutation mechanism was added. |
| High dependency advisory | `package-lock.json` | Full audit found `sharp@0.35.4` (GHSA-wq5f-xc86-pv6w) and `source-map-js@1.2.1` (GHSA-68fv-2mgg-jv7q). Targeted `npm update sharp source-map-js --ignore-scripts` selects compatible patches `0.35.5` and `1.2.2` within existing declared ranges, including Next's shared sharp and Tailwind/PostCSS's shared source-map-js. No override, gate, framework or lint-rule change. |

Baseline hosted Chromium reproduced all three UI defects on distinct synthetic practice records. The regression fixture asserts actual server crew/attendance/control values, reload persistence, field focus, visible retry and retained recorded versions. Initial `uncheck()` test timed out because removing a participant removes that checkbox from the DOM; the test uses a real click and checks authoritative persisted values instead. This harness failure is not reported as an application failure.

## Vertical trace and boundaries

Reviewed SiteStart/site command → BriefEditor/useDraft/brief command → BriefRecord acknowledgement → ConcernForm/EvidencePanel/concern command → ActionList/update_action → site package/export. SQL serializes membership-sensitive mutations through company locks, checks active membership and revisions, and retains version-specific acknowledgements and idempotency receipts. Private bytes are authorized by original record access. Package generation verifies hashes, applies explicit limits and rechecks state/access; no new authorization bypass was demonstrated in this trace. This is a focused review, not an exhaustive security certification.

Existing complete-workday regression exercises separate supervisor/worker sign-ins, briefing recording/acknowledgement, captioned photo, lost responses, reassignment and stale edits, progress/verification, current site counts, revised acknowledgements, authorized exports, hash preservation and revoked denial. The new fixture is executed separately by the same local WebKit job, with its expected executed count raised from 16 to 17 and zero skips required.

Maintainability concerns, not demonstrated data defects: `firstWorkday` issues eight parallel count/preference queries, including role-unused counts; `briefData` performs several bounded projections even for draft views; action/brief rendering remains dense. No measured latency failure or unbounded evidence load was established. Broad query/API/component rewrites are deferred to avoid disturbing the verified behavior. The touched recording-readiness logic now has a directly testable boundary rather than embedding another long validation expression in JSX.

## Dependency scope and sources

The existing `tooling/next-root-glob` adapter remains unchanged: scoped Next override, pinned safe matcher/traversal, only the used `globSync(string,{onlyDirectories:true})` call, fail-closed unsupported options, transparent source/archive identity and clean `npm ci --ignore-scripts`. The tests still compare reference paths and exact diagnostics and pin the upstream caller. Its README documents removal after proven upstream equivalence; no broad framework fork or audit suppression was introduced.

Sources retrieved 2026-10-07: [sharp maintainer advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w), [sharp 0.35.5 release](https://github.com/lovell/sharp/releases/tag/v0.35.5), [source-map-js advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), [maintainer 1.2.2 release](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2). Sharp's SVG dependency is reached during format metadata inspection before the application's format rejection; no exploit is asserted. Source-map-js is used by build tooling; no user-facing arbitrary source-map input was found. These reachability assessments do not replace applying the patches.

## Delivery evidence

Canonical final commit, required CI, served identity and hosted results: `.staging/reliability-workflow-checkpoint.json` → `codeQualityWorkday`, and `.staging/code-quality-delivery.md`. Baseline and local/hosted receipts: `.staging/code-quality-*.json`. Screenshots: `test-results/code-quality/{baseline,local,hosted}/`. No migration is required.

Automated local WebKit, hosted Chromium, injected network faults and physical acceptance are separate evidence. Phone acceptance of these repairs is pending. Domain/signup email, qualified safety-content review and all unrelated release gates remain deferred.

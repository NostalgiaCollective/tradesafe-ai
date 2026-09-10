# TradeSafe repository integrity baseline

Discovery date: 2026-09-10. Scope: Phases 0–5 only. No product implementation, deployment, production data changes, or external account creation authorized in this checkpoint.

## Starting point

| Item | Observed value |
| --- | --- |
| Working directory / repository root | `C:/Users/USER/Documents/tradesafe-ai` |
| Starting branch | `main`, tracking `origin/main` |
| Starting commit | `6118f7e21c8b4ba9954567d1e863093b75126a18` |
| Working branch created | `astra/production-mvp` |
| Origin fetch and push | `https://github.com/NostalgiaCollective/tradesafe-ai.git` |
| Tracked files | 45 |
| Tracked modifications at start | None |
| Existing untracked work | `raw/intent.md`, `raw/architecture.md` |
| Existing ignored configuration | `.env`; names only inspected, values not printed |
| Package manager | npm, `package-lock.json` present; no alternate lockfile |
| Local runtime | Node 24.14.0, npm 11.9.0 on Windows |
| Instructions | Root `AGENTS.md`; `CLAUDE.md` includes it. Next 16 documentation must be read before code changes. No branch convention documented. |

Recent history: photo analysis/mobile styling; Stripe pay-and-print; report saving/dashboard fix; initial application; Formspree email capture; landing page; create-next-app. Formspree is historical, not present in current application code.

Existing raw document SHA-256 values, preserved through discovery:

- `raw/intent.md`: `80FB2FDBDC726FB3D7663522611A7D5F3B4E6E1A65E997980AB4E6F2D6D10434`
- `raw/architecture.md`: `CBEA98456E34489C754A9383C5D3E050DA7CD3BCA9114DCFECAEB9D4E1289035`

## Configuration and secrets

The local `.env` contains an `ANTHROPIC_API_KEY` assignment. Its validity, account, and environment were not tested. Supabase URL, Supabase public key, and Stripe secret were absent from that file. There is no tracked environment example or startup validation. The application references:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: browser/server configuration; public access still requires database grants and RLS.
- `STRIPE_SECRET_KEY`: server routes only.
- `ANTHROPIC_API_KEY`: server route only.

No tracked `.env` files were found. A filename-only regex scan of all seven reachable commit snapshots for recognizable Anthropic, Stripe, AWS access-key and private-key patterns found no matches. This is a limited scan, not proof that every possible credential format or external secret store is safe. Local values were not added to reports. `.claude/settings.local.json` is tracked local tool configuration; it is not deployment configuration.

## Deployment and persistence baseline

README gives generic Next.js commands and links to Vercel. `raw/architecture.md` intends Vercel and Supabase. No `vercel.json`, linked `.vercel` project, CI workflow, migration directory, deployment runbook, backup evidence, monitoring configuration, or test suite was found. Actual deployment URL, environment settings, live schema, customer population, mail provider settings and backups remain unknown.

`supabase/schema.sql` starts by dropping five tables with CASCADE. It is a destructive rebuild script, not a production migration. It was read but never executed.

## Commands and outcomes

| Check | Result |
| --- | --- |
| Git branch creation | Succeeded after approval for protected Git metadata writes |
| `npm` in PowerShell | `npm.ps1` blocked by execution policy; used `npm.cmd` without changing policy |
| `npm.cmd ci --ignore-scripts --cache .npm-cache` | First attempt denied registry access; stopped and retried with approved network access. Installed 376 packages, audited 377. Lockfile unchanged. Lifecycle scripts intentionally not run; installed binaries were sufficient for build. |
| `npm.cmd run lint` | FAILED: 6 errors, 4 warnings |
| `npm.cmd run build` | PASSED on unchanged source. Compile 6.2 s; TypeScript step 1.337 s; static generation 216 ms. Warns middleware convention deprecated. |
| `npm.cmd audit --json --cache .npm-cache` | Completed after approved network retry; exit 1: 12 affected package entries, 1 critical / 7 high / 3 moderate / 1 low. No automatic fixes run. |
| `npm.cmd run dev -- --hostname 127.0.0.1` | Starts; baseline browser GET `/` returns HTTP 500 due to missing Supabase configuration |
| Temporary public-screen diagnostic | Process-only URL `http://127.0.0.1:54321` and a deliberately nonfunctional public key allow anonymous UI inspection. No `.env` edits, service mock, auth bypass, or customer fixtures. Authenticated service workflows remain unverified. |

The browser plugin reported no available browser connections; its documented discovery returned an empty list. Local UI checks used the separately available Playwright testing browser. Browser screenshots are in `docs/evidence/`. npm cache and browser session logs are local artifacts, excluded from the discovery commit.

Only discovery documents and screenshots belong in this checkpoint. Existing raw notes remain untracked. Application source, package manifests, lockfile, schema and credentials remain unchanged. The local diagnostic server is stopped at handoff.

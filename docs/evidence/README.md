# Discovery UI evidence

Captured 2026-09-10 from unchanged source at `6118f7e21c8b4ba9954567d1e863093b75126a18` using a local development server.

The original environment returns HTTP 500 because Supabase URL/key are absent. These screenshots use **temporary process-only, nonfunctional local Supabase settings** so anonymous pages can render. No fake user, auth bypass, fixture account or live service connection was introduced. These screenshots establish public UI only, not service success.

| Image | Viewport / purpose |
| --- | --- |
| `discovery-landing-desktop.png` | 1440×1000, landing hero |
| `discovery-landing-390.png` | 390×900, phone hero |
| `discovery-landing-768.png` | 768×900, tablet hero |
| `discovery-login-mobile.png` | 390×844, login after navigation settled |
| `discovery-roofing-mobile.png` | 390×844, full-page trade marketing |
| `discovery-login-error-mobile.png` | 390×844, callback-error query with no visible error |

The small Next.js development indicator is development tooling, not asserted to be a production UI artifact. Report/dashboard/settings screenshots are not supplied because real authenticated rendering was not verified. See the audit's runtime matrix for checks and remaining blockers.

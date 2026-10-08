# Next ESLint root-directory adapter

Application-maintained compatibility boundary, authorized 2026-10-03. This is **not** the fast-glob package and is not a general replacement for its API.

`eslint-config-next16.3.6 -> @next/eslint-plugin-next16.3.6 -> fast-glob3.3.1 -> micromatch4.0.8 -> braces3.0.3` introduced [CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). [Upstream fix](https://github.com/micromatch/braces/pull/72) remains separate from this workaround. No audit exclusions or rule changes.

The installed plugin calls only `globSync(string, {onlyDirectories:true})` in `get-root-dirs.js`, used by `no-html-link-for-pages`. Next converts Windows separators before calling. It maps rootDir arrays itself; each negative-only pattern consequently returns no paths, not a global exclusion. No async/stream/callback API is used, so none is exported. Unrecognized options fail explicitly. The test pins the helper hash and scans for additional fast-glob consumers, forcing review when Next changes this contract.

## Implementation and provenance

Pinned `glob13.0.6` traverses directories (including directory symlinks). Pinned `picomatch2.3.2`, the safe matcher already used by the original chain, retains its glob/hidden-name semantics without micromatch or braces. Traversal permits dot names; picomatch filters them using the original dot:false semantics, including negated extglobs. File results are excluded using stat. Terminal `/**` needs at least one child, unlike glob's default base inclusion. Literal roots are not expanded into descendants. Relative/absolute paths, leading `./`, trailing slashes and separators are preserved. Filesystem enumeration order is not a glob contract; comparison uses sorted path multisets, retaining duplicates.

The initially tested tinyglobby adapter was rejected: directory symlinks were omitted and recursive roots differed. An unadapted alias's clean audit was insufficient. No vulnerable code is vendored into this adapter.

Sources: [glob API](https://github.com/isaacs/node-glob), [picomatch](https://github.com/micromatch/picomatch), [Next caller](https://github.com/vercel/next.js/blob/canary/packages/eslint-plugin-next/src/utils/get-root-dirs.ts).

## Reproducible installation

The real package name is `@tradesafe/next-root-glob`, visible in the lockfile and installed metadata. npm's scoped override resolves the file relative to the installed Next plugin, hence `../../../tooling/next-root-glob/...tgz`. The source and small npm-generated archive are both committed; clean `npm ci --ignore-scripts` installs it without hooks or manual node_modules edits. Tests compare the installed source/package with tracked files. Never rename it to fast-glob or invent an upstream version.

To change: edit source, bump the private adapter version, run `npm pack ./tooling/next-root-glob --pack-destination tooling/next-root-glob --ignore-scripts`, update the scoped override filename, regenerate the lock with npm install, then prove clean npm ci. Do not hand-edit lock metadata. Only the archive selected by the override belongs in version control.

## Regression evidence

`tests/fixtures/next-root-glob-reference.json` was generated from untouched fb538f19d352d159027fc50043387df07f1cb977 / fast-glob3.3.1 on Windows Node24 using `rootGlobSnapshot(referenceRoot)`. It contains exact path multisets, 83 JSX/87 TS enabled rules and 31 passing/failing diagnostic sets. Tests cover normal/recursive paths, negation, braces/ranges, extglobs, arrays, Unicode/spaces, relative/absolute and Windows-style separators, hidden directories, missing/file targets, directory symlinks, real routes and embedded non-route pages. App-router diagnostic behavior is preserved from upstream, not strengthened or described as more coverage than it provides.

`node --test tests/next-root-glob.test.mjs` runs on Windows locally and Linux in the unchanged required quality job. The baseline is inert expected data; no vulnerable oracle is installed by CI. The worktree experiment also ran actual ESLint CLI violations (Next, Hooks, TypeScript) before/after with exit1. Full npm audit includes development dependencies.

## Removal

Security patch revalidation, 2026-10-07: Next and its ESLint configuration are pinned to 16.3.8. The adapter, upstream-helper hash, reference paths, rule settings and expected diagnostics are unchanged. Clean `npm ci --ignore-scripts` and the same Windows/Linux regression contract remain required; this patch does not broaden the supported adapter API.

When a supported upstream fix exists, remove the scoped override; update only the justified upstream version/lockfile. Re-run the reference behavior and lint diagnostics, full audit, clean install, and required CI. Remove this adapter/archive and its call-surface pin only with explicit upstream equivalence evidence; keep behavioral route tests. No automatic version upgrades.

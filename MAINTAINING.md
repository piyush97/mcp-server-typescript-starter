# Maintaining mcp-server-typescript-starter

Runbook for maintaining this repository. Part of the piyush97 profile long-term
maintenance program — see the consolidated handbook in
[PiyushMehta.com](https://github.com/piyush97/PiyushMehta.com/blob/main/MAINTENANCE.md).

## Repository at a glance

- **Language/runtime:** TypeScript, Node.js 22, npm (lockfile: `package-lock.json`)
- **Package manager:** npm (`npm ci` / `npm install`)
- **Default branch:** `main`
- **CI:** `.github/workflows/ci.yml` — install, typecheck, and tests on push to `main` and pull requests

## Local development

```bash
npm ci                # clean install from lockfile (CI and maintainers)
npm run typecheck     # tsc --noEmit
npm test              # vitest run
```

## CI commands

The repository's CI workflow (`.github/workflows/ci.yml`) runs exactly:

```bash
npm ci
npm run typecheck
npm test
```

A pull request is mergeable only when all CI checks are green.

## Dependabot policy

Configured in `.github/dependabot.yml`:

- **npm ecosystem** (`directory: /`, weekly, Mondays 06:00 UTC, max 5 open PRs)
  - Minor and patch updates are grouped into a single `npm-minor-patch` PR.
  - **Major (semver-major) updates are ignored** — handle them deliberately, not via automation.
- **GitHub Actions ecosystem** (weekly) — keeps `actions/*` pinned versions fresh.

When a Dependabot PR arrives:

1. Review the diff — read the release notes linked in the PR body.
2. Wait for CI to be green.
3. Merge with `gh pr merge --squash --delete-branch` (or the GitHub UI squash-and-merge).

Dependabot PRs are exempt from the stale bot so they never rot.

## Stale policy

`.github/workflows/stale.yml` runs weekly (Mondays 09:00 UTC):

- Issues are marked `stale` after 60 days of inactivity.
- PRs are marked `stale` after 30 days of inactivity.
- **Nothing is ever auto-closed** (`days-before-*-close: -1`).
- Activity (comment, review, push) removes the `stale` label (`remove-stale-when-updated: true`).
- Dependabot PRs are exempt (`exempt-pr-labels: "dependencies"`).

A `stale` label means: please respond, update, or close the item yourself.
If a stale issue is still valid, comment on it — the label is removed.

## Cutting a release

1. From a clean `main`:
   ```bash
   git checkout main && git pull --ff-only
   npm ci && npm run typecheck && npm test
   ```
2. Bump the version in `package.json` (semver).
3. Commit, push, and tag:
   ```bash
   git commit -am "chore: release vX.Y.Z"
   git push origin main
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
4. Create a GitHub Release from the tag, summarizing changes since the previous tag.

## Verification checklist (after any change)

```bash
gh pr view <n> --repo piyush97/mcp-server-typescript-starter --json state,mergeCommit   # MERGED
gh api repos/piyush97/mcp-server-typescript-starter/actions/runs?branch=main&per_page=1 # conclusion: success
```

## Automation status

| Automation | Where | Status |
|---|---|---|
| CI | `.github/workflows/ci.yml` | Active |
| Dependabot (npm + GitHub Actions) | `.github/dependabot.yml` | Active |
| Stale bot | `.github/workflows/stale.yml` | Active, label-only (no auto-close) |

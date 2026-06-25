# GitHub Actions + Homebrew Deployment Design

> **Migration note (2026-06-24):** Homebrew distribution moved from the per-project
> tap `Derek-X-Wang/homebrew-repotools` to the shared consolidated tap
> `Derek-X-Wang/homebrew-tap` (standard `Formula/<tool>.rb` layout, multiple tools
> per tap). The push secret is now `TAP_GITHUB_TOKEN` (a shared fine-grained PAT
> scoped to `homebrew-tap` + `scoop-bucket`). Install is now
> `brew tap derek-x-wang/tap && brew install repotools`. References below have been
> updated to reflect this.

## Goal

Automate the build, release, and Homebrew distribution of repotools so that pushing a git tag (`v*`) produces cross-platform binaries, a GitHub Release, and an updated Homebrew formula — with zero manual steps after the tag push.

## Decisions

| Aspect | Decision |
|--------|----------|
| Trigger | Git tag push matching `v*` |
| Platforms | macOS (arm64, x64), Linux (x64, arm64), Windows (x64) |
| Distribution | Shared Homebrew tap (`Derek-X-Wang/homebrew-tap`) + GitHub Release |
| Automation | Fully automated — tag → build → release → tap update |
| Auth | `TAP_GITHUB_TOKEN` repo secret (shared fine-grained PAT, `homebrew-tap` + `scoop-bucket`, Contents: read/write) |
| Tap repo | Shared, pre-existing — this project owns only `Formula/repotools.rb` |

## Architecture

### Workflow 1: CI (`ci.yml`)

**Triggers:** Push to `main`, pull requests

**Steps:**
1. Checkout code
2. Setup Bun
3. `bun install`
4. `bun run typecheck`
5. `bunx vitest run`

### Workflow 2: Release (`release.yml`)

**Triggers:** Push tags matching `v*`

**Steps:**

1. **Validate** — run typecheck + tests (gate the release)
2. **Build matrix** — compile binaries for all 6 targets:
   - `bun build src/cli.ts --compile --target=bun-darwin-arm64 --outfile repotools-darwin-arm64`
   - `bun build src/cli.ts --compile --target=bun-darwin-x64 --outfile repotools-darwin-x64`
   - `bun build src/cli.ts --compile --target=bun-linux-x64 --outfile repotools-linux-x64`
   - `bun build src/cli.ts --compile --target=bun-linux-arm64 --outfile repotools-linux-arm64`
   - `bun build src/cli.ts --compile --target=bun-windows-x64 --outfile repotools-windows-x64.exe`
3. **Package** — create tarballs and zip:
   - Unix: `repotools-<version>-<os>-<arch>.tar.gz`
   - Windows: `repotools-<version>-windows-x64.zip`
4. **Checksum** — generate `checksums.txt` with SHA256 for all archives
5. **Release** — create GitHub Release via `gh release create`, attach all archives + checksums
6. **Update Homebrew tap** — generate formula, push to `Derek-X-Wang/homebrew-tap`

### Homebrew Tap

**Repo:** `Derek-X-Wang/homebrew-tap` (public, shared across tools — this project owns only `Formula/repotools.rb`)

**Formula:** `Formula/repotools.rb`

The formula:
- Downloads the correct prebuilt binary tarball for the user's OS/arch
- SHA256 verification per platform
- No compilation on the user's machine
- Covers macOS (arm64, x64) and Linux (x64, arm64) only (no Windows via Homebrew)

**Formula update mechanism:**
The release workflow clones the shared tap repo, writes the generated formula to `Formula/repotools.rb` (leaving other tools' files untouched), commits, and pushes using `TAP_GITHUB_TOKEN`.

### Asset Naming Convention

```
repotools-v0.1.0-darwin-arm64.tar.gz
repotools-v0.1.0-darwin-x64.tar.gz
repotools-v0.1.0-linux-x64.tar.gz
repotools-v0.1.0-linux-arm64.tar.gz
repotools-v0.1.0-windows-x64.zip
checksums.txt
```

### Secrets Required

| Secret | Purpose | Scope |
|--------|---------|-------|
| `TAP_GITHUB_TOKEN` | Push formula updates to shared `homebrew-tap` | Shared fine-grained PAT, `homebrew-tap` + `scoop-bucket`, Contents: read/write |

Note: `GITHUB_TOKEN` (auto-provided) handles release creation in the same repo.

### User Experience

```bash
# Install
brew tap derek-x-wang/tap
brew install repotools

# Use
repotools install
repotools exec jq '.name'

# Update
brew upgrade repotools
```

### Release Process (developer)

```bash
# Bump version in package.json, commit
git tag v0.1.0
git push --tags
# Everything else is automated
```

## Files

| File | Repo | Purpose |
|------|------|---------|
| `.github/workflows/ci.yml` | repotools | PR/push CI: typecheck + tests |
| `.github/workflows/release.yml` | repotools | Tag-triggered: build, release, tap update |
| `Formula/repotools.rb` | homebrew-tap | Homebrew formula (auto-generated) |

## Future Registries

The release workflow is designed to be extensible. Adding a new registry (e.g., npm, Scoop for Windows, AUR for Arch Linux) means adding a step after the GitHub Release creation. The asset naming convention and checksums are already in place.

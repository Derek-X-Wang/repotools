# GitHub Actions + Homebrew Deployment Design

## Goal

Automate the build, release, and Homebrew distribution of repotools so that pushing a git tag (`v*`) produces cross-platform binaries, a GitHub Release, and an updated Homebrew formula — with zero manual steps after the tag push.

## Decisions

| Aspect | Decision |
|--------|----------|
| Trigger | Git tag push matching `v*` |
| Platforms | macOS (arm64, x64), Linux (x64, arm64), Windows (x64) |
| Distribution | Homebrew tap (`Derek-X-Wang/homebrew-repotools`) + GitHub Release |
| Automation | Fully automated — tag → build → release → tap update |
| Auth | `HOMEBREW_TAP_TOKEN` repo secret (GitHub PAT with `repo` scope) |
| Tap repo creation | Via `gh repo create` (no local clone needed) |

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
6. **Update Homebrew tap** — generate formula, push to `Derek-X-Wang/homebrew-repotools`

### Homebrew Tap

**Repo:** `Derek-X-Wang/homebrew-repotools` (public, created via `gh repo create`)

**Formula:** `Formula/repotools.rb`

The formula:
- Downloads the correct prebuilt binary tarball for the user's OS/arch
- SHA256 verification per platform
- No compilation on the user's machine
- Covers macOS (arm64, x64) and Linux (x64, arm64) only (no Windows via Homebrew)

**Formula update mechanism:**
The release workflow clones the tap repo (shallow), writes the generated formula, commits, and pushes using `HOMEBREW_TAP_TOKEN`.

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
| `HOMEBREW_TAP_TOKEN` | Push formula updates to `homebrew-repotools` | GitHub PAT with `repo` scope |

Note: `GITHUB_TOKEN` (auto-provided) handles release creation in the same repo.

### User Experience

```bash
# Install
brew tap Derek-X-Wang/repotools
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
| `Formula/repotools.rb` | homebrew-repotools | Homebrew formula (auto-generated) |

## Future Registries

The release workflow is designed to be extensible. Adding a new registry (e.g., npm, Scoop for Windows, AUR for Arch Linux) means adding a step after the GitHub Release creation. The asset naming convention and checksums are already in place.

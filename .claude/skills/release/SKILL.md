---
name: release
description: Cut a new release of repotools. Use when the user says /release, "release", "cut a release", "publish a new version", "bump version", "ship it", or wants to tag and publish a new version. Also use proactively if the user asks how to release or deploy repotools.
---

# Release

Guide the release of repotools — bump version, commit, tag, push. Everything after the tag push is automated by GitHub Actions.

## What happens when you push a tag

The release workflow (`.github/workflows/release.yml`) triggers on any `v*` tag and:

1. **Validates** — typecheck + tests must pass
2. **Builds** 5 cross-platform binaries via `bun build --compile --target`:
   - `bun-darwin-arm64`, `bun-darwin-x64`
   - `bun-linux-x64`, `bun-linux-arm64`
   - `bun-windows-x64`
3. **Packages** each as `repotools-<version>-<os>-<arch>.tar.gz` (`.zip` for Windows)
4. **Creates a GitHub Release** with all archives + `checksums.txt`
5. **Updates the Homebrew tap** at `Derek-X-Wang/homebrew-repotools` with new SHA256 hashes

Users install via:
```bash
brew tap Derek-X-Wang/repotools && brew install repotools
```

## Release steps

### 1. Pre-flight checks

Before releasing, verify everything is clean:

```bash
bun run typecheck
bunx vitest run
git status  # should be clean
```

If there are uncommitted changes, commit them first.

### 2. Determine the new version

Follow semver:
- **patch** (0.1.0 → 0.1.1): bug fixes
- **minor** (0.1.0 → 0.2.0): new features, backward compatible
- **major** (0.1.0 → 1.0.0): breaking changes

Read the current version from `package.json` and ask the user what kind of release this is if not specified.

### 3. Bump version in package.json

Update the `"version"` field in `package.json`.

Also update the version string in `src/cli.ts` where `Command.run` is called:
```typescript
const cli = Command.run(rootCommand, {
  name: "repotools",
  version: "<new-version>",
})
```

### 4. Commit and tag

```bash
git add package.json src/cli.ts
git commit -m "release: v<version>"
git tag v<version>
```

### 5. Push

```bash
git push && git push --tags
```

This triggers the release workflow. Monitor it at:
`https://github.com/Derek-X-Wang/repotools/actions`

## HOMEBREW_TAP_TOKEN setup

The release workflow needs a `HOMEBREW_TAP_TOKEN` secret to push formula updates to the tap repo. If the release workflow fails at the "Update Homebrew tap" step, this token is likely missing.

To set it up:

1. Go to https://github.com/settings/personal-access-tokens/new
2. Create a **fine-grained token**:
   - **Name:** `homebrew-tap-repotools`
   - **Repository access:** Only select `Derek-X-Wang/homebrew-repotools`
   - **Permissions:** Contents → Read and write
3. Add it as a secret:
   ```bash
   gh secret set HOMEBREW_TAP_TOKEN --repo Derek-X-Wang/repotools
   ```
   (paste the token when prompted)

## Troubleshooting

- **Build fails:** Check the Actions log. Usually a typecheck or test failure — fix and re-tag.
- **Homebrew tap not updating:** Verify `HOMEBREW_TAP_TOKEN` is set and has write access to `homebrew-repotools`.
- **Wrong version in binary:** Make sure both `package.json` and the `version` field in `src/cli.ts` were updated.

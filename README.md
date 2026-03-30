# repotools

Declarative CLI tool manager for repositories. Define your required CLI tools in a config file, and repotools will install, cache, and run them.

## Install

```bash
# From source
bun install
bun build src/cli.ts --compile --outfile repotools

# Or run directly
bun run src/cli.ts
```

## Usage

### 1. Create a `repotools.json` in your repo root

```json
{
  "tools": {
    "jq": {
      "source": {
        "type": "github-release",
        "repo": "jqlang/jq"
      },
      "version": "latest",
      "assetPattern": "jq-macos-arm64"
    },
    "gh": {
      "source": {
        "type": "github-release",
        "repo": "cli/cli"
      },
      "version": "v2.50.0"
    }
  }
}
```

### 2. Install tools

```bash
repotools install
```

This will:
- Read `repotools.json`
- Resolve each tool's version from GitHub Releases
- Download the correct binary for your platform
- Cache it globally at `~/.repotools/cache/`
- Symlink it into `.repotools/bin/`

### 3. Run tools

```bash
repotools exec jq '.name' < data.json
repotools exec gh pr list
```

### 4. Check installed tools

```bash
repotools list
```

### 5. Update to latest versions

```bash
repotools update
```

## Config Reference

### Tool Config

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source.type` | `"github-release"` | yes | Source type (currently only GitHub Releases) |
| `source.repo` | `string` | yes | GitHub repo in `owner/repo` format |
| `version` | `string` | yes | Version tag or `"latest"` |
| `assetPattern` | `string` | no | Glob pattern to match specific release asset |

### Platform Detection

repotools automatically detects your OS and architecture and selects the matching binary from GitHub release assets. It recognizes common naming conventions:

- **OS:** darwin, macos, apple, linux, windows, win
- **Arch:** arm64, aarch64, x64, x86_64, amd64

If auto-detection fails, use `assetPattern` to specify the exact asset name.

### Archive Support

repotools handles `.tar.gz`, `.tgz`, `.zip` archives automatically -- it extracts the archive and finds the binary inside.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub personal access token for higher API rate limits (recommended for CI) |

## Storage

```
~/.repotools/
  cache/
    <tool>/<version>/<binary>    # Global binary cache

<project>/
  .repotools/
    bin/
      <tool> -> symlink          # Project-local symlinks
```

## Tech Stack

- TypeScript + Bun
- [Effect](https://effect.website/) for typed functional programming
- [@effect/cli](https://github.com/Effect-TS/effect/tree/main/packages/cli) for CLI framework
- Single binary output via `bun build --compile`

## License

MIT

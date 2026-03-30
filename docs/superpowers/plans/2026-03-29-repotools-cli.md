# repotools CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an open-source CLI tool that lets repositories declaratively define, install, cache, and run their required CLI tools.

**Architecture:** Effect/CLI framework with Context.Tag services for config loading, GitHub API, downloading, caching, and linking. Commands compose services via Layer provision. Single binary output via `bun build --compile`. All side effects go through Effect services using `@effect/platform-bun` for FileSystem/Process.

**Tech Stack:** TypeScript, Bun, effect, @effect/cli, @effect/platform, @effect/platform-bun, vitest, @effect/vitest

---

## File Structure

```
repotools/
├── src/
│   ├── cli.ts                    # Entrypoint — root command + CLI runner
│   ├── commands.ts               # Root command with subcommands
│   ├── commands/
│   │   ├── install.ts            # `repotools install` command
│   │   ├── update.ts             # `repotools update` command
│   │   ├── list.ts               # `repotools list` command
│   │   └── exec.ts              # `repotools exec <tool> [...args]`
│   ├── services/
│   │   ├── config.ts             # ConfigService — load + validate repotools.json
│   │   ├── github-api.ts         # GithubApiService — GitHub Releases API calls
│   │   ├── resolver.ts           # ResolverService — resolve tool version from source
│   │   ├── downloader.ts         # DownloaderService — fetch binaries
│   │   ├── cache.ts              # CacheService — manage ~/.repotools/cache
│   │   ├── linker.ts             # LinkerService — symlink cached binaries into project
│   │   └── platform.ts           # PlatformService — detect OS + arch
│   ├── sources/
│   │   └── github-release.ts     # Asset matching logic for GitHub releases
│   ├── schema/
│   │   └── config.ts             # Effect Schema definitions for repotools.json
│   └── errors.ts                 # All tagged errors
├── tests/
│   ├── commands/
│   │   ├── install.test.ts
│   │   ├── update.test.ts
│   │   ├── list.test.ts
│   │   └── exec.test.ts
│   ├── services/
│   │   ├── config.test.ts
│   │   ├── resolver.test.ts
│   │   ├── cache.test.ts
│   │   └── linker.test.ts
│   ├── sources/
│   │   └── github-release.test.ts
│   └── test-utils/
│       └── index.ts              # Test layer factory + mock services
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── README.md
└── .gitignore
```

---

## Task 0: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`

- [ ] **Step 1: Initialize git repo**

```bash
cd /Users/derekxwang/Development/incubator/ContextFS/repotools
git init
```

- [ ] **Step 2: Create package.json**

Use `bun add` to get latest compatible versions:

```bash
bun init -y
bun add effect @effect/cli @effect/platform @effect/platform-bun
bun add -d @effect/vitest typescript @types/bun vitest
```

Then set scripts:
```json
{
  "scripts": {
    "dev": "bun run src/cli.ts",
    "build": "bun build src/cli.ts --compile --outfile repotools",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "outDir": "dist",
    "rootDir": ".",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "types": ["bun-types"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
  },
})
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
.repotools/
repotools
*.tsbuildinfo
.DS_Store
```

- [ ] **Step 6: Create minimal src/cli.ts and verify build**

```typescript
#!/usr/bin/env bun
import { Effect } from "effect"

Effect.log("repotools v0.1.0").pipe(Effect.runSync)
```

```bash
bun run typecheck
bun test
bun build src/cli.ts --compile --outfile repotools
./repotools
```

This verifies `bun build --compile` works with Effect dependencies early.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore src/cli.ts bun.lock
git commit -m "chore: scaffold repotools project

TypeScript + Bun + Effect CLI stack. Single-binary CLI tool
for declarative repo toolchain management. Verified bun
build --compile works with Effect dependencies."
```

---

## Task 1: Schema & Errors

**Files:**
- Create: `src/schema/config.ts`, `src/errors.ts`
- Test: `tests/services/config.test.ts` (schema decode tests)

- [ ] **Step 1: Write schema decode tests**

```typescript
// tests/services/config.test.ts
import { describe, expect } from "vitest"
import { it } from "@effect/vitest"
import { Schema } from "effect"
import { RepoToolsConfig } from "../../src/schema/config.js"

describe("RepoToolsConfig schema", () => {
  const decode = Schema.decodeUnknownSync(RepoToolsConfig)

  it("decodes valid github-release config", () => {
    const input = {
      tools: {
        mycli: {
          source: { type: "github-release", repo: "org/repo" },
          version: "latest",
        },
      },
    }
    const result = decode(input)
    expect(result.tools.mycli.source.type).toBe("github-release")
    expect(result.tools.mycli.version).toBe("latest")
  })

  it("decodes specific version", () => {
    const input = {
      tools: {
        mycli: {
          source: { type: "github-release", repo: "org/repo" },
          version: "v1.2.3",
        },
      },
    }
    const result = decode(input)
    expect(result.tools.mycli.version).toBe("v1.2.3")
  })

  it("decodes config with assetPattern override", () => {
    const input = {
      tools: {
        mycli: {
          source: { type: "github-release", repo: "org/repo" },
          version: "latest",
          assetPattern: "mycli-*-universal",
        },
      },
    }
    const result = decode(input)
    expect(result.tools.mycli.assetPattern).toBe("mycli-*-universal")
  })

  it("rejects missing source", () => {
    expect(() => decode({ tools: { mycli: { version: "latest" } } })).toThrow()
  })

  it("rejects empty tools", () => {
    expect(() => decode({ tools: {} })).toThrow()
  })

  it("rejects invalid repo format", () => {
    expect(() =>
      decode({
        tools: {
          mycli: {
            source: { type: "github-release", repo: "noslash" },
            version: "latest",
          },
        },
      })
    ).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
bun test tests/services/config.test.ts
```

Expected: FAIL — modules don't exist yet.

- [ ] **Step 3: Implement errors**

```typescript
// src/errors.ts
import { Schema } from "effect"

export class ConfigNotFoundError extends Schema.TaggedError<ConfigNotFoundError>()(
  "ConfigNotFoundError",
  { path: Schema.String, message: Schema.String }
) {}

export class ConfigParseError extends Schema.TaggedError<ConfigParseError>()(
  "ConfigParseError",
  { message: Schema.String }
) {}

export class ToolNotFoundError extends Schema.TaggedError<ToolNotFoundError>()(
  "ToolNotFoundError",
  { tool: Schema.String, message: Schema.String }
) {}

export class ReleaseNotFoundError extends Schema.TaggedError<ReleaseNotFoundError>()(
  "ReleaseNotFoundError",
  { repo: Schema.String, version: Schema.String, message: Schema.String }
) {}

export class UnsupportedPlatformError extends Schema.TaggedError<UnsupportedPlatformError>()(
  "UnsupportedPlatformError",
  { os: Schema.String, arch: Schema.String, message: Schema.String }
) {}

export class DownloadError extends Schema.TaggedError<DownloadError>()(
  "DownloadError",
  { url: Schema.String, message: Schema.String }
) {}

export class LinkError extends Schema.TaggedError<LinkError>()(
  "LinkError",
  { tool: Schema.String, message: Schema.String }
) {}

export class ExecError extends Schema.TaggedError<ExecError>()(
  "ExecError",
  { tool: Schema.String, message: Schema.String }
) {}

export class GithubApiError extends Schema.TaggedError<GithubApiError>()(
  "GithubApiError",
  { repo: Schema.String, message: Schema.String }
) {}

export class ExtractError extends Schema.TaggedError<ExtractError>()(
  "ExtractError",
  { asset: Schema.String, message: Schema.String }
) {}
```

- [ ] **Step 4: Implement config schema**

```typescript
// src/schema/config.ts
import { Schema } from "effect"

export const GithubReleaseSource = Schema.Struct({
  type: Schema.Literal("github-release"),
  repo: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/)
  ),
})

export const ToolSource = GithubReleaseSource
// Future: Schema.Union(GithubReleaseSource, CustomUrlSource, ...)

export const ToolConfig = Schema.Struct({
  source: ToolSource,
  version: Schema.String,
  assetPattern: Schema.optional(Schema.String),
})

export const RepoToolsConfig = Schema.Struct({
  tools: Schema.Record({
    key: Schema.String.pipe(Schema.minLength(1)),
    value: ToolConfig,
  }).pipe(
    Schema.filter((tools) =>
      Object.keys(tools).length > 0 ? undefined : "tools must not be empty"
    )
  ),
})

export type RepoToolsConfig = typeof RepoToolsConfig.Type
export type ToolConfig = typeof ToolConfig.Type
export type ToolSource = typeof ToolSource.Type
export type GithubReleaseSource = typeof GithubReleaseSource.Type
```

- [ ] **Step 5: Run tests**

```bash
bun test tests/services/config.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/schema/ src/errors.ts tests/services/config.test.ts
git commit -m "feat: define config schema and tagged errors

Effect Schema for repotools.json validation. Supports
github-release source with owner/repo pattern. Optional
assetPattern field for explicit asset matching. Extensible
union type for future source types."
```

---

## Task 2: PlatformService

**Files:**
- Create: `src/services/platform.ts`

- [ ] **Step 1: Implement PlatformService**

```typescript
// src/services/platform.ts
import { Context, Effect, Layer } from "effect"
import { UnsupportedPlatformError } from "../errors.js"

export type OS = "darwin" | "linux" | "windows"
export type Arch = "arm64" | "x64"

export interface PlatformInfo {
  readonly os: OS
  readonly arch: Arch
}

export interface PlatformServiceShape {
  readonly detect: () => Effect.Effect<PlatformInfo, UnsupportedPlatformError>
}

export class PlatformService extends Context.Tag("PlatformService")<
  PlatformService,
  PlatformServiceShape
>() {
  static Live = Layer.succeed(PlatformService, {
    detect: () =>
      Effect.try({
        try: () => {
          const osMap: Record<string, OS> = {
            darwin: "darwin",
            linux: "linux",
            win32: "windows",
          }
          const archMap: Record<string, Arch> = {
            arm64: "arm64",
            x64: "x64",
            aarch64: "arm64",
          }
          const os = osMap[process.platform]
          const arch = archMap[process.arch]
          if (!os || !arch) throw new Error("unsupported")
          return { os, arch } as PlatformInfo
        },
        catch: () =>
          new UnsupportedPlatformError({
            os: process.platform,
            arch: process.arch,
            message: `Unsupported platform: ${process.platform}-${process.arch}`,
          }),
      }),
  })

  static Test = (info: PlatformInfo) =>
    Layer.succeed(PlatformService, {
      detect: () => Effect.succeed(info),
    })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/platform.ts
git commit -m "feat: add PlatformService for OS/arch detection"
```

---

## Task 3: ConfigService (using @effect/platform FileSystem + Schema.parseJson)

**Files:**
- Create: `src/services/config.ts`
- Test: `tests/services/config.test.ts` (extend with service tests)

- [ ] **Step 1: Write ConfigService tests**

Add to `tests/services/config.test.ts`:

```typescript
import { ConfigService } from "../../src/services/config.js"
import { Effect, Exit } from "effect"

describe("ConfigService", () => {
  it.effect("loads valid config from cwd", () =>
    Effect.gen(function* () {
      const config = yield* ConfigService
      const result = yield* config.load("/project")
      expect(result.tools).toBeDefined()
      expect(result.tools.mycli).toBeDefined()
    }).pipe(
      Effect.provide(
        ConfigService.Test({
          "/project/repotools.json": JSON.stringify({
            tools: {
              mycli: {
                source: { type: "github-release", repo: "org/repo" },
                version: "latest",
              },
            },
          }),
        })
      )
    )
  )

  it.effect("fails with ConfigNotFoundError when file missing", () =>
    Effect.gen(function* () {
      const config = yield* ConfigService
      const exit = yield* config.load("/project").pipe(Effect.exit)
      expect(Exit.isFailure(exit)).toBe(true)
    }).pipe(Effect.provide(ConfigService.Test({})))
  )
})
```

- [ ] **Step 2: Run tests to verify failure**

- [ ] **Step 3: Implement ConfigService**

Uses `@effect/platform` FileSystem for file reading and `Schema.parseJson` for type-safe JSON decoding (no raw `JSON.parse`):

```typescript
// src/services/config.ts
import { Context, Effect, Layer, Ref } from "effect"
import { Schema } from "effect"
import { FileSystem } from "@effect/platform"
import { RepoToolsConfig } from "../schema/config.js"
import { ConfigNotFoundError, ConfigParseError } from "../errors.js"

const CONFIG_FILENAME = "repotools.json"
const decodeConfig = Schema.decodeUnknown(Schema.parseJson(RepoToolsConfig))

export interface ConfigServiceShape {
  readonly load: (
    cwd: string
  ) => Effect.Effect<RepoToolsConfig, ConfigNotFoundError | ConfigParseError>
}

export class ConfigService extends Context.Tag("ConfigService")<
  ConfigService,
  ConfigServiceShape
>() {
  static Live = Layer.effect(
    ConfigService,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      return ConfigService.of({
        load: (cwd) =>
          Effect.gen(function* () {
            const configPath = `${cwd}/${CONFIG_FILENAME}`
            const content = yield* fs.readFileString(configPath).pipe(
              Effect.mapError(
                () =>
                  new ConfigNotFoundError({
                    path: configPath,
                    message: `Config file not found: ${configPath}`,
                  })
              )
            )
            return yield* decodeConfig(content).pipe(
              Effect.mapError(
                (e) =>
                  new ConfigParseError({
                    message: `Invalid config: ${e.message}`,
                  })
              )
            )
          }),
      })
    })
  )

  static Test = (files: Record<string, string> = {}) =>
    Layer.effect(
      ConfigService,
      Effect.gen(function* () {
        const store = yield* Ref.make(new Map(Object.entries(files)))
        return ConfigService.of({
          load: (cwd) =>
            Effect.gen(function* () {
              const configPath = `${cwd}/${CONFIG_FILENAME}`
              const fileMap = yield* Ref.get(store)
              const content = fileMap.get(configPath)
              if (!content) {
                return yield* Effect.fail(
                  new ConfigNotFoundError({
                    path: configPath,
                    message: `Config file not found: ${configPath}`,
                  })
                )
              }
              return yield* decodeConfig(content).pipe(
                Effect.mapError(
                  (e) =>
                    new ConfigParseError({
                      message: `Invalid config: ${e.message}`,
                    })
                )
              )
            }),
        })
      })
    )
}
```

- [ ] **Step 4: Run tests**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/config.ts tests/services/config.test.ts
git commit -m "feat: add ConfigService for loading repotools.json

Uses @effect/platform FileSystem for file reading and
Schema.parseJson for type-safe JSON decoding (no raw
JSON.parse). Test impl uses in-memory file store via Ref."
```

---

## Task 4: CacheService

**Files:**
- Create: `src/services/cache.ts`
- Test: `tests/services/cache.test.ts`

- [ ] **Step 1: Write CacheService tests**

```typescript
// tests/services/cache.test.ts
import { describe, expect } from "vitest"
import { it } from "@effect/vitest"
import { Effect } from "effect"
import { CacheService } from "../../src/services/cache.js"

describe("CacheService", () => {
  it.effect("returns correct cache path", () =>
    Effect.gen(function* () {
      const cache = yield* CacheService
      const path = yield* cache.toolPath("mycli", "v1.0.0")
      expect(path).toContain("mycli")
      expect(path).toContain("v1.0.0")
    }).pipe(Effect.provide(CacheService.Test()))
  )

  it.effect("reports not cached when tool missing", () =>
    Effect.gen(function* () {
      const cache = yield* CacheService
      const exists = yield* cache.isCached("mycli", "v1.0.0")
      expect(exists).toBe(false)
    }).pipe(Effect.provide(CacheService.Test()))
  )

  it.effect("reports cached after store", () =>
    Effect.gen(function* () {
      const cache = yield* CacheService
      yield* cache.store("mycli", "v1.0.0", new Uint8Array([1, 2, 3]))
      const exists = yield* cache.isCached("mycli", "v1.0.0")
      expect(exists).toBe(true)
    }).pipe(Effect.provide(CacheService.Test()))
  )
})
```

- [ ] **Step 2: Implement CacheService**

Uses `@effect/platform` FileSystem. Ensures directories exist before writing. Uses tagged errors.

```typescript
// src/services/cache.ts
import { Context, Effect, Layer, Ref } from "effect"
import { FileSystem } from "@effect/platform"
import * as path from "node:path"
import * as os from "node:os"
import { DownloadError } from "../errors.js"

const CACHE_ROOT = path.join(os.homedir(), ".repotools", "cache")

export interface CacheServiceShape {
  readonly toolPath: (tool: string, version: string) => Effect.Effect<string>
  readonly isCached: (tool: string, version: string) => Effect.Effect<boolean>
  readonly store: (tool: string, version: string, binary: Uint8Array) => Effect.Effect<void, DownloadError>
  readonly getBinaryPath: (tool: string, version: string) => Effect.Effect<string>
}

export class CacheService extends Context.Tag("CacheService")<
  CacheService,
  CacheServiceShape
>() {
  static Live = Layer.effect(
    CacheService,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      return CacheService.of({
        toolPath: (tool, version) =>
          Effect.succeed(path.join(CACHE_ROOT, tool, version)),

        isCached: (tool, version) => {
          const binPath = path.join(CACHE_ROOT, tool, version, tool)
          return fs.exists(binPath)
        },

        store: (tool, version, binary) =>
          Effect.gen(function* () {
            const dir = path.join(CACHE_ROOT, tool, version)
            yield* fs.makeDirectory(dir, { recursive: true })
            const binPath = path.join(dir, tool)
            yield* fs.writeFile(binPath, binary)
            // Make executable (rwxr-xr-x = 0o755)
            yield* fs.chmod(binPath, 0o755)
          }).pipe(
            Effect.mapError(
              (e) =>
                new DownloadError({
                  url: "cache",
                  message: `Failed to store ${tool}@${version}: ${e}`,
                })
            )
          ),

        getBinaryPath: (tool, version) =>
          Effect.succeed(path.join(CACHE_ROOT, tool, version, tool)),
      })
    })
  )

  static Test = () =>
    Layer.effect(
      CacheService,
      Effect.gen(function* () {
        const store = yield* Ref.make(new Map<string, Uint8Array>())
        const key = (tool: string, version: string) => `${tool}@${version}`
        return CacheService.of({
          toolPath: (tool, version) =>
            Effect.succeed(`/mock-cache/${tool}/${version}`),
          isCached: (tool, version) =>
            Ref.get(store).pipe(Effect.map((m) => m.has(key(tool, version)))),
          store: (tool, version, binary) =>
            Ref.update(store, (m) => new Map([...m, [key(tool, version), binary]])),
          getBinaryPath: (tool, version) =>
            Effect.succeed(`/mock-cache/${tool}/${version}/${tool}`),
        })
      })
    )
}
```

- [ ] **Step 3: Run tests**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/services/cache.ts tests/services/cache.test.ts
git commit -m "feat: add CacheService for tool binary caching

Global cache at ~/.repotools/cache/<tool>/<version>/.
Uses @effect/platform FileSystem for all I/O. Ensures
directories exist before writing (mkdir -p). Idempotent."
```

---

## Task 5: GithubApiService + Asset Matching

**Files:**
- Create: `src/services/github-api.ts`, `src/sources/github-release.ts`
- Test: `tests/sources/github-release.test.ts`

- [ ] **Step 1: Write asset matching tests**

```typescript
// tests/sources/github-release.test.ts
import { describe, expect, it } from "vitest"
import { matchAsset } from "../../src/sources/github-release.js"

describe("matchAsset", () => {
  const darwinArm64 = { os: "darwin" as const, arch: "arm64" as const }
  const linuxX64 = { os: "linux" as const, arch: "x64" as const }

  const assets = [
    { name: "tool-darwin-arm64", browser_download_url: "https://example.com/tool-darwin-arm64" },
    { name: "tool-linux-x86_64.tar.gz", browser_download_url: "https://example.com/tool-linux-x86_64.tar.gz" },
    { name: "tool-darwin-arm64.tar.gz", browser_download_url: "https://example.com/tool-darwin-arm64.tar.gz" },
    { name: "checksums.txt", browser_download_url: "https://example.com/checksums.txt" },
    { name: "tool.sha256", browser_download_url: "https://example.com/tool.sha256" },
  ]

  it("matches darwin-arm64 binary", () => {
    const result = matchAsset(assets, darwinArm64)
    expect(result).toBeDefined()
    expect(result!.name).toContain("darwin")
    expect(result!.name).toContain("arm64")
  })

  it("matches linux-x64 with x86_64 alias", () => {
    const result = matchAsset(assets, linuxX64)
    expect(result).toBeDefined()
    expect(result!.name).toContain("linux")
  })

  it("skips checksum and signature files", () => {
    const onlyChecksums = [
      { name: "checksums.txt", browser_download_url: "https://example.com/checksums.txt" },
      { name: "tool.sha256", browser_download_url: "https://example.com/tool.sha256" },
      { name: "tool.sig", browser_download_url: "https://example.com/tool.sig" },
    ]
    const result = matchAsset(onlyChecksums, darwinArm64)
    expect(result).toBeUndefined()
  })

  it("uses assetPattern when provided", () => {
    const result = matchAsset(assets, darwinArm64, "tool-darwin-arm64.tar.gz")
    expect(result).toBeDefined()
    expect(result!.name).toBe("tool-darwin-arm64.tar.gz")
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

- [ ] **Step 3: Implement asset matching**

```typescript
// src/sources/github-release.ts
import type { PlatformInfo } from "../services/platform.js"

export interface GithubRelease {
  readonly tag_name: string
  readonly assets: Array<{
    readonly name: string
    readonly browser_download_url: string
  }>
}

// Extensions to skip — checksums, signatures, docs
const SKIP_EXTENSIONS = /\.(txt|sha256|sha512|md5|sig|asc|sbom|json)$/i

const OS_ALIASES: Record<string, Array<string>> = {
  darwin: ["darwin", "macos", "apple", "osx"],
  linux: ["linux"],
  windows: ["windows", "win"],
}

const ARCH_ALIASES: Record<string, Array<string>> = {
  arm64: ["arm64", "aarch64"],
  x64: ["x64", "x86_64", "amd64"],
}

export const matchAsset = (
  assets: Array<{ name: string; browser_download_url: string }>,
  platform: PlatformInfo,
  assetPattern?: string
): { name: string; url: string } | undefined => {
  // If explicit pattern provided, use it directly
  if (assetPattern) {
    const globRegex = new RegExp(
      "^" + assetPattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
      "i"
    )
    const match = assets.find((a) => globRegex.test(a.name))
    return match ? { name: match.name, url: match.browser_download_url } : undefined
  }

  // Filter out non-binary files
  const candidates = assets.filter((a) => !SKIP_EXTENSIONS.test(a.name))

  // Build platform match patterns
  const osAliases = OS_ALIASES[platform.os] ?? [platform.os]
  const archAliases = ARCH_ALIASES[platform.arch] ?? [platform.arch]
  const patterns = osAliases.flatMap((o) =>
    archAliases.map((a) => new RegExp(`${o}[^a-z]*${a}|${a}[^a-z]*${o}`, "i"))
  )

  const match = candidates.find((a) =>
    patterns.some((p) => p.test(a.name))
  )
  return match ? { name: match.name, url: match.browser_download_url } : undefined
}

export const isArchive = (filename: string): boolean =>
  /\.(tar\.gz|tgz|tar\.bz2|tar\.xz|zip)$/i.test(filename)
```

- [ ] **Step 4: Implement GithubApiService**

```typescript
// src/services/github-api.ts
import { Context, Effect, Layer, Ref } from "effect"
import { GithubApiError } from "../errors.js"
import type { GithubRelease } from "../sources/github-release.js"

export interface GithubApiServiceShape {
  readonly fetchReleases: (
    repo: string
  ) => Effect.Effect<Array<GithubRelease>, GithubApiError>
}

export class GithubApiService extends Context.Tag("GithubApiService")<
  GithubApiService,
  GithubApiServiceShape
>() {
  static Live = Layer.succeed(GithubApiService, {
    fetchReleases: (repo) =>
      Effect.tryPromise({
        try: async () => {
          const headers: Record<string, string> = {
            Accept: "application/vnd.github.v3+json",
          }
          // Support GITHUB_TOKEN for higher rate limits
          const token = process.env.GITHUB_TOKEN
          if (token) {
            headers.Authorization = `Bearer ${token}`
          }
          const res = await fetch(
            `https://api.github.com/repos/${repo}/releases?per_page=10`,
            { headers }
          )
          if (!res.ok) throw new Error(`GitHub API ${res.status}: ${res.statusText}`)
          return (await res.json()) as Array<GithubRelease>
        },
        catch: (e) =>
          new GithubApiError({
            repo,
            message: `Failed to fetch releases for ${repo}: ${e}`,
          }),
      }),
  })

  static Test = (
    registry: Record<string, Array<GithubRelease>> = {}
  ) =>
    Layer.succeed(GithubApiService, {
      fetchReleases: (repo) => {
        const releases = registry[repo]
        return releases
          ? Effect.succeed(releases)
          : Effect.fail(
              new GithubApiError({
                repo,
                message: `No releases found for ${repo}`,
              })
            )
      },
    })
}
```

- [ ] **Step 5: Run tests**

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/sources/github-release.ts src/services/github-api.ts tests/sources/github-release.test.ts
git commit -m "feat: add GithubApiService + asset matching

GithubApiService wraps GitHub Releases API with optional
GITHUB_TOKEN auth for rate limits. Asset matcher filters
out checksums/signatures, supports OS/arch aliases
(macos, x86_64, amd64), and optional assetPattern override."
```

---

## Task 6: ResolverService

**Files:**
- Create: `src/services/resolver.ts`
- Test: `tests/services/resolver.test.ts`

- [ ] **Step 1: Write resolver tests**

```typescript
// tests/services/resolver.test.ts
import { describe, expect } from "vitest"
import { it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { ResolverService } from "../../src/services/resolver.js"
import { PlatformService } from "../../src/services/platform.js"
import { GithubApiService } from "../../src/services/github-api.js"

describe("ResolverService", () => {
  const platformLayer = PlatformService.Test({ os: "darwin", arch: "arm64" })
  const githubLayer = GithubApiService.Test({
    "org/tool": [
      {
        tag_name: "v1.0.0",
        assets: [
          { name: "tool-darwin-arm64", browser_download_url: "https://example.com/tool-darwin-arm64" },
          { name: "tool-linux-x64", browser_download_url: "https://example.com/tool-linux-x64" },
        ],
      },
    ],
  })

  const testLayer = Layer.mergeAll(platformLayer, githubLayer).pipe(
    Layer.provideMerge(ResolverService.Live)
  )

  it.effect("resolves latest github release", () =>
    Effect.gen(function* () {
      const resolver = yield* ResolverService
      const result = yield* resolver.resolve(
        {
          source: { type: "github-release" as const, repo: "org/tool" },
          version: "latest",
        },
        "tool"
      )
      expect(result.version).toBe("v1.0.0")
      expect(result.downloadUrl).toContain("darwin")
    }).pipe(Effect.provide(testLayer))
  )
})
```

- [ ] **Step 2: Implement ResolverService**

```typescript
// src/services/resolver.ts
import { Context, Effect, Layer } from "effect"
import type { ToolConfig } from "../schema/config.js"
import { PlatformService } from "./platform.js"
import { GithubApiService } from "./github-api.js"
import { ReleaseNotFoundError, UnsupportedPlatformError } from "../errors.js"
import { matchAsset } from "../sources/github-release.js"

export interface ResolvedTool {
  readonly version: string
  readonly downloadUrl: string
  readonly assetName: string
}

export interface ResolverServiceShape {
  readonly resolve: (
    tool: ToolConfig,
    toolName: string
  ) => Effect.Effect<
    ResolvedTool,
    ReleaseNotFoundError | UnsupportedPlatformError
  >
}

export class ResolverService extends Context.Tag("ResolverService")<
  ResolverService,
  ResolverServiceShape
>() {
  static Live = Layer.effect(
    ResolverService,
    Effect.gen(function* () {
      const platform = yield* PlatformService
      const github = yield* GithubApiService
      return ResolverService.of({
        resolve: (tool, toolName) =>
          Effect.gen(function* () {
            const info = yield* platform.detect()
            const { source, version, assetPattern } = tool

            const releases = yield* github.fetchReleases(source.repo).pipe(
              Effect.mapError(
                (e) =>
                  new ReleaseNotFoundError({
                    repo: source.repo,
                    version,
                    message: e.message,
                  })
              )
            )

            const release =
              version === "latest"
                ? releases[0]
                : releases.find((r) => r.tag_name === version)

            if (!release) {
              return yield* Effect.fail(
                new ReleaseNotFoundError({
                  repo: source.repo,
                  version,
                  message: `Release ${version} not found for ${source.repo}`,
                })
              )
            }

            const asset = matchAsset(release.assets, info, assetPattern)
            if (!asset) {
              return yield* Effect.fail(
                new UnsupportedPlatformError({
                  os: info.os,
                  arch: info.arch,
                  message: `No binary for ${info.os}-${info.arch} in ${source.repo}@${release.tag_name}`,
                })
              )
            }

            return {
              version: release.tag_name,
              downloadUrl: asset.url,
              assetName: asset.name,
            }
          }),
      })
    })
  )

  static Test = (
    resolved: Record<string, ResolvedTool> = {}
  ) =>
    Layer.succeed(ResolverService, {
      resolve: (tool, toolName) => {
        const result = resolved[toolName]
        return result
          ? Effect.succeed(result)
          : Effect.fail(
              new ReleaseNotFoundError({
                repo: tool.source.repo,
                version: tool.version,
                message: `No test resolution for ${toolName}`,
              })
            )
      },
    })
}
```

- [ ] **Step 3: Run tests**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/services/resolver.ts tests/services/resolver.test.ts
git commit -m "feat: add ResolverService for tool version resolution

Composes GithubApiService + PlatformService to resolve
tool configs to downloadable assets. Supports 'latest'
and pinned version tags. Passes assetPattern through
for explicit matching."
```

---

## Task 7: DownloaderService + Archive Extraction

**Files:**
- Create: `src/services/downloader.ts`

- [ ] **Step 1: Implement DownloaderService**

Handles both raw binaries and archive extraction (.tar.gz, .zip):

```typescript
// src/services/downloader.ts
import { Context, Effect, Layer, Ref } from "effect"
import { DownloadError, ExtractError } from "../errors.js"
import { isArchive } from "../sources/github-release.js"

export interface DownloaderServiceShape {
  readonly download: (
    url: string,
    assetName: string,
    toolName: string
  ) => Effect.Effect<Uint8Array, DownloadError | ExtractError>
}

export class DownloaderService extends Context.Tag("DownloaderService")<
  DownloaderService,
  DownloaderServiceShape
>() {
  static Live = Layer.succeed(DownloaderService, {
    download: (url, assetName, toolName) =>
      Effect.gen(function* () {
        const data = yield* Effect.tryPromise({
          try: async () => {
            const res = await fetch(url, {
              redirect: "follow",
              headers: {
                Accept: "application/octet-stream",
                ...(process.env.GITHUB_TOKEN
                  ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
                  : {}),
              },
            })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return new Uint8Array(await res.arrayBuffer())
          },
          catch: (e) =>
            new DownloadError({ url, message: `Download failed: ${e}` }),
        })

        if (!isArchive(assetName)) return data

        // Extract archive to temp dir, find the binary
        return yield* Effect.tryPromise({
          try: async () => {
            const tmpDir = `${Bun.env.TMPDIR ?? "/tmp"}/repotools-extract-${Date.now()}`
            await Bun.write(`${tmpDir}/${assetName}`, data)
            const ext = assetName.match(/\.(tar\.gz|tgz|tar\.bz2|tar\.xz|zip)$/i)?.[1]
            if (ext === "zip") {
              const proc = Bun.spawn(["unzip", "-o", `${tmpDir}/${assetName}`, "-d", tmpDir])
              await proc.exited
            } else {
              const proc = Bun.spawn(["tar", "xf", `${tmpDir}/${assetName}`, "-C", tmpDir])
              await proc.exited
            }
            // Find the binary — look for exact tool name or any executable
            const { stdout } = Bun.spawn(["find", tmpDir, "-type", "f", "-name", toolName])
            const found = (await new Response(stdout).text()).trim().split("\n").filter(Boolean)
            const binPath = found[0]
            if (!binPath) {
              // Fallback: find any executable file
              const { stdout: stdout2 } = Bun.spawn(["find", tmpDir, "-type", "f", "-perm", "+111"])
              const executables = (await new Response(stdout2).text()).trim().split("\n").filter(Boolean)
              if (executables.length === 0) throw new Error("No executable found in archive")
              return new Uint8Array(await Bun.file(executables[0]).arrayBuffer())
            }
            return new Uint8Array(await Bun.file(binPath).arrayBuffer())
          },
          catch: (e) =>
            new ExtractError({
              asset: assetName,
              message: `Failed to extract ${assetName}: ${e}`,
            }),
        })
      }),
  })

  static Test = (files: Record<string, Uint8Array> = {}) =>
    Layer.effect(
      DownloaderService,
      Effect.gen(function* () {
        const store = yield* Ref.make(new Map(Object.entries(files)))
        return DownloaderService.of({
          download: (url, _assetName, _toolName) =>
            Ref.get(store).pipe(
              Effect.flatMap((m) => {
                const data = m.get(url)
                return data
                  ? Effect.succeed(data)
                  : Effect.fail(
                      new DownloadError({ url, message: "Not found in test store" })
                    )
              })
            ),
        })
      })
    )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/downloader.ts
git commit -m "feat: add DownloaderService with archive extraction

Follows GitHub asset redirects. Handles .tar.gz, .tgz,
.zip archives by extracting and finding the binary.
Supports GITHUB_TOKEN for authenticated downloads."
```

---

## Task 8: LinkerService

**Files:**
- Create: `src/services/linker.ts`
- Test: `tests/services/linker.test.ts`

- [ ] **Step 1: Write linker tests**

```typescript
// tests/services/linker.test.ts
import { describe, expect } from "vitest"
import { it } from "@effect/vitest"
import { Effect } from "effect"
import { LinkerService } from "../../src/services/linker.js"

describe("LinkerService", () => {
  it.effect("creates symlink for tool", () =>
    Effect.gen(function* () {
      const linker = yield* LinkerService
      yield* linker.link("mycli", "/cache/mycli/v1.0.0/mycli", "/project")
      const links = yield* linker.listLinks("/project")
      expect(links).toHaveLength(1)
      expect(links[0].tool).toBe("mycli")
    }).pipe(Effect.provide(LinkerService.Test()))
  )
})
```

- [ ] **Step 2: Implement LinkerService**

Uses `@effect/platform` FileSystem:

```typescript
// src/services/linker.ts
import { Context, Effect, Layer, Ref } from "effect"
import { FileSystem } from "@effect/platform"
import * as path from "node:path"
import { LinkError } from "../errors.js"

const BIN_DIR = ".repotools/bin"

export interface ToolLink {
  readonly tool: string
  readonly target: string
}

export interface LinkerServiceShape {
  readonly link: (
    tool: string,
    binaryPath: string,
    projectDir: string
  ) => Effect.Effect<void, LinkError>
  readonly listLinks: (
    projectDir: string
  ) => Effect.Effect<Array<ToolLink>>
}

export class LinkerService extends Context.Tag("LinkerService")<
  LinkerService,
  LinkerServiceShape
>() {
  static Live = Layer.effect(
    LinkerService,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      return LinkerService.of({
        link: (tool, binaryPath, projectDir) =>
          Effect.gen(function* () {
            const binDir = path.join(projectDir, BIN_DIR)
            yield* fs.makeDirectory(binDir, { recursive: true })
            const linkPath = path.join(binDir, tool)
            yield* fs.remove(linkPath, { force: true }).pipe(Effect.ignore)
            yield* fs.symlink(binaryPath, linkPath)
          }).pipe(
            Effect.mapError(
              (e) => new LinkError({ tool, message: `Failed to link ${tool}: ${e}` })
            )
          ),

        listLinks: (projectDir) =>
          Effect.gen(function* () {
            const binDir = path.join(projectDir, BIN_DIR)
            const exists = yield* fs.exists(binDir)
            if (!exists) return []
            const entries = yield* fs.readDirectory(binDir)
            const links: Array<ToolLink> = []
            for (const entry of entries) {
              const linkPath = path.join(binDir, entry)
              const target = yield* fs.readLink(linkPath).pipe(
                Effect.catchAll(() => Effect.succeed(""))
              )
              if (target) links.push({ tool: entry, target })
            }
            return links
          }).pipe(Effect.catchAll(() => Effect.succeed([]))),
      })
    })
  )

  static Test = () =>
    Layer.effect(
      LinkerService,
      Effect.gen(function* () {
        const store = yield* Ref.make(new Map<string, Array<ToolLink>>())
        return LinkerService.of({
          link: (tool, binaryPath, projectDir) =>
            Ref.update(store, (m) => {
              const links = m.get(projectDir) ?? []
              return new Map([
                ...m,
                [projectDir, [...links.filter((l) => l.tool !== tool), { tool, target: binaryPath }]],
              ])
            }),
          listLinks: (projectDir) =>
            Ref.get(store).pipe(Effect.map((m) => m.get(projectDir) ?? [])),
        })
      })
    )
}
```

- [ ] **Step 3: Run tests**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/services/linker.ts tests/services/linker.test.ts
git commit -m "feat: add LinkerService for project-local symlinks

Creates .repotools/bin/ with symlinks to global cache.
Uses @effect/platform FileSystem. Idempotent re-linking."
```

---

## Task 9: Install Command

**Files:**
- Create: `src/commands/install.ts`
- Test: `tests/commands/install.test.ts`

- [ ] **Step 1: Write install command test**

```typescript
// tests/commands/install.test.ts
import { describe, expect } from "vitest"
import { it } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { installHandler } from "../../src/commands/install.js"
import { ConfigService } from "../../src/services/config.js"
import { ResolverService } from "../../src/services/resolver.js"
import { DownloaderService } from "../../src/services/downloader.js"
import { CacheService } from "../../src/services/cache.js"
import { LinkerService } from "../../src/services/linker.js"

describe("install command", () => {
  const testLayer = Layer.mergeAll(
    ConfigService.Test({
      "/project/repotools.json": JSON.stringify({
        tools: {
          mycli: {
            source: { type: "github-release", repo: "org/mycli" },
            version: "latest",
          },
        },
      }),
    }),
    ResolverService.Test({
      mycli: {
        version: "v1.0.0",
        downloadUrl: "https://example.com/binary",
        assetName: "mycli-darwin-arm64",
      },
    }),
    DownloaderService.Test({
      "https://example.com/binary": new Uint8Array([1, 2, 3]),
    }),
    CacheService.Test(),
    LinkerService.Test(),
  )

  it.effect("installs tools from config", () =>
    Effect.gen(function* () {
      yield* installHandler("/project")
      const cache = yield* CacheService
      const isCached = yield* cache.isCached("mycli", "v1.0.0")
      expect(isCached).toBe(true)
    }).pipe(Effect.provide(testLayer))
  )
})
```

- [ ] **Step 2: Implement install command**

```typescript
// src/commands/install.ts
import { Command } from "@effect/cli"
import { Effect } from "effect"
import { ConfigService } from "../services/config.js"
import { ResolverService } from "../services/resolver.js"
import { DownloaderService } from "../services/downloader.js"
import { CacheService } from "../services/cache.js"
import { LinkerService } from "../services/linker.js"

export const installHandler = (cwd: string) =>
  Effect.gen(function* () {
    const config = yield* ConfigService
    const resolver = yield* ResolverService
    const downloader = yield* DownloaderService
    const cache = yield* CacheService
    const linker = yield* LinkerService

    const repoConfig = yield* config.load(cwd)

    for (const [name, toolConfig] of Object.entries(repoConfig.tools)) {
      const resolved = yield* resolver.resolve(toolConfig, name)
      const alreadyCached = yield* cache.isCached(name, resolved.version)

      if (alreadyCached) {
        yield* Effect.log(`${name}@${resolved.version} already cached, skipping`)
      } else {
        yield* Effect.log(`Downloading ${name}@${resolved.version}...`)
        const binary = yield* downloader.download(
          resolved.downloadUrl,
          resolved.assetName,
          name
        )
        yield* cache.store(name, resolved.version, binary)
        yield* Effect.log(`Cached ${name}@${resolved.version}`)
      }

      const binaryPath = yield* cache.getBinaryPath(name, resolved.version)
      yield* linker.link(name, binaryPath, cwd)
      yield* Effect.log(`Linked ${name} -> ${binaryPath}`)
    }

    yield* Effect.log("Install complete")
  })

export const installCommand = Command.make(
  "install",
  {},
  () => installHandler(process.cwd())
).pipe(Command.withDescription("Install tools defined in repotools.json"))
```

- [ ] **Step 3: Run tests**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/commands/install.ts tests/commands/install.test.ts
git commit -m "feat: add install command

Reads repotools.json, resolves versions, downloads binaries,
caches globally, symlinks into project .repotools/bin/."
```

---

## Task 10: List Command

**Files:**
- Create: `src/commands/list.ts`
- Test: `tests/commands/list.test.ts`

- [ ] **Step 1: Implement list command**

```typescript
// src/commands/list.ts
import { Command } from "@effect/cli"
import { Effect } from "effect"
import { LinkerService } from "../services/linker.js"

export const listCommand = Command.make("list", {}, () =>
  Effect.gen(function* () {
    const linker = yield* LinkerService
    const links = yield* linker.listLinks(process.cwd())

    if (links.length === 0) {
      yield* Effect.log("No tools installed. Run `repotools install` first.")
      return
    }

    yield* Effect.log("Installed tools:")
    for (const link of links) {
      yield* Effect.log(`  ${link.tool} -> ${link.target}`)
    }
  })
).pipe(Command.withDescription("List installed tools and their versions"))
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/list.ts
git commit -m "feat: add list command"
```

---

## Task 11: Update Command

**Files:**
- Create: `src/commands/update.ts`

- [ ] **Step 1: Implement update command**

```typescript
// src/commands/update.ts
import { Command } from "@effect/cli"
import { Effect } from "effect"
import { ConfigService } from "../services/config.js"
import { ResolverService } from "../services/resolver.js"
import { DownloaderService } from "../services/downloader.js"
import { CacheService } from "../services/cache.js"
import { LinkerService } from "../services/linker.js"

export const updateCommand = Command.make("update", {}, () =>
  Effect.gen(function* () {
    const config = yield* ConfigService
    const resolver = yield* ResolverService
    const downloader = yield* DownloaderService
    const cache = yield* CacheService
    const linker = yield* LinkerService

    const cwd = process.cwd()
    const repoConfig = yield* config.load(cwd)

    for (const [name, toolConfig] of Object.entries(repoConfig.tools)) {
      yield* Effect.log(`Checking ${name}...`)
      const resolved = yield* resolver.resolve(toolConfig, name)
      const alreadyCached = yield* cache.isCached(name, resolved.version)

      if (alreadyCached) {
        yield* Effect.log(`${name}@${resolved.version} is up to date`)
      } else {
        yield* Effect.log(`Updating ${name} to ${resolved.version}...`)
        const binary = yield* downloader.download(
          resolved.downloadUrl,
          resolved.assetName,
          name
        )
        yield* cache.store(name, resolved.version, binary)
        const binaryPath = yield* cache.getBinaryPath(name, resolved.version)
        yield* linker.link(name, binaryPath, cwd)
        yield* Effect.log(`Updated ${name}@${resolved.version}`)
      }
    }

    yield* Effect.log("Update complete")
  })
).pipe(Command.withDescription("Check for and install newer tool versions"))
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/update.ts
git commit -m "feat: add update command"
```

---

## Task 12: Exec Command

**Files:**
- Create: `src/commands/exec.ts`

- [ ] **Step 1: Implement exec command**

Uses `@effect/platform` CommandExecutor for process spawning:

```typescript
// src/commands/exec.ts
import { Args, Command } from "@effect/cli"
import { Effect } from "effect"
import { LinkerService } from "../services/linker.js"
import { ExecError, ToolNotFoundError } from "../errors.js"
import * as path from "node:path"
import { Command as PlatformCommand, CommandExecutor } from "@effect/platform"

const toolArg = Args.text({ name: "tool" }).pipe(
  Args.withDescription("Name of the tool to execute")
)

const restArgs = Args.text({ name: "args" }).pipe(
  Args.repeated,
  Args.withDescription("Arguments to pass to the tool")
)

export const execCommand = Command.make(
  "exec",
  { tool: toolArg, args: restArgs },
  ({ tool, args }) =>
    Effect.gen(function* () {
      const linker = yield* LinkerService
      const cwd = process.cwd()
      const links = yield* linker.listLinks(cwd)
      const link = links.find((l) => l.tool === tool)

      if (!link) {
        return yield* Effect.fail(
          new ToolNotFoundError({
            tool,
            message: `Tool "${tool}" not installed. Run \`repotools install\` first.`,
          })
        )
      }

      const binPath = path.join(cwd, ".repotools", "bin", tool)
      const executor = yield* CommandExecutor.CommandExecutor
      const command = PlatformCommand.make(binPath, ...args)
      const process_ = yield* executor.start(command)
      const exitCode = yield* process_.exitCode
      if (exitCode !== 0) {
        return yield* Effect.fail(
          new ExecError({
            tool,
            message: `${tool} exited with code ${exitCode}`,
          })
        )
      }
    })
).pipe(Command.withDescription("Execute an installed tool"))
```

- [ ] **Step 2: Commit**

```bash
git add src/commands/exec.ts
git commit -m "feat: add exec command

Uses @effect/platform CommandExecutor for process spawning.
Looks up tool in .repotools/bin/ symlinks."
```

---

## Task 13: Root Command + CLI Entrypoint

**Files:**
- Create: `src/commands.ts`
- Modify: `src/cli.ts`

- [ ] **Step 1: Create root command**

```typescript
// src/commands.ts
import { Command } from "@effect/cli"
import { installCommand } from "./commands/install.js"
import { listCommand } from "./commands/list.js"
import { updateCommand } from "./commands/update.js"
import { execCommand } from "./commands/exec.js"

export const rootCommand = Command.make("repotools").pipe(
  Command.withDescription(
    "Declarative CLI tool manager — install, cache, and run repo-defined tools"
  ),
  Command.withSubcommands([installCommand, listCommand, updateCommand, execCommand])
)
```

- [ ] **Step 2: Update CLI entrypoint**

```typescript
// src/cli.ts
#!/usr/bin/env bun
import { Command } from "@effect/cli"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Effect, Layer } from "effect"
import { rootCommand } from "./commands.js"
import { ConfigService } from "./services/config.js"
import { GithubApiService } from "./services/github-api.js"
import { ResolverService } from "./services/resolver.js"
import { DownloaderService } from "./services/downloader.js"
import { CacheService } from "./services/cache.js"
import { LinkerService } from "./services/linker.js"
import { PlatformService } from "./services/platform.js"

const PlatformLayer = PlatformService.Live

const GithubLayer = GithubApiService.Live

const ResolverLayer = ResolverService.Live.pipe(
  Layer.provide(Layer.mergeAll(PlatformLayer, GithubLayer))
)

const CacheLiveLayer = CacheService.Live.pipe(
  Layer.provide(BunContext.layer)
)

const ConfigLiveLayer = ConfigService.Live.pipe(
  Layer.provide(BunContext.layer)
)

const LinkerLiveLayer = LinkerService.Live.pipe(
  Layer.provide(BunContext.layer)
)

const AppLayer = Layer.mergeAll(
  ConfigLiveLayer,
  ResolverLayer,
  DownloaderService.Live,
  CacheLiveLayer,
  LinkerLiveLayer,
  PlatformLayer,
  BunContext.layer
)

const cli = Command.run(rootCommand, {
  name: "repotools",
  version: "0.1.0",
})

cli(process.argv).pipe(Effect.provide(AppLayer), BunRuntime.runMain)
```

- [ ] **Step 3: Verify**

```bash
bun run typecheck
bun test
bun run src/cli.ts --help
bun run src/cli.ts install --help
```

- [ ] **Step 4: Commit**

```bash
git add src/commands.ts src/cli.ts
git commit -m "feat: wire up root command and CLI entrypoint

Composes all services via Layer. Uses BunContext for
@effect/platform FileSystem + CommandExecutor. No
duplicate service provisions."
```

---

## Task 14: Build + README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Test build**

```bash
bun build src/cli.ts --compile --outfile repotools
./repotools --help
```

- [ ] **Step 2: Create README**

Cover: what repotools does, install, config format, commands, GITHUB_TOKEN, build from source.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README with usage and config examples"
```

---

## Task 15: End-to-End Smoke Test

- [ ] **Step 1: Create a test repotools.json** (pick a real repo with GitHub releases, e.g. `jqlang/jq`)

- [ ] **Step 2: Run install, list, exec**

```bash
bun run src/cli.ts install
bun run src/cli.ts list
bun run src/cli.ts exec jq --help
```

- [ ] **Step 3: Fix any issues, commit**

---

## Design Decisions

1. **@effect/platform FileSystem** — All file I/O goes through the Effect FileSystem service, keeping the "services for everything side-effectful" principle and enabling testability.

2. **GithubApiService** — Dedicated service wrapping GitHub API calls. Supports `GITHUB_TOKEN` for rate limit avoidance. Testable via mock registry.

3. **Schema.parseJson** — Config decoding uses `Schema.parseJson(RepoToolsConfig)` for type-safe JSON parsing. No raw `JSON.parse`.

4. **Archive extraction** — DownloaderService handles `.tar.gz`, `.tgz`, `.zip` archives since most GitHub releases ship as archives, not raw binaries.

5. **Asset matching** — Filters out checksums/signatures first, then matches platform patterns with OS/arch aliases. Optional `assetPattern` config field for repos with unusual naming.

6. **Global cache + local symlinks** — Same binary isn't downloaded twice. `mkdir -p` ensures directories exist before writes.

7. **Pluggable sources** — `ToolSource` is a union type. Adding a new source means a new Schema variant and resolver case.

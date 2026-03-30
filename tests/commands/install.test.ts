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

  it.effect("skips already cached tools", () =>
    Effect.gen(function* () {
      const cache = yield* CacheService
      yield* cache.store("mycli", "v1.0.0", new Uint8Array([1, 2, 3]))
      yield* installHandler("/project")
      // Should succeed without downloading again
      const isCached = yield* cache.isCached("mycli", "v1.0.0")
      expect(isCached).toBe(true)
    }).pipe(Effect.provide(testLayer))
  )

  it.effect("links tools to project", () =>
    Effect.gen(function* () {
      yield* installHandler("/project")
      const linker = yield* LinkerService
      const links = yield* linker.listLinks("/project")
      expect(links).toHaveLength(1)
      expect(links[0].tool).toBe("mycli")
    }).pipe(Effect.provide(testLayer))
  )
})

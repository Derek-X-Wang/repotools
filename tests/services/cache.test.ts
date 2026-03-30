import { describe, expect } from "vitest"
import { it } from "@effect/vitest"
import { Effect } from "effect"
import { CacheService } from "../../src/services/cache.js"

describe("CacheService", () => {
  it.effect("returns correct cache path", () =>
    Effect.gen(function* () {
      const cache = yield* CacheService
      const p = yield* cache.toolPath("mycli", "v1.0.0")
      expect(p).toContain("mycli")
      expect(p).toContain("v1.0.0")
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

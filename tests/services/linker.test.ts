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
      expect(links[0].target).toBe("/cache/mycli/v1.0.0/mycli")
    }).pipe(Effect.provide(LinkerService.Test()))
  )

  it.effect("replaces existing link", () =>
    Effect.gen(function* () {
      const linker = yield* LinkerService
      yield* linker.link("mycli", "/cache/mycli/v1.0.0/mycli", "/project")
      yield* linker.link("mycli", "/cache/mycli/v2.0.0/mycli", "/project")
      const links = yield* linker.listLinks("/project")
      expect(links).toHaveLength(1)
      expect(links[0].target).toBe("/cache/mycli/v2.0.0/mycli")
    }).pipe(Effect.provide(LinkerService.Test()))
  )

  it.effect("returns empty for unlinked project", () =>
    Effect.gen(function* () {
      const linker = yield* LinkerService
      const links = yield* linker.listLinks("/empty-project")
      expect(links).toHaveLength(0)
    }).pipe(Effect.provide(LinkerService.Test()))
  )
})

import { describe, expect } from "vitest"
import { it } from "@effect/vitest"
import { Effect, Exit, Schema } from "effect"
import { RepoToolsConfig } from "../../src/schema/config.js"
import { ConfigService } from "../../src/services/config.js"

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

describe("ConfigService", () => {
  it.effect("loads valid config from cwd", () =>
    Effect.gen(function* () {
      const config = yield* ConfigService
      const result = yield* config.load("/project")
      expect(result.tools).toBeDefined()
      expect(result.tools.mycli).toBeDefined()
      expect(result.tools.mycli.version).toBe("latest")
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

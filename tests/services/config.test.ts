import { describe, expect, it } from "vitest"
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

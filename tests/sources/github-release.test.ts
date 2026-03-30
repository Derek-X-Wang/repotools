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

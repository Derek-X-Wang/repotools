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

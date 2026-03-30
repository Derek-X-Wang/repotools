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
            const headers: Record<string, string> = {
              Accept: "application/octet-stream",
            }
            const token = process.env.GITHUB_TOKEN
            if (token) {
              headers.Authorization = `Bearer ${token}`
            }
            const res = await fetch(url, { redirect: "follow", headers })
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
            const tmpDir = `${process.env.TMPDIR ?? "/tmp"}/repotools-extract-${Date.now()}`
            const { mkdirSync, writeFileSync, readdirSync, statSync, readFileSync } = await import("node:fs")
            const nodePath = await import("node:path")

            mkdirSync(tmpDir, { recursive: true })
            const archivePath = nodePath.join(tmpDir, assetName)
            writeFileSync(archivePath, data)

            const ext = assetName.match(/\.(tar\.gz|tgz|tar\.bz2|tar\.xz|zip)$/i)?.[1]
            const { execSync } = await import("node:child_process")

            if (ext === "zip") {
              execSync(`unzip -o "${archivePath}" -d "${tmpDir}"`, { stdio: "ignore" })
            } else {
              execSync(`tar xf "${archivePath}" -C "${tmpDir}"`, { stdio: "ignore" })
            }

            // Find the binary — search recursively for tool name or any executable
            const findBinary = (dir: string): string | undefined => {
              for (const entry of readdirSync(dir)) {
                const fullPath = nodePath.join(dir, entry)
                const stat = statSync(fullPath)
                if (stat.isDirectory()) {
                  const found = findBinary(fullPath)
                  if (found) return found
                } else if (entry === toolName) {
                  return fullPath
                }
              }
              return undefined
            }

            const found = findBinary(tmpDir)
            if (found) {
              return new Uint8Array(readFileSync(found))
            }

            // Fallback: find any executable
            const findExecutable = (dir: string): string | undefined => {
              for (const entry of readdirSync(dir)) {
                const fullPath = nodePath.join(dir, entry)
                const stat = statSync(fullPath)
                if (stat.isDirectory()) {
                  const f = findExecutable(fullPath)
                  if (f) return f
                } else if (entry !== assetName && (stat.mode & 0o111) !== 0) {
                  return fullPath
                }
              }
              return undefined
            }

            const executable = findExecutable(tmpDir)
            if (!executable) throw new Error("No executable found in archive")
            return new Uint8Array(readFileSync(executable))
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
                const d = m.get(url)
                return d
                  ? Effect.succeed(d)
                  : Effect.fail(
                      new DownloadError({ url, message: "Not found in test store" })
                    )
              })
            ),
        })
      })
    )
}

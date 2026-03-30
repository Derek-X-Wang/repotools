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
        resolve: (tool, _toolName) =>
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

  static Test = (resolved: Record<string, ResolvedTool> = {}) =>
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

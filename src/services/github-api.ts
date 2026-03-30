import { Context, Effect, Layer } from "effect"
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

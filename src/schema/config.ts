import { Schema } from "effect"

export const GithubReleaseSource = Schema.Struct({
  type: Schema.Literal("github-release"),
  repo: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/)
  ),
})

export const ToolSource = GithubReleaseSource
// Future: Schema.Union(GithubReleaseSource, CustomUrlSource, ...)

export const ToolConfig = Schema.Struct({
  source: ToolSource,
  version: Schema.String,
  assetPattern: Schema.optional(Schema.String),
})

export const RepoToolsConfig = Schema.Struct({
  tools: Schema.Record({
    key: Schema.String.pipe(Schema.minLength(1)),
    value: ToolConfig,
  }).pipe(
    Schema.filter((tools) =>
      Object.keys(tools).length > 0 ? undefined : "tools must not be empty"
    )
  ),
})

export type RepoToolsConfig = typeof RepoToolsConfig.Type
export type ToolConfig = typeof ToolConfig.Type
export type ToolSource = typeof ToolSource.Type
export type GithubReleaseSource = typeof GithubReleaseSource.Type

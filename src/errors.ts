import { Schema } from "effect"

export class ConfigNotFoundError extends Schema.TaggedError<ConfigNotFoundError>()(
  "ConfigNotFoundError",
  { path: Schema.String, message: Schema.String }
) {}

export class ConfigParseError extends Schema.TaggedError<ConfigParseError>()(
  "ConfigParseError",
  { message: Schema.String }
) {}

export class ToolNotFoundError extends Schema.TaggedError<ToolNotFoundError>()(
  "ToolNotFoundError",
  { tool: Schema.String, message: Schema.String }
) {}

export class ReleaseNotFoundError extends Schema.TaggedError<ReleaseNotFoundError>()(
  "ReleaseNotFoundError",
  { repo: Schema.String, version: Schema.String, message: Schema.String }
) {}

export class UnsupportedPlatformError extends Schema.TaggedError<UnsupportedPlatformError>()(
  "UnsupportedPlatformError",
  { os: Schema.String, arch: Schema.String, message: Schema.String }
) {}

export class DownloadError extends Schema.TaggedError<DownloadError>()(
  "DownloadError",
  { url: Schema.String, message: Schema.String }
) {}

export class LinkError extends Schema.TaggedError<LinkError>()(
  "LinkError",
  { tool: Schema.String, message: Schema.String }
) {}

export class ExecError extends Schema.TaggedError<ExecError>()(
  "ExecError",
  { tool: Schema.String, message: Schema.String }
) {}

export class GithubApiError extends Schema.TaggedError<GithubApiError>()(
  "GithubApiError",
  { repo: Schema.String, message: Schema.String }
) {}

export class ExtractError extends Schema.TaggedError<ExtractError>()(
  "ExtractError",
  { asset: Schema.String, message: Schema.String }
) {}

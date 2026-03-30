import { Command } from "@effect/cli"
import { installCommand } from "./commands/install.js"
import { listCommand } from "./commands/list.js"
import { updateCommand } from "./commands/update.js"
import { execCommand } from "./commands/exec.js"

export const rootCommand = Command.make("repotools").pipe(
  Command.withDescription(
    "Declarative CLI tool manager — install, cache, and run repo-defined tools"
  ),
  Command.withSubcommands([installCommand, listCommand, updateCommand, execCommand])
)

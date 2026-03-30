import { Args, Command } from "@effect/cli"
import { Effect } from "effect"
import { LinkerService } from "../services/linker.js"
import { ExecError, ToolNotFoundError } from "../errors.js"
import * as path from "node:path"

const toolArg = Args.text({ name: "tool" }).pipe(
  Args.withDescription("Name of the tool to execute")
)

const restArgs = Args.text({ name: "args" }).pipe(
  Args.repeated,
  Args.withDescription("Arguments to pass to the tool")
)

export const execCommand = Command.make(
  "exec",
  { tool: toolArg, args: restArgs },
  ({ tool, args }) =>
    Effect.gen(function* () {
      const linker = yield* LinkerService
      const cwd = process.cwd()
      const links = yield* linker.listLinks(cwd)
      const link = links.find((l) => l.tool === tool)

      if (!link) {
        return yield* Effect.fail(
          new ToolNotFoundError({
            tool,
            message: `Tool "${tool}" not installed. Run \`repotools install\` first.`,
          })
        )
      }

      const binPath = path.join(cwd, ".repotools", "bin", tool)
      const exitCode = yield* Effect.tryPromise({
        try: async () => {
          const proc = Bun.spawn([binPath, ...args], {
            stdout: "inherit",
            stderr: "inherit",
            stdin: "inherit",
          })
          return proc.exited
        },
        catch: (e) =>
          new ExecError({ tool, message: `Failed to spawn ${tool}: ${e}` }),
      })

      if (exitCode !== 0) {
        return yield* Effect.fail(
          new ExecError({
            tool,
            message: `${tool} exited with code ${exitCode}`,
          })
        )
      }
    })
).pipe(Command.withDescription("Execute an installed tool"))

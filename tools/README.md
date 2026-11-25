# Workshop tools

Run the commands from the workspace root. Each folder contains one script and its own guide.

| Step | Command | Guide |
| --- | --- | --- |
| Package team libraries | `pnpm run build:lib:partial` | [Partial library build](build-partial/README.md) |
| Link for a pinned stack | `pnpm run build:stack:a21` or `pnpm run build:stack:a22` | [Full remote build](build-stack/README.md) |
| Build or serve the SPA | `pnpm run build:host` or `pnpm run serve` | [Host](host/README.md) |
| Verify the demo | `pnpm test` | [Verification](verify/README.md) |

The build scripts share two pieces of configuration. [Stack selection](stacks/README.md) locates the target compiler and exact package pins. [Remote federation configuration](remote-config/README.md) defines the browser exposure and external imports.

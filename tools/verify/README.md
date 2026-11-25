# Verify the workshop

Build the comparison outputs and run the checks with the workshop servers stopped.

```sh
pnpm run build
pnpm test
```

The archive checks compare both stacks' input checksums, inspect the partial and full Ivy declarations, and reproduce each Angular 22 remote from its tarball in a temporary directory without team sources.

The Chromium checks start the host and both remote origins, observe the actual requests at startup and after each click, and exercise the shared session from the host and both remotes. They also check chart rendering and router identity.

The test uses system Chromium on Linux when available. Set `CHROMIUM_PATH` to select an executable, or install the managed browser with `npx playwright-core install chromium`. The command prints the verified outcomes and closes its test servers. [Script](verify.mjs)

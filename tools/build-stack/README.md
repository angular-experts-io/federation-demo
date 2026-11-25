# Link a partial archive for a stack

```sh
pnpm run build:stack:a21
pnpm run build:stack:a22
```

Run these after the [partial build](../build-partial/README.md). Both commands read the same team archives. Compare the printed input hashes and target linker versions.

The script extracts the package, finds its public JavaScript entry, and runs the selected stack's Angular linker. Native Federation's esbuild adapter packages the resulting full Ivy code. The terminal shows the host-provided packages, the exposed module, its uncompressed JavaScript size, and each private dependency's contribution.

The sales delivery for the running host is `artifacts/full/sales-chart-v1.0.0-a22.2.0.tgz`. Inspect `dist/stacks/a22/reports/sales-chart/linked.mjs` for readable linker output, `bundle.json` for the esbuild breakdown, and `build.json` for the input digest and exact shared pins.

To rebuild one delivery, pass its team name or an existing tarball.

```sh
pnpm run build:stack:a22 sales-chart
pnpm run build:stack:a22 artifacts/partial/demo-sales-chart-1.0.0.tgz
```

[Script](build-stack.mjs) · [Remote configuration](../remote-config/README.md)

## Inspect a team handoff

```text
artifacts/partial/demo-sales-chart-1.0.0.tgz
  ├─ Angular 21.2.0 linker → artifacts/full/sales-chart-v1.0.0-a21.2.0.tgz
  └─ Angular 22.2.0 linker → artifacts/full/sales-chart-v1.0.0-a22.2.0.tgz
```

The partial archive's public JavaScript entry contains `ɵɵngDeclareComponent`. Each full archive contains the Native Federation `remoteEntry.json`, its referenced JavaScript, and a build report recording the producer, input hash, exact runtime pins and sizes. Compare the readable linker outputs:

```sh
tar -xOzf artifacts/partial/demo-activity-1.0.0.tgz package/fesm2022/demo-activity.mjs | rg 'ɵɵngDeclareComponent'
diff -u dist/stacks/{a21,a22}/reports/activity/linked.mjs
tar -tzf artifacts/full/sales-chart-v1.0.0-a22.2.0.tgz
```

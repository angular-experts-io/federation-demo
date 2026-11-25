# Build partial team libraries

From the workspace root, build both libraries or just the sales team's package.

```sh
pnpm run build:lib:partial
pnpm run build:lib:partial sales-chart
```

The script runs the Angular 21.2.0 CLI library target on each selected team's source. ng-packagr emits a public JavaScript entry containing `ɵɵngDeclareComponent`. The script gathers the team's declared bundled dependencies, including Chart.js for Sales, and packages the result with `npm pack`.

The terminal prints the producer version, archive path, and SHA-256. Use the same archive as input to both full builds. For Sales, that file is `artifacts/partial/demo-sales-chart-1.0.0.tgz`. [Script](build-partial.mjs) · [Next step](../build-stack/README.md)

# Configure a library remote

The full-build script copies this configuration beside the extracted library and supplies `delivery.json` with the deployed name and target stack. Native Federation runs the configuration while bundling the linked JavaScript.

- `name` identifies the team release and Angular version, for example `sales-chart-v1.0.0-a22.2.0`.
- `exposes` publishes `linked.mjs` as `./Component`, the key used by the host's second click.
- `externals` keeps the agreed platform imports available for the host to supply. The sales team's private Chart.js dependency is bundled with the component.

The adapter emits the versioned deployment's `remoteEntry.json` and its referenced JavaScript. [Configuration](remote.federation.config.mjs) · [Full build](../build-stack/README.md)

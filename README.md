# Angular Native Federation lab

Team A owns **Activity**. Team B owns **Sales chart**. Each team delivers one partially compiled Angular library. The platform turns each delivery into a browser-ready remote for each supported shared stack. The demo host lets you watch discovery and feature loading as separate network requests.

## TL;DR

Use Node 24.15 or newer in the 24.x series, npm, and tar. From the repository root, run:

```sh
npm start
```

This installs missing toolchains from their lockfiles, builds the demo, starts three local servers, and opens the **Remote explorer** in your default browser. The host runs on port 4720, Team A on 4721, and Team B on 4722. If you already have the build outputs, `npm run serve` serves them directly. [Open the host](http://localhost:4720) · [Host setup](tools/host/README.md)

1. Click **Discover remotes**. Compare the host’s versions with both teams’ requirements. The **Federation requests** table shows the JSON fetched from each origin.
2. Click **Open activity**. Team A’s first feature JavaScript request appears. Record an interaction to see the remote and host update the same session.
3. Click **Open sales chart**. Team B’s JavaScript arrives with Chart.js bundled. The size comparison shows how much smaller each remote is when the host supplies shared dependencies.

## One partial build per team, one full build per shared stack

The **partial build** is the team handoff. Angular 21.2.0 compiles the component into partial Ivy declarations such as `ɵɵngDeclareComponent`. The team packs that JavaScript and its private bundled dependencies into a tarball. Both platform builds take the **same tarball** as input. [Partial build guide](tools/build-partial/README.md)

```text
Team B delivers artifacts/partial/demo-sales-chart-1.0.0.tgz
  ├─ Angular 21.2.0 linker → artifacts/full/sales-chart-v1.0.0-a21.2.0.tgz
  └─ Angular 22.2.0 linker → artifacts/full/sales-chart-v1.0.0-a22.2.0.tgz
```

The **full build** runs the target stack’s Angular linker on the extracted library, producing executable definitions such as `ɵɵdefineComponent`. Native Federation then bundles the feature, exposes `./Component`, and emits `remoteEntry.json`. Angular, CDK, RxJS, and the workshop session stay external so they resolve to the host’s exact versions. Chart.js stays inside Team B’s feature. The Angular 22 host serves the 22 builds. The 21 builds let you compare what a different linker produces from identical input bytes. [Full build and archive inspection](tools/build-stack/README.md) · [Stack versions](tools/stacks/README.md) · [Remote configuration](tools/remote-config/README.md)

To see the handoff in the terminal, run these in order and compare the input SHA-256 printed by both stack builds:

```sh
npm run build:lib:partial
npm run build:stack:a21
npm run build:stack:a22
npm run build:host
npm run serve
```

## What loads when

| Trigger | Requests | Result |
| --- | --- | --- |
| Open the host | The host’s own federation entry and startup assets | The explorer is ready. Discovery waits for your click. |
| **Discover remotes** | Host `remote-config.json` → each team’s stable `remote.json` → each compatible build’s versioned `remoteEntry.json` | The host checks the exact shared versions and registers the exposed modules. Only JSON comes from the teams. |
| **Open activity** or **Open sales chart** | The selected team’s exposed JavaScript | The component mounts with the host injector. Reopening it in the same page reuses the loaded module. |

The request table groups browser timings by **Host**, **Team A**, and **Team B**. Its byte counts measure encoded response bodies. The build-size cards use minified, uncompressed JavaScript and compare the shipped feature with a build that includes its own dependencies. [Host and shared-service walkthrough](tools/host/README.md)

With the workshop servers stopped, `npm test` verifies source-free rebuilding from the archives and checks the loading sequence in Chromium. [Verification guide](tools/verify/README.md) · [Tool index](tools/README.md)

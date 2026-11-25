# Select a compiler and runtime stack

The build scripts import this module to resolve the Angular compiler, Babel linker plugin, and shared versions for a target. The stack commands select it through their final argument.

| Stack | Dependency installation | Role |
| --- | --- | --- |
| `a21` | Workspace root | Produces the partial libraries and the Angular 21.2.0 comparison build |
| `a22` | `stacks/a22/` | Links both running remotes and builds the Angular 22.2.0 SPA |

The [shared runtime list](shared-runtime.json) pins each package at its root. The host publishes the CDK's browser JavaScript entry points under one package version. Remote builds leave CDK imports external so each feature can load the entry points it uses.

The module checks installed packages against the declared pins and checks that the linker version matches Angular Core. Missing toolchains are installed with the respective npm lockfile. The build records the resolved versions in the remote's metadata so the host can check compatibility at discovery.

[Module](stacks.mjs) · [Angular 22 stack manifest](../../stacks/a22/package.json)

## Choose the common builder image

For the running stack, install and lock the runtime dependencies below in the image used by both teams and the host. The host publishes the supported browser entry points; the remote packager marks the same imports external. A common installation supplies reproducible versions. The federation mapping supplies module identity in the browser, and the host injector supplies shared service instances.

| Runtime dependency | Pin in the Angular 22 image | Shared use |
| --- | --- | --- |
| Angular Core, Common, Router, Platform Browser and Forms | 22.2.0 each | Framework, routing, classic reactive and template-driven forms. Common includes `@angular/common/http`; Core includes `@angular/core/rxjs-interop`. |
| Angular CDK | 22.2.0 | The host shares the package and its browser runtime entry points, including drag-and-drop, dialogs, scrolling, and overlays. Remotes import each feature from its CDK entry point. An overlay also needs the relevant structural styles in the application theme. |
| RxJS | 7.8.2 | Observables, subjects and operators, including `rxjs/operators`. |
| Shared application contracts | 1.0.0 for this demo | The session service token. In a product, common auth, tenant, and design-system tokens are candidates when multiple teams must inject the same object. |

Keep the Angular CLI, build package, compiler and compiler-cli aligned with the framework release. Pin TypeScript, ng-packagr (where partial packages are produced), Babel, and the Native Federation adapters in the corresponding build lockfile. These are build tools. The image also pins tslib 2.8.1 for emitted helpers. The older demonstration toolchain pins Forms and CDK at 21.2.0 alongside Angular 21.2.0.

For a fleet built on Angular Material, add the Material component entry points that are common to those teams, pin Material alongside CDK, and let the host own the theme. Add NgRx Store when the host owns a store that remotes intentionally participate in. For a library used by one feature, such as Chart.js here, the feature can own its version and pay the download cost when opened. Compare the emitted byte reports and the browser network trace before promoting another library to the shared runtime.

The [shared entry list](shared-runtime.json) drives both the remote requirements and the resolved versions supplied to the host's federation build. The [Angular 22 image manifest](../../stacks/a22/package.json) contains the exact package pins.

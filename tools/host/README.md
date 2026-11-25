# Build and serve the host

```sh
pnpm run build:host
pnpm run serve
```

The build stages the host project in the Angular 22.2.0 dependency tree and runs the Angular Architects Native Federation CLI builder. It writes the SPA, host federation entry, shared modules, and separately fetched `remote-config.json` to `dist/stacks/a22/host/`.

Serving requires the matching `build:stack:a22` outputs. Open the host on port 4720. **Discover remotes** registers the definitions served by Team A on port 4721 and Team B on port 4722. **Open activity** and **Open sales chart** load the selected implementation. For the complete build and launch flow, run `npm start`. Once all three servers are listening, it opens the host in your default browser.

[Script](host.mjs) · [Host federation configuration](../../projects/host/federation.config.mjs)

## Demonstrate one HttpClient and interceptor

Click **Send request from host**, discover and open Activity, then click **Send request from Activity**. Both buttons make a real GET to the host's static JSON endpoint. The caller query parameter identifies the button in DevTools. The **Host HTTP interceptor** panel and the browser console each show two responses:

```text
GET /http-demo.json?caller=host → 200
GET /http-demo.json?caller=activity → 200
```

The host provides Angular's HTTP client and registers the interceptor once. Activity injects the public `HttpClient` token from the shared `@angular/common/http` entry point. On mount, the host checks `ref.instance.http === this.http`; the **Same HttpClient instance as host** indicator is the result of that identity check. The log shows what that shared instance does. [Interceptor](../../projects/host/src/http-log.ts) · [Angular HTTP setup](https://angular.dev/guide/http/setup)

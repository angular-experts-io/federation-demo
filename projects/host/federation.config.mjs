import { share, withNativeFederation } from '@angular-architects/native-federation/config';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const versions = require('./shared-versions.json');

export default withNativeFederation({
  name: 'host',
  shared: share(Object.fromEntries(Object.entries(versions).map(([name, version]) => [name, {
    singleton: true,
    strictVersion: true,
    requiredVersion: version,
    includeSecondaries: name !== '@angular/forms',
    build: 'package',
  }]))),
  skip: ['@angular/cdk/schematics', /^@angular\/cdk\/testing(?:\/|$)/, 'rxjs/ajax', 'rxjs/fetch', 'rxjs/testing', 'rxjs/webSocket'],
  features: { ignoreUnusedDeps: false, denseChunking: true, denseExternals: true },
});

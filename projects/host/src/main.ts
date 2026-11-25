import { initFederation } from '@angular-architects/native-federation';

initFederation({}, { hostRemoteEntry: { url: './remoteEntry.json' } })
  .then(async federation => (await import('./bootstrap')).bootstrap(federation))
  .catch(console.error);

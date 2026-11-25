import { withNativeFederation } from '@softarc/native-federation/config';
import { readFileSync } from 'node:fs';

const delivery = JSON.parse(readFileSync(new URL('./delivery.json', import.meta.url), 'utf8'));

export default withNativeFederation({
  name: delivery.name,
  exposes: { './Component': './linked.mjs' },
  shared: {},
  externals: Object.keys(delivery.required),
});

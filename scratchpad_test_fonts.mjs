import { buildCustomFontRegistry } from './src/lib/fonts.js';

const registry = await buildCustomFontRegistry();

console.log('--- Registry ---');
for (const [family, data] of registry) {
  console.log(family, JSON.stringify(data.files, null, 2), 'weights:', [...data.weights]);
}
console.log('--- Registry size ---', registry.size);

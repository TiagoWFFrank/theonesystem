import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { plugin } from './plugin.js';

const output = fileURLToPath(new URL('../horizon-plugin.json', import.meta.url));
writeFileSync(output, `${JSON.stringify(plugin, null, 2)}\n`, 'utf8');
mkdirSync(fileURLToPath(new URL('../ui/', import.meta.url)), { recursive: true });
copyFileSync(fileURLToPath(new URL('./demo-ui.js', import.meta.url)), fileURLToPath(new URL('../ui/demo.mjs', import.meta.url)));
process.stdout.write(`Wrote ${output}\n`);

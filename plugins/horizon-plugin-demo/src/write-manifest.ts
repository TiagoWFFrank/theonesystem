import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { plugin } from './plugin.js';

const output = fileURLToPath(new URL('../horizon-plugin.json', import.meta.url));
writeFileSync(output, `${JSON.stringify(plugin, null, 2)}\n`, 'utf8');
process.stdout.write(`Wrote ${output}\n`);

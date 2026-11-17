import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';

// `npm run build:preview` gera um único index.html (usado na prévia publicada).
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'singlefile' ? [viteSingleFile()] : [])],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: mode === 'singlefile' ? { outDir: 'dist-preview' } : {},
}));

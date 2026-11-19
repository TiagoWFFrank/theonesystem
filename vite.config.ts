import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';

// `npm run build:preview` gera um único index.html (usado na prévia publicada).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = process.env.HORIZON_API_TARGET || env.HORIZON_API_TARGET || 'http://127.0.0.1:4174';
  return {
    plugins: [react(), ...(mode === 'singlefile' ? [viteSingleFile()] : [])],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    server: { proxy: { '/api': apiTarget } },
    preview: { proxy: { '/api': apiTarget } },
    build: mode === 'singlefile' ? { outDir: 'dist-preview' } : {},
  };
});

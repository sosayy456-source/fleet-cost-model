import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// อ่านซอร์สแอปจริง โดยไม่โหลดปลั๊กอิน ETL และเก็บแคชภายใน presentation เท่านั้น
export default defineConfig({
  root: fileURLToPath(new URL('../../app/', import.meta.url)),
  base: '/fleet-cost-model/', plugins: [react()],
  cacheDir: fileURLToPath(new URL('../qa/app-cache', import.meta.url)),
  define: { 'import.meta.env.VITE_DATASET': JSON.stringify('sample') },
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
});

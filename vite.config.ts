import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// The prototype builds to a plain static bundle so a Power Pages developer can
// lift `dist/` into a Web Template, or point a PCF control's build at `src/`.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});

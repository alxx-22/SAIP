import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Build config targets Power Pages, not a generic static host.
 *
 * Power Pages serves the app from two `adx_webfile` records whose `adx_partialurl`
 * values are fixed (`saip-app.js`, `saip-app.css`). Those records are real
 * Dataverse rows with real GUIDs — see powerpages/web-files/*.webfile.yml. If the
 * emitted filenames changed on every build, every build would need NEW web file
 * records created by hand. So the output names are pinned and content hashing is
 * off. That is the whole reason this config looks unusual.
 *
 * See README → "Deploying to Power Pages".
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Web files are served from the site root, so absolute. NOT './' — the bundle
  // is loaded by a web template at an arbitrary page path, and a relative base
  // would resolve against that page rather than the site root.
  base: '/',
  build: {
    outDir: 'dist',
    // Off deliberately. Sourcemaps add a ~3.1 MB .map that would need a third web
    // file record, and Power Pages web files are Dataverse attachments subject to
    // the environment's blocked-extension and size limits. Build locally with
    // `npm run build:debug` when you actually need to read a stack trace.
    sourcemap: false,
    // One CSS file rather than per-chunk CSS — again, one web file record.
    cssCodeSplit: false,
    // The bundle is ~790 KB, dominated by Grommet. That is a deliberate accepted
    // cost while this is a single-page internal portal; the warning is noise.
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Force a single JS artifact. Code splitting would emit hashed chunk
        // files that have no corresponding web file records.
        manualChunks: undefined,
        inlineDynamicImports: true,
        entryFileNames: 'saip-app.js',
        chunkFileNames: 'saip-app.js',
        assetFileNames: 'saip-app.[ext]',
      },
    },
  },
});

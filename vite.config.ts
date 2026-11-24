import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

/**
 * Inlines the compiled Tailwind CSS (~19 KiB gzipped) directly into index.html
 * at build time, eliminating the external render-blocking stylesheet request (290ms+)
 * without FOUC or layout shifts.
 */
function inlineBuiltCssPlugin(): Plugin {
  return {
    name: 'vantrel-inline-built-css',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const htmlAsset = bundle['index.html'];
      if (!htmlAsset || htmlAsset.type !== 'asset') return;

      let html =
        typeof htmlAsset.source === 'string'
          ? htmlAsset.source
          : Buffer.from(htmlAsset.source).toString('utf8');

      const cssKeys = Object.keys(bundle).filter((fileName) => fileName.endsWith('.css'));
      for (const cssFileName of cssKeys) {
        const cssChunk = bundle[cssFileName];
        if (!cssChunk || cssChunk.type !== 'asset') continue;

        const cssText =
          typeof cssChunk.source === 'string'
            ? cssChunk.source
            : Buffer.from(cssChunk.source).toString('utf8');

        const escapedName = cssFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const linkRegex = new RegExp(
          `<link[^>]*rel=["']stylesheet["'][^>]*href=["']/?${escapedName}["'][^>]*/?>`,
          'i'
        );

        if (linkRegex.test(html)) {
          html = html.replace(linkRegex, `<style>${cssText}</style>`);
          delete bundle[cssFileName];
        }
      }

      htmlAsset.source = html;
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), inlineBuiltCssPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      target: 'es2022',
      minify: 'esbuild',
      cssMinify: true,
      sourcemap: false,
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('react-dom') || id.includes('react/') || id.includes('scheduler')) {
                return 'vendor-react';
              }
              if (id.includes('firebase')) {
                return 'vendor-firebase';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
            }
          },
        },
      },
    },
  };
});

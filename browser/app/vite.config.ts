import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import UnoCSS from 'unocss/vite';
import { execSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

// The app is built into the player site next to the runtime (worker.js,
// library.js, vita_session.js, wasm64/, …), which it loads at run time from
// its own directory (src/runtime.ts): base './' keeps every URL relative, so
// the site works under any path (GitHub Pages serves it under /<repo>/).
//
// `bun run dev` serves the runtime too, with the cross-origin isolation
// headers the threaded runtime needs:
//   - by default as a static host (games and firmware come from what you
//     import, like on GitHub Pages): browser/web's files from the source, so
//     edits show at once, and the compiled ones (wasm64/, shaders/,
//     decrypt/) from the browser build's dist (VITA3K_DIST, default
//     ../../build/web64/dist);
//   - with VITA3K_RUNTIME=<url> (e.g. http://localhost:8080), proxied from a
//     dev server (browser/tests/limbo_serve.mjs) and the games it stages.
const runtimeServer = process.env.VITA3K_RUNTIME;
const dist = resolve(import.meta.dirname, process.env.VITA3K_DIST || '../../build/web64/dist');
const web = resolve(import.meta.dirname, '../web');
const runtimePaths = ['/worker.js', '/thread_bridge.js', '/library.js', '/vita_session.js', '/pad_input.js', '/capabilities.js',
  '/content_cache.js', '/zip.js', '/decrypt_worker.js', '/workerfs_read_cache.js', '/save_sync.js', '/gxm_scene.js', '/gpu_queue.js', '/gxp_shader_adapter.js',
  '/gles_webgl.js', '/audio_input.js', '/audio_ring_worklet.js', '/storage.js', '/player-config.json', '/manifest.json',
  '/coi.js', '/coi_sw.js', '/wasm64', '/wasm32', '/shaders', '/decrypt', '/stage', '/aot', '/aot.wasm', '/aot-mt'];
const isRuntime = (path: string) => runtimePaths.some((prefix) => path === prefix || path.startsWith(prefix + '/'));
const isolation = { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' };
const types: Record<string, string> = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.wasm': 'application/wasm', '.html': 'text/html' };

// The runtime from the dist, as a static host serves it (browser/pages/assemble.sh).
function staticRuntime(): Plugin {
  return {
    name: 'vita3k-static-runtime',
    configureServer(server) {
      if (!existsSync(join(dist, 'worker.js')))
        server.config.logger.warn(`No browser build in ${dist}: build vita3k_web_dist, set VITA3K_DIST, or set VITA3K_RUNTIME to a dev server.`);
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
        if (!isRuntime(path)) return next();
        const send = (status: number, type: string, body: string) => {
          res.writeHead(status, { ...isolation, 'Content-Type': type, 'Cache-Control': 'no-store' });
          res.end(body);
        };
        if (path === '/player-config.json') return send(200, 'application/json', '{"static": true, "titles": []}');
        if (path === '/manifest.json') return send(200, 'application/json', '[]');
        const source = join(web, path), built = join(dist, path);
        const file = source.startsWith(web) && existsSync(source) && statSync(source).isFile() ? source : built;
        if (!file.startsWith(dist) && file !== source || !existsSync(file) || !statSync(file).isFile())
          return send(404, 'text/plain', `not in the browser build (${dist}): ${path}`);
        res.writeHead(200, { ...isolation, 'Content-Type': types[extname(file)] ?? 'application/octet-stream',
          'Content-Length': statSync(file).size, 'Cache-Control': 'no-store' });
        createReadStream(file).pipe(res);
      });
    },
  };
}

const commit = (() => {
  try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; }
})();

export default defineConfig({
  base: './',
  plugins: [vue(), UnoCSS(), ...(runtimeServer ? [] : [staticRuntime()])],
  define: {
    __APP_COMMIT__: JSON.stringify(commit),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
  server: {
    headers: isolation,
    proxy: runtimeServer
      ? Object.fromEntries(runtimePaths.map((path) => [path, { target: runtimeServer, changeOrigin: true }]))
      : undefined,
  },
});

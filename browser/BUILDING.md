# Building the web port

This builds the browser version: the two WebAssembly runtimes, the Vue app
and the static site that GitHub Pages serves. For the desktop version of
Vita3K, see [`building.md`](../building.md).

## Requirements

- [Nix](https://nixos.org/download) with flakes enabled. The project's dev
  shell (`flake.nix`) pins the whole toolchain: Emscripten, Node 24, CMake,
  Ninja and Bun. Nothing else needs to be installed.
- A clone **with submodules**: Dynarmic, FFmpeg and the other dependencies
  are git submodules, and the build fails without them.

```sh
git clone --recursive https://github.com/notwindstone/vita3k-web
cd vita3k-web
```

(In an existing clone without submodules: `git submodule update --init --recursive`.)

## Build the site

```sh
nix develop --command browser/pages/build.sh
```

The site ends up in `build/pages`. [`browser/pages/build.sh`](pages/build.sh)
is exactly what the GitHub Pages workflow
([`.github/workflows/pages.yml`](../.github/workflows/pages.yml)) runs. It:

1. builds the single-threaded runtime (`build/pages-build/web64`);
2. builds the multi-threaded runtime (`build/pages-build/web64-mt`), which
   is placed next to the first one;
3. builds the app (`browser/app`, Vue + Vite, with Bun);
4. assembles the static site with [`browser/pages/assemble.sh`](pages/assemble.sh).

Both runtimes use Memory64. The first build is slow: besides the emulator,
it compiles FFmpeg and Emscripten's Memory64 and pthread system libraries.
The dev shell keeps Emscripten's cache in `.cache/emscripten`, so later
builds skip that part.

`build.sh` takes two optional arguments: the build directory (default
`build/pages-build`) and the site directory (default `build/pages`).
`VITA3K_BUILD_JOBS` sets the number of parallel jobs (default: all cores).

## Run it locally

Serve `build/pages` with any static file server, for example:

```sh
python3 -m http.server -d build/pages 8000
```

Then open <http://localhost:8000> in Chrome or Firefox. The browser needs
WebGPU and WebAssembly Memory64.

The multi-threaded runtime needs a cross-origin isolated page, which a
plain static server doesn't provide. `coi.js` handles that: on the first
visit it registers a service worker (`coi_sw.js`) that adds the required
headers, then reloads the page once. This needs a secure context, which
`localhost` is.

The site layout:

| Path | Contents |
|---|---|
| `index.html`, `assets/` | the app |
| `player.html` | the older single-page player |
| `wasm64/` | the runtimes: `vita3k_web_jit` (single-threaded) and `vita3k_web_jit_mt` (multi-threaded) |
| `shaders/` | the GXP → SPIR-V compiler and Naga (SPIR-V → WGSL) |
| `decrypt/` | the decryption module for encrypted dumps, `.pkg` files and firmware |
| `worker.js`, `vita_session.js`, … | the JavaScript side of the runtime (`browser/web`) |
| `coi.js`, `coi_sw.js` | cross-origin isolation for static hosts |
| `player-config.json` | `{"static": true}`: games and firmware come from what you import |

## Development

Build the runtimes into `build/` instead, where the app's dev server looks
for them, then start the dev server:

```sh
nix develop --command browser/pages/build.sh build
nix develop
cd browser/app
bun install
bun run dev            # http://localhost:5173
```

The dev server sends the cross-origin isolation headers itself. It serves
the runtime's JavaScript (`browser/web`) straight from the source, so
edits there show up on reload; the compiled files (`wasm64/`, `shaders/`,
`decrypt/`) come from `build/web64/dist`. `VITA3K_DIST=<dir>` points it at
another build.

After changing C++ code, rebuild the runtime you need from the dev shell:

```sh
cmake --build build/web64 --target vita3k_web_dist      # single-threaded
cmake --build build/web64-mt --target vita3k_web_dist   # multi-threaded
```

Both write into `build/web64/dist`. To refresh a full site afterwards, run
`bun run build` in `browser/app`, then
`browser/pages/assemble.sh build/web64/dist build/pages browser/app/dist`.

## Tests

[`browser/tests/app_chromium.mjs`](tests/app_chromium.mjs) drives the
assembled site in headless Chromium: it imports firmware and a game through
the app, exercises the Files, Settings and About pages, and plays the game
until it presents frames. It needs Playwright
(`npm install --prefix build/playwright playwright`) and takes the site,
firmware and game from environment variables; its header comment lists
them all.

Test, benchmark and profiling commands for the JIT and the runtime are in
[`SCRIPTS.md`](../SCRIPTS.md).

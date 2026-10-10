# Vita3K web port

## Gallery

|               **Persona 4 Golden** by Atlus                   |                     **A Rose in the Twilight** by Nippon Ichi Software                         |
| :-----------------------------------------------------------: | :--------------------------------------------------------------------------------------------: |
| ![Persona 4 Golden screenshot](./_readme/screenshots/P4G.png) | ![A Rose in the Twilight screenshot](./_readme/screenshots/A%20Rose%20in%20the%20Twilight.png) |

|                  **Alone with You** by Benjamin Rivers                     |                 **VA-11 HALL-A** by Sukeban Games                    |
| :------------------------------------------------------------------------: | :------------------------------------------------------------------: |
| ![Alone with You screenshot](./_readme/screenshots/Alone%20With%20You.png) | ![VA-11 HALL-A screenshot](./_readme/screenshots/VA-11%20HALL-A.png) |

|              **Fruit Ninja** by Halfbrick Studios                  |                **Jetpack Joyride** by Halfbrick Studios                    |
| :----------------------------------------------------------------: | :------------------------------------------------------------------------: |
| ![Fruit Ninja Screenshot](./_readme/screenshots/Fruit%20Ninja.png) | ![Jetpack Joyride Screenshot](./_readme/screenshots/Jetpack%20Joyride.png) |

## What is this?

This is a web port of Vita3K, a PlayStation Vita emulator written in C++, compiled to WebAssembly (Wasm) with Emscripten. The project is statically hosted on GitHub Pages, where you can import the PlayStation Vita firmware/your own games and play directly in modern browsers (Chrome and Firefox for now since Safari does not support Memory64).

\screenshots{don't forget to add the website screenshots}

## Why?

I had two reasons:

- Persona 4 Golden in browser :D
- After seeing how far AI models have advanced, I wanted to see if an average university student who doesn't have much time but has a $20 subscription to Claude/ChatGPT and a bunch of free AI models could lead the AI models to make something extremely complex in a short amount of time that would usually take years of work. Turns out, with Claude Opus 5.5 and GPT-6 Astra, this is indeed possible.

## How does this work?

### Introduction

Since this is a web port of Vita3K, this project is built with a restricted set of tools available in browsers and is based on JavaScript (JS) and Wasm. The PlayStation Vita system libraries use both the low-level emulation (LLE) and high-level emulation (HLE) methods. HLE is used for emulating most system libraries while LLE is used for some exceptions, like `sysmodule.skprx`, `libscemp4`, or `libc.suprx`. The ARM/Thumb instruction set architecture (ISA) for the games uses a two-step translation layer (ARM/Thumb -> Dynarmic IR -> Wasm).

### ARM/Thumb to Wasm

The game modules are scanned ahead-of-time (AOT) for functions that can be recompiled into Wasm. The AOT scanning searches for functions to translate in entry points, exports, exception tables, relocations, switch tables, etc. Once the scan is over, the found functions are fed into Dynarmic that produces an intermediate representation (IR). The AOT compiler then translates that Dynarmic IR into a large Wasm module using the Wasm emitter. That Wasm module is then executed.

Now, the Wasm emitter can't translate everything - some operations simply don't have browser equivalents (either intentionally or unintentionally). What happens to them? They are simply excluded from the recompiled AOT module! If the game ever needs that block at runtime, a just-in-time (JIT) compiler will try to translate that block, and the emulation will stop with an explicit emitter rejection. Otherwise, the game continues to work.

Okay, but what is a JIT compiler? It's a compiler that compiles Wasm modules containing the game code at runtime in contrast to an AOT compiler that compiles a Wasm module of the game code before launching the game. The JIT compiler is used when the game loads a new module, reaches for a function pointer that the AOT module lacks, or self-modifies the code. The JIT compiler translates the Dynarmic IR into a small Wasm module using the same Wasm emitter as the AOT compiler. Those Wasm modules cover at least one ARM block and are created by crossing the JS boundary, but once the modules are created, they communicate to each other staying inside Wasm (i.e., JIT compiled Wasm module <-> JIT compiled Wasm module).

If you want to get deeper into technical details, expand the following block.

<details>

1. <code>transfer(state, remaining, pc) -> ExitReason</code>

This is a helper function inside the AOT module that is used to find a Wasm block and a Wasm function in the fixed-size, AOT filled array of Wasm block and Wasm function numeric names (e.g., block 6 of a function 9), with program counters (PC) as keys, which are basically the next instruction addresses. If no such function is found, <code>transfer</code> returns <code>Miss</code> as the <code>ExitReason</code>, which means that the required function does not live in the AOT module. Now, someone has to decide what to execute next in such case...

2. <code>dispatch(state, remaining, map_base, epoch_addr) -> ExitReason</code>

This is another helper function, but it is located in a separate small Wasm module and is used to find a JIT compiled Wasm module in a gradually filled (on every new JIT compiled Wasm modules) hash map of 2048 entries. The hash map keys represent translation state (Thumb or ARM, Floating-Point Status and Control Register (FPSCR) mode, etc.) + PC, e.g., <code>0000000181000100</code> for PC <code>0x81000100</code> and Thumb (1). Now, the hash map points to the <code>run</code> function of a Wasm module in contrast to <code>transfer</code>'s table that pointed to both the Wasm block and the Wasm function. That Wasm function is then called indirectly, making a Wasm module boundary crossing. If the hash map does not have an entry for such key, <code>Miss</code> is returned by the dispatcher, which leads to another Wasm module boundary crossing - now we are in the emulator's module written in C++ and compiled into Wasm by Emscripten. The JIT compiler is called, the JS boundary crossing is happening for a Wasm module  compilation, <code>region_cache</code> is then filled with the newly created Wasm module.

Now, the emulator's module: <code>region_cache</code> is a private ordered tree (<code>std::map</code>) with the limit of 1024 cached JIT compiled Wasm modules. The dispatcher's hash map is a derived copy of that record. If you properly understood the previous paragraph, then you should have a question by now: <code>region_cache</code> inside the emulator's module stores up to 1024 modules, but the dispatcher's hash map that is derived from <code>region_cache</code> can store up to 2048 modules. What is going on here? The answer that several AI models gave me here is that "hash maps stay fast only when roughly half empty, so the map is built twice as big as the cache on purpose". In a third volume of the book "Art of Computer Programming" by D. E. Knuth, it is demonstrated that the average number of accesses in a successful search by linear probing with a load factor of 0.5 is <strong>1.5</strong>, with a load factor of 0 is <strong>1</strong>, and with a load factor of 0.8 is <strong>3</strong>, making the hash map size of 2048 entries, apparently, a sweet spot.

</details>

### Rendering

PlayStation Vita has its own low-level graphics API named GXM that handles rendering and shaders. Shaders have their own format named GXP. To make it possible for emulated game frames to be rendered on a browser canvas element, the GXM calls and GXP shaders are translated to WebGPU calls and WebGPU Shader Language (WGSL), respectively, at runtime. To avoid lots of expensive JS boundary crossings, the GXM calls are batched per scene (between the `sceGxmBeginScene` and `sceGxmEndScene` calls), and one frame can have more than one scene. GXP shaders are translated to Standard Portable Intermediate Representation (SPIR-V), and SPIR-V is translated to WGSL with Naga. GXP shader conversions are cached.

PlayStation Vita display has a resolution of 960x544 pixels, so the web port renders games in this resolution as well with an option to enable 2x scaling.

### Memory

The PlayStation Vita has a 4 GiB address space (2^32 of unique addresses), but the web port uses a 8 GiB reserved address space. The Emscripten static data, stacks, heap, and other emulator data start from `0x0` to `0x100000000` (excluding), and the emulated game memory starts from `0x100000000` to `0x200000000` (excluding). The emulated memory accesses are translated to the Memory64 linear memory accesses using a simple offset, e.g., `0x100000000 + EmulatedGameAddress`.

### Threads

The web port supports both the single-threaded and multi-threaded emulation of games. The single-threaded version handles emulated game threads (created by calling `sceKernelCreateThread`) in a single web worker by using Asyncify fibers without true parallelism. The performance of the single-threaded version is, of course, worse than the multi-threaded version, and the audio often feels laggy. The multi-threaded design follows the "one emulated game thread per one web worker" idea, uses `Atomics.wait()` for thread blocking, and has true parallelism, unless the amount of workers exceeds the amount of CPU threads (in which case, concurrency is a more suited term). Since creating web workers is expensive time-wise (10-20 milliseconds), the web port initializes a pool of 24 workers before launching the game, then creates 4 new ones when the amount of free workers gets less than 4. The threads implementation has the following structure.

```
Main JS thread (User Interface (UI) and AudioWorklet for playing audio signals from audio ring buffer (stored in the emulator memory))
  | <---> Main web worker (the owner of the rendering pipeline, input, and files)
    | <---> Web worker for the game thread 1 (executes the game instructions and redirects the graphics and dialogs work to the main web worker)
    | <---> Web worker for the game thread 2 (same)
    ...
```

In a single-threaded version, the main web worker has no sub-workers, so it runs everything itself. `AudioWorklet` is also absent in this version.

Some statistics: Persona 4 Golden and Limbo had spawned 17 and 11 threads, respectively, in my short playthrough.

### Media, UI, and storage

The desktop version of Vita3K is using a Simple DirectMedia Layer (SDL) to handle windows, input, audio, threads, and timers. SDL is a cross-platform library written in C, but it expects the page's main thread (DOM, AudioContext, etc.) while the emulator runs entirely inside web workers, so SDL is mostly unused for this web port. Instead, the existing browser API is used for handling windows, input, audio, threads, and timers. For example, SDL window creation is replaced by a `<canvas />` element (which is handed to the web worker as an `OffscreenCanvas`).

As for the emulator UI, a Vue 3 framework was used. The in-game system dialogs also use Vue 3 components: whenever `sceMsgDialogInit` (or another system library function) is executed, the emulated game code in Wasm exits into the host code in another Wasm module (`msg_dialog_bridge.cpp` in this case), where the host exits into JS (a bit more expensive boundary crossing in contrast to Wasm module <-> Wasm module), where a Vue 3 component is then rendered, and the user's dialog button click is then stored in the emulator memory, which is then read when the game calls `sceMsgDialogGetStatus`. Touch/overlay inputs, audio, and threads also cross the JS boundary.

The storage is implemented via Origin Private File System (OPFS). The firmware, game, and saves are stored there. The web port allows you to see and edit files in the Files page.

## Compatibility

The web port of the emulator currently runs an unknown subset of homebrew programs and commercial games.

## Performance

The following table provides FPS measurements for P4G and Limbo in default configurations for the player (AOT compilation, multi-threading, Memory64, and a separate thread for rendering 3D scenes).

|                                                                                                     | Persona 4 Golden                                                            | Limbo                                                                                                 |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Honor NMH-WDX9, a laptop<br>- AMD Ryzen 5 5500U;<br>- AMD Radeon RX Vega 7;<br>- 16 GB of DDR4 RAM. | 960x544: 30 FPS (Chrome, Windows 10)<br>960x544: 20-30 FPS (Firefox, NixOS) | 960x544: 30 FPS (Firefox, NixOS)<br>An FPS hack works here and gives 48-55 FPS                        |
| PC<br>- Ryzen 3 3100;<br>- AMD Radeon RX 6600;<br>- 16 GB of DDR4 RAM.                              | Both 960x544 and 1920x1088:<br>30 FPS (Chrome, Windows 10)                  | Both 960x544 and 1920x1088:<br>30 FPS (Chrome, Windows 10)<br>An FPS hack works here and gives 60 FPS |

Phones have horrible performance as of now, with the most likely cause being a heavy difference on how WebGPU calls are implemented and executed under the hood in Android in contrast to desktop platforms.

## License

This web port is licensed under the **GPL-2.0-or-later** license, just like Vita3K.

## Building

Please see [`browser/BUILDING.md`](browser/BUILDING.md).

## Bugs and issues

The project is in an early stage, so please be mindful when opening new issues. Expect crashes, glitches, low compatibility, and poor performance.

## Credits

Thanks go out to all people who contributed to Vita3K.

The web-specific code did not have any human contributions and was fully written by AI models. The only things that were made by a human are `README.md` and a web port logo that was drawn in Krita.

## Donations

Simply support the original creators of Vita3K.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/vita3k)

## Note

The purpose of this emulator is not to enable illegal activity. You can dump games from a Vita by using [NoNpDrm](https://github.com/TheOfficialFloW/NoNpDrm) or [FAGDec](https://github.com/CelesteBlue-dev/PSVita-RE-tools/tree/master/FAGDec/build). You can get homebrew programs from [VitaDB](https://www.rinnegatamante.eu/vitadb/#/).

PlayStation, PlayStation Vita, and PlayStation Network are all registered trademarks of Sony Interactive Entertainment Inc. This emulator is not related to or endorsed by Sony, or derived from confidential materials belonging to Sony.

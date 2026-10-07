<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { PadInputModule, PadState } from '../runtime';

// The on-screen controller. pad_input.js's createTouchControls drives this
// markup (data-button / data-dpad / data-stick) with pointer capture and
// multitouch; this component only lays it out.
const props = defineProps<{ pad: PadState; padInput: PadInputModule; enabled: () => boolean; onGesture: () => void;
  opacity: number; size: number; portrait: boolean }>();
const root = ref<HTMLElement | null>(null);
let controls: { clear(): void } | null = null;
onMounted(() => {
  if (root.value) controls = props.padInput.createTouchControls(root.value, props.pad, { enabled: props.enabled, onGesture: props.onGesture });
});
onBeforeUnmount(() => controls?.clear());
defineExpose({ clear: () => controls?.clear() });
</script>

<template>
  <div
    ref="root"
    class="touch-controls"
    :class="{ portrait }"
    :style="{ '--control-opacity': opacity / 100, '--preferred-control-scale': size / 100 }"
    aria-label="Touch controller"
  >
    <button class="pad-button shoulder shoulder-left" data-button="l" aria-label="L shoulder">L</button>
    <button class="pad-button shoulder shoulder-right" data-button="r" aria-label="R shoulder">R</button>
    <div class="dpad" data-dpad aria-label="Directional pad">
      <button class="pad-button north" data-direction="up" aria-label="D-pad up"><span class="i-lucide-chevron-up" /></button>
      <button class="pad-button west" data-direction="left" aria-label="D-pad left"><span class="i-lucide-chevron-left" /></button>
      <button class="pad-button east" data-direction="right" aria-label="D-pad right"><span class="i-lucide-chevron-right" /></button>
      <button class="pad-button south" data-direction="down" aria-label="D-pad down"><span class="i-lucide-chevron-down" /></button>
    </div>
    <div class="face-buttons">
      <button class="pad-button north triangle" data-button="triangle" aria-label="Triangle"><span class="i-lucide-triangle" /></button>
      <button class="pad-button west square" data-button="square" aria-label="Square"><span class="i-lucide-square" /></button>
      <button class="pad-button east circle" data-button="circle" aria-label="Circle"><span class="i-lucide-circle" /></button>
      <button class="pad-button south cross" data-button="cross" aria-label="Cross"><span class="i-lucide-x" /></button>
    </div>
    <div class="stick stick-left" data-stick="0" role="group" aria-label="Left analog stick"><span class="stick-thumb">L</span></div>
    <div class="stick stick-right" data-stick="2" role="group" aria-label="Right analog stick"><span class="stick-thumb">R</span></div>
    <div class="system-buttons">
      <button class="pad-button" data-button="select" aria-label="Select">SELECT</button>
      <button class="pad-button" data-button="start" aria-label="Start">START</button>
    </div>
  </div>
</template>

<style scoped>
.touch-controls {
  --control-scale: var(--preferred-control-scale, 1);
  position: absolute; inset: 0; z-index: 2; pointer-events: none; opacity: var(--control-opacity);
  -webkit-user-select: none; user-select: none;
}
.touch-controls button, .stick, .dpad { pointer-events: auto; touch-action: none; -webkit-touch-callout: none; }
.pad-button {
  background: rgb(var(--color-surface-high) / 0.8); border: 0; color: rgb(var(--color-on-surface)); padding: 0; display: flex; align-items: center; justify-content: center;
  font-weight: 600; cursor: pointer;
}
.pad-button.pressed, .pad-button:active { background: rgb(var(--color-primary)); color: rgb(var(--color-on-primary)); }
.shoulder { position: absolute; top: 16px; width: calc(76px * var(--control-scale)); height: calc(38px * var(--control-scale)); border-radius: 999px; }
.shoulder-left { left: max(24px, env(safe-area-inset-left)); }
.shoulder-right { right: max(24px, env(safe-area-inset-right)); }
.dpad, .face-buttons { position: absolute; bottom: calc(114px * var(--control-scale)); width: calc(138px * var(--control-scale)); height: calc(138px * var(--control-scale)); }
.dpad { left: max(20px, env(safe-area-inset-left)); }
.face-buttons { right: max(20px, env(safe-area-inset-right)); }
.dpad .pad-button, .face-buttons .pad-button { position: absolute; width: 33.333%; height: 33.333%; font-size: calc(22px * var(--control-scale)); border-radius: 50%; }
.dpad .pad-button { border-radius: 12px; }
.north { top: 0; left: 33.333%; } .south { bottom: 0; left: 33.333%; } .west { top: 33.333%; left: 0; } .east { top: 33.333%; right: 0; }
.triangle { color: #90e3c3; } .square { color: #e4aae0; } .circle { color: #f6adab; } .cross { color: #a7cffb; }
.stick {
  position: absolute; bottom: 16px; width: calc(92px * var(--control-scale)); height: calc(92px * var(--control-scale));
  border-radius: 50%; background: rgb(var(--color-surface-container) / 0.6); display: grid; place-items: center;
}
.stick-left { left: max(42px, env(safe-area-inset-left)); } .stick-right { right: max(42px, env(safe-area-inset-right)); }
.stick-thumb {
  width: 52%; height: 52%; border-radius: 50%; display: grid; place-items: center; background: rgb(var(--color-surface-highest) / 0.867); color: rgb(var(--color-on-surface-variant));
  font-size: 12px; pointer-events: none;
}
.stick.active .stick-thumb { background: rgb(var(--color-primary)); color: rgb(var(--color-on-primary)); }
.system-buttons { position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%); display: flex; gap: 16px; }
.system-buttons button { height: 34px; width: 72px; font-size: 10px; letter-spacing: 1.2px; border-radius: 999px; }

/* Phones held upright: the game sits on top, the controls below it. */
.portrait .dpad, .portrait .face-buttons { bottom: calc(58px + 92px * var(--control-scale)); }
.portrait .stick { bottom: 48px; }
.portrait .system-buttons { bottom: 8px; gap: 8px; }
.portrait .shoulder { top: auto; bottom: calc(68px + 230px * var(--control-scale)); }
@media (max-width: 400px) { .touch-controls { --control-scale: min(var(--preferred-control-scale, 1), 0.95); } }
@media (orientation: landscape) and (max-height: 600px) {
  .dpad, .face-buttons { width: calc(114px * var(--control-scale)); height: calc(114px * var(--control-scale)); bottom: calc(94px * var(--control-scale)); }
  .stick { width: calc(76px * var(--control-scale)); height: calc(76px * var(--control-scale)); bottom: 10px; }
  .shoulder { top: 10px; height: 32px; }
}
@media (orientation: landscape) and (max-height: 400px) { .touch-controls { --control-scale: min(var(--preferred-control-scale, 1), 1); } }
</style>

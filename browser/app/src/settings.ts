import { useStorage } from '@vueuse/core';
import { computed } from 'vue';
import type { ColorScheme } from './palettes';

// Kept in this browser (localStorage). Session options map onto worker.js's
// switches (vita_session.js WORKER_OPTIONS).
export interface Settings {
  colorScheme: ColorScheme;
  touch: 'auto' | 'on' | 'off';
  touchOpacity: number;
  touchSize: number;
  showFps: boolean;
  threads: boolean;
  scale: 1 | 2;
  startMuted: boolean;
  fpsHack: boolean;
  buildAot: 'auto' | 'on' | 'off';
  asyncScene: boolean;
  hleIntrinsics: boolean;
  saveLogs: boolean;
  strictImports: boolean;
}

export const defaults: Settings = {
  colorScheme: 'blue',
  touch: 'auto',
  touchOpacity: 65,
  touchSize: 100,
  showFps: true,
  // Used when the page is cross-origin isolated (coi.js provides it): a
  // first visit runs once before coi.js reloads it isolated.
  threads: true,
  scale: 1,
  startMuted: false,
  fpsHack: false,
  buildAot: 'auto',
  asyncScene: true,
  hleIntrinsics: true,
  saveLogs: false,
  strictImports: false,
};

export const settings = useStorage<Settings>('vita3k.app.settings', { ...defaults }, localStorage, { mergeDefaults: true });

export function resetSettings() {
  settings.value = { ...defaults };
}

export const threadsAvailable = globalThis.crossOriginIsolated === true && typeof SharedArrayBuffer !== 'undefined';

// What a session gets (vita_session.js createSession settings).
export const sessionSettings = computed(() => {
  const s = settings.value;
  return {
    scale: s.scale,
    muted: s.startMuted,
    ...(s.threads && threadsAvailable ? { threads: '1', asyncScene: s.asyncScene ? undefined : '0' } : {}),
    ...(s.fpsHack ? { fpsHack: '1' } : {}),
    ...(s.hleIntrinsics ? {} : { hleIntrinsics: '0' }),
    ...(s.strictImports ? { strictImports: '1' } : {}),
    ...(s.buildAot === 'auto' ? {} : { buildAot: s.buildAot === 'on' ? '1' : '0' }),
  };
});

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue';
import { useEventListener, useFullscreen, useMediaQuery, useTimeoutFn } from '@vueuse/core';
import { loadLibrary, loadPadInput, loadSession, type GuestDialog as Dialog, type GuestIme, type PadInputModule,
  type Session, type Target } from '../runtime';
import { settings, sessionSettings } from '../settings';
import { refreshLibrary } from '../library';
import { href, navigate } from '../router';
import { openLogFile, type LogFile } from '../logfile';
import BaseDialog from '../components/BaseDialog.vue';
import ProgressBar from '../components/ProgressBar.vue';
import LogsDialog from '../player/LogsDialog.vue';
import TouchControls from '../player/TouchControls.vue';
import GuestDialog from '../player/GuestDialog.vue';
import GuestKeyboard from '../player/GuestKeyboard.vue';

// One game, started as the page opens and stopped when it closes.
const props = defineProps<{ title: string; source: string | null }>();

const root = ref<HTMLElement | null>(null);
const stage = ref<HTMLElement | null>(null);
const session = shallowRef<Session | null>(null);
const padInput = shallowRef<PadInputModule | null>(null);
const game = reactive({ name: props.title, icon: null as string | null });
const state = reactive({
  phase: 'loading' as 'loading' | 'running' | 'stopped' | 'error',
  launch: null as { phase: string; detail: string; fraction?: number } | null,
  status: '',
  error: '',
  fps: 0,
  frames: 0,
  muted: settings.value.startMuted,
  gamepad: false,
});
const dialog = ref<(Dialog & { selected: number; enter: number }) | null>(null);
const ime = ref<GuestIme | null>(null);
const notice = ref('');
const { start: hideNoticeLater } = useTimeoutFn(() => { notice.value = ''; }, 6000, { immediate: false });
const showNotice = (text: string) => { notice.value = text; if (text) hideNoticeLater(); };
// The log: the latest LOG_LINES lines, for the logs dialog; with Settings →
// Save logs to files, each run also goes to a file.
const LOG_LINES = 5000;
const logLines: string[] = [];
const logVersion = ref(0);
const logsOpen = ref(false);
let logFile: LogFile | null = null;
const logFileName = ref<string | null>(null);
function closeLogFile() { logFile?.close(); logFile = null; }
async function openRunLog() {
  closeLogFile();
  logFileName.value = null;
  if (!settings.value.saveLogs) return;
  try {
    logFile = await openLogFile(props.title, [
      `Vita3K Web ${__APP_COMMIT__} · ${game.name} (${props.title})${props.source ? ' from ' + props.source : ''}`,
      `Started ${new Date().toISOString()}`,
      `Browser: ${navigator.userAgent}`,
      `Settings: ${JSON.stringify(sessionSettings.value)}`,
    ]);
    logFileName.value = logFile?.name ?? null;
  } catch { /* no file this run: the dialog still has the log */ }
}
// Leaving or stopping a running game asks first.
const confirming = ref<'leave' | 'stop' | null>(null);
const live = computed(() => state.phase === 'running' || state.phase === 'loading');
// start() first stops the previous run: that stop is not the player's.
let starting = false;

// Fullscreen: the Fullscreen API where there is one, else the page fills the
// window (iOS Safari).
const { isFullscreen, isSupported: fullscreenSupported, enter, exit } = useFullscreen(root);
const expanded = ref(false);
const immersive = computed(() => isFullscreen.value || expanded.value);
async function toggleFullscreen() {
  if (immersive.value) { if (isFullscreen.value) await exit(); expanded.value = false; return; }
  if (fullscreenSupported.value) { try { await enter(); return; } catch { /* fall back */ } }
  expanded.value = true;
}

const coarse = useMediaQuery('(any-pointer: coarse)');
const portrait = useMediaQuery('(orientation: portrait) and (max-width: 700px)');
const touchVisible = computed(() => !dialog.value && !ime.value && state.phase !== 'error' &&
  (settings.value.touch === 'on' || (settings.value.touch === 'auto' && !state.gamepad && (coarse.value || navigator.maxTouchPoints > 0))));
const touch = ref<InstanceType<typeof TouchControls> | null>(null);
let gamepads: { connected(): boolean; clear(): void } | null = null;

function clearInputs() { touch.value?.clear(); gamepads?.clear(); session.value?.pad.clear(); releaseFingers(); }

// --- Front touchscreen ----------------------------------------------------------
// Pointers on the game picture (mouse, pen, fingers) are the Vita's front
// touchscreen; the touch controls keep their own. Up to six at once.
const fingers = new Map<number, number>(); // pointerId → finger slot
function picturePoint(event: PointerEvent, canvas: HTMLElement) {
  // The canvas letterboxes 960×544 (object-fit: contain), at the top when
  // held upright with touch controls.
  const r = canvas.getBoundingClientRect();
  const scale = Math.min(r.width / 960, r.height / 544);
  const width = 960 * scale, height = 544 * scale;
  const left = r.left + (r.width - width) / 2;
  const top = r.top + (stage.value?.classList.contains('touch-portrait') ? 0 : (r.height - height) / 2);
  return { x: (event.clientX - left) / width, y: (event.clientY - top) / height };
}
function onPointer(event: PointerEvent) {
  const s = session.value, canvas = event.target as HTMLElement | null;
  if (!s || !canvas?.matches?.('canvas.game-canvas')) return;
  const slot = fingers.get(event.pointerId);
  if (event.type === 'pointerdown') {
    if (!s.running || dialog.value || ime.value || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const { x, y } = picturePoint(event, canvas);
    if (x < 0 || y < 0 || x >= 1 || y >= 1 || fingers.size >= 6) return;
    let free = 0;
    while ([...fingers.values()].includes(free)) ++free;
    fingers.set(event.pointerId, free);
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    s.ensureAudio();
    s.touch(free, 0, x, y);
  } else if (slot === undefined) {
    return;
  } else if (event.type === 'pointermove') {
    const { x, y } = picturePoint(event, canvas);
    s.touch(slot, 1, x, y);
  } else {
    fingers.delete(event.pointerId);
    const { x, y } = picturePoint(event, canvas);
    s.touch(slot, 2, x, y);
  }
}
function releaseFingers() {
  for (const slot of fingers.values()) session.value?.touch(slot, 2, 0, 0);
  fingers.clear();
}
for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const)
  useEventListener(stage, type, onPointer);

async function boot() {
  const [sessions, pads, lib] = await Promise.all([loadSession(), loadPadInput(), loadLibrary()]);
  padInput.value = pads;
  let target: Target;
  try {
    target = await sessions.resolveTarget({ title: props.title, source: props.source });
  } catch (error) {
    Object.assign(state, { phase: 'error', error: error instanceof Error ? error.message : String(error) });
    return;
  }
  const info = await lib.titleInfo(target.title, target.app);
  game.name = info.name;
  if (info.icon) game.icon = URL.createObjectURL(info.icon);
  document.title = `${game.name} — Vita3K Web`;

  const s = sessions.createSession({
    settings: { ...sessionSettings.value },
    // A canvas hands its control to one worker only: every run gets a new one.
    canvas: () => {
      const canvas = document.createElement('canvas');
      canvas.width = 960; canvas.height = 544;
      canvas.className = 'game-canvas';
      canvas.setAttribute('aria-label', game.name);
      const previous = stage.value?.querySelector('canvas.game-canvas');
      if (previous) previous.replaceWith(canvas);
      else stage.value?.prepend(canvas);
      return canvas;
    },
  });
  session.value = s;
  s.on('launch', (launch) => { state.launch = launch; });
  s.on('status', (text) => { state.status = text; });
  s.on('notice', showNotice);
  s.on('log', (text) => {
    logLines.push(text);
    if (logLines.length > LOG_LINES) logLines.splice(0, logLines.length - LOG_LINES);
    logVersion.value++;
    logFile?.add(text);
  });
  s.on('frame', (stats) => { state.frames = stats.frames; state.fps = stats.fps; if (state.phase !== 'error') state.phase = 'running'; });
  s.on('saved', () => { refreshLibrary(); });
  s.on('stopped', () => {
    dialog.value = null; ime.value = null; fingers.clear();
    if (!starting && state.phase !== 'error') state.phase = 'stopped';
    if (!starting) closeLogFile();
  });
  s.on('dialog', onDialog);
  s.on('ime', (message) => {
    if (message.state === 'close') { if (ime.value?.id === message.id) ime.value = null; return; }
    clearInputs();
    ime.value = message;
  });
  gamepads = pads.createGamepadInput(s.pad, {
    enabled: () => !dialog.value && !ime.value,
    onPress: (button) => { if (s.running && dialog.value && !ime.value) dialogButton(button); },
    onGesture: s.ensureAudio,
    onConnect: () => { state.gamepad = gamepads?.connected() ?? false; },
  });
  state.gamepad = gamepads.connected();
  await run();
}

async function run() {
  const s = session.value;
  if (!s) return;
  Object.assign(state, { phase: 'loading', error: '', frames: 0, fps: 0, launch: { phase: 'Starting…', detail: '' } });
  try {
    const sessions = await loadSession();
    const target = await sessions.resolveTarget({ title: props.title, source: props.source });
    if (!target.title) throw new Error('This game is not in this browser: import it from the Library.');
    const problem = sessions.webgpuProblem();
    if (problem) throw new Error(problem);
    await openRunLog();
    starting = true;
    try { await s.start(target); } finally { starting = false; }
    s.setMuted(state.muted);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Object.assign(state, { phase: 'error', error: message });
    logFile?.add('Could not start: ' + message);
    closeLogFile();
  }
}
function stopGame() { session.value?.stop('Stopped'); }
function askStop() { if (live.value) confirming.value = 'stop'; else stopGame(); }
function askBack() { if (live.value) confirming.value = 'leave'; else back(); }
function confirmed() {
  const action = confirming.value;
  confirming.value = null;
  if (action === 'leave') back();
  else if (action === 'stop') stopGame();
}

// --- Guest dialogs ------------------------------------------------------------
function onDialog(message: Dialog) {
  const pads = padInput.value;
  if (!pads) return;
  if (message.state === 'close') { if (dialog.value?.id === message.id) dialog.value = null; return; }
  if (message.state === 'open') clearInputs();
  if (message.state !== 'open' && dialog.value?.id !== message.id) return;
  const selected = Math.min(dialog.value?.id === message.id ? dialog.value.selected : 0, Math.max(0, message.buttons.length - 1));
  dialog.value = { ...message, selected, enter: message.enterButton === 'circle' ? pads.SCE_CTRL.circle : pads.SCE_CTRL.cross };
}
function dialogButton(button: number) {
  const pads = padInput.value, d = dialog.value;
  if (!pads || !d) return;
  if (button === pads.SCE_CTRL.left || button === pads.SCE_CTRL.right) {
    d.selected = Math.max(0, Math.min(d.buttons.length - 1, d.selected + (button === pads.SCE_CTRL.right ? 1 : -1)));
  } else if (button === pads.SCE_CTRL.cross || button === pads.SCE_CTRL.circle) {
    session.value?.pressDialog(d.id, button, d.selected);
  }
}

// --- Keyboard -----------------------------------------------------------------
function onKey(event: KeyboardEvent) {
  const s = session.value, pads = padInput.value;
  if (!s || !pads) return;
  if (event.type === 'keyup') s.pad.release('key:' + event.code);
  if (ime.value) return; // the keyboard field has the keys
  if (event.code === 'Escape' && expanded.value) { expanded.value = false; return; }
  if (!s.running || !(event.code in pads.keyMap)) return;
  if (dialog.value) {
    if (event.code === 'Enter') return; // activates the focused button
    event.preventDefault();
    if (event.type === 'keydown' && !event.repeat) dialogButton(pads.keyMap[event.code].buttons ?? 0);
    return;
  }
  if ((event.target as HTMLElement | null)?.closest?.('input, textarea, select, a, [contenteditable="true"]')) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  event.preventDefault();
  if (event.type === 'keydown' && !event.repeat) { s.ensureAudio(); s.pad.set('key:' + event.code, pads.keyMap[event.code]); }
}
useEventListener(window, 'keydown', onKey);
useEventListener(window, 'keyup', onKey);
useEventListener(window, 'blur', clearInputs);
useEventListener(document, 'visibilitychange', () => { if (document.hidden) clearInputs(); });

function toggleMute() {
  state.muted = !state.muted;
  session.value?.setMuted(state.muted);
}
function back() {
  stopGame();
  navigate('library');
}

onMounted(boot);
onBeforeUnmount(() => {
  gamepads?.clear();
  session.value?.dispose();
  closeLogFile();
  if (game.icon) URL.revokeObjectURL(game.icon);
  document.title = 'Vita3K Web';
});
const dialogHint = computed(() => dialog.value?.enterButton === 'circle' ? '○ selects · × backs out' : '× selects · ○ backs out');
</script>

<template>
  <div
    ref="root"
    class="flex flex-col bg-surface h-[100dvh]"
    :class="expanded ? 'fixed inset-0 z-50' : ''"
  >
    <!-- Top bar -->
    <header v-if="!immersive" class="top-bar flex items-center gap-1 sm:gap-2 h-16 px-2 sm:px-4 shrink-0 pt-[env(safe-area-inset-top)]">
      <a :href="href('library')" class="icon-btn" aria-label="Back to the library" @click.prevent="askBack"><span class="i-lucide-arrow-left text-xl" /></a>
      <img v-if="game.icon" :src="game.icon" alt="" class="w-9 h-9 rounded-xl hidden sm:block">
      <div class="flex-1 min-w-0 px-1">
        <div class="font-medium truncate">{{ game.name }}</div>
        <div class="text-xs text-outline truncate">{{ title }}{{ state.phase === 'running' ? '' : ` · ${state.phase === 'loading' ? 'starting' : state.phase}` }}</div>
      </div>
      <button class="icon-btn" aria-label="Logs" @click="logsOpen = true"><span class="i-lucide-bug text-xl" /></button>
      <button class="icon-btn" :aria-label="state.muted ? 'Turn sound on' : 'Mute'" :aria-pressed="state.muted" @click="toggleMute">
        <span :class="state.muted ? 'i-lucide-volume-x' : 'i-lucide-volume-2'" class="text-xl" />
      </button>
      <button v-if="state.phase === 'running' || state.phase === 'loading'" class="icon-btn" aria-label="Stop the game" @click="askStop">
        <span class="i-lucide-square text-lg" />
      </button>
      <button v-else class="icon-btn" aria-label="Start again" @click="run"><span class="i-lucide-rotate-ccw text-xl" /></button>
      <button class="icon-btn" aria-label="Fullscreen" @click="toggleFullscreen"><span class="i-lucide-maximize text-xl" /></button>
    </header>

    <!-- The game -->
    <div
      ref="stage"
      class="stage relative flex-1 min-h-0 bg-black overflow-hidden"
      :class="{ 'touch-portrait': touchVisible && portrait, 'rounded-t-card sm:rounded-card sm:mx-4 sm:mb-4': !immersive }"
      tabindex="-1"
      :data-frames="state.frames"
      :data-phase="state.phase"
    >
      <canvas class="game-canvas" width="960" height="544" />

      <!-- Starting -->
      <div v-if="state.phase === 'loading'" class="absolute inset-0 z-3 flex flex-col items-center justify-center gap-5 p-6 text-center bg-surface-low">
        <img v-if="game.icon" :src="game.icon" alt="" class="w-24 h-24 rounded-card">
        <div class="text-xl">{{ game.name }}</div>
        <div class="w-full max-w-sm">
          <ProgressBar :value="state.launch?.fraction" label="Starting the game" />
          <div class="mt-3 text-sm text-on-surface-variant break-words min-h-5">{{ state.launch?.phase }}</div>
          <div class="mt-1 text-xs text-outline font-mono break-words min-h-4">{{ state.launch?.detail }}</div>
        </div>
      </div>

      <!-- Stopped or failed -->
      <div v-else-if="state.phase !== 'running'" class="absolute inset-0 z-3 flex flex-col items-center justify-center gap-4 p-6 text-center bg-surface/90">
        <span
          class="flex items-center justify-center w-16 h-16 rounded-full"
          :class="state.phase === 'error' ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container'"
        >
          <span :class="state.phase === 'error' ? 'i-lucide-triangle-alert' : 'i-lucide-pause'" class="text-3xl" />
        </span>
        <div class="text-lg">{{ state.phase === 'error' ? 'The game could not start' : 'Stopped' }}</div>
        <p v-if="state.error" class="max-w-lg m-0 text-sm text-on-surface-variant break-words leading-relaxed">{{ state.error }}</p>
        <div class="flex gap-2">
          <button class="btn-tonal" @click="back"><span class="i-lucide-arrow-left" />Library</button>
          <button class="btn-filled" @click="run"><span class="i-lucide-play" />{{ state.phase === 'error' ? 'Try again' : 'Start again' }}</button>
        </div>
      </div>

      <TouchControls
        v-if="padInput && session && touchVisible && state.phase !== 'stopped'"
        ref="touch"
        :pad="session.pad"
        :pad-input="padInput"
        :enabled="() => !dialog && !ime"
        :on-gesture="session.ensureAudio"
        :opacity="settings.touchOpacity"
        :size="settings.touchSize"
        :portrait="portrait"
      />
      <GuestDialog
        v-if="dialog"
        :message="dialog.message"
        :buttons="dialog.buttons"
        :selected="dialog.selected"
        :progress="dialog.progress"
        :hint="dialogHint"
        @press="(index) => session?.pressDialog(dialog!.id, dialog!.enter, index)"
      />
      <GuestKeyboard
        v-if="ime"
        :key="ime.id"
        :text="ime.text"
        :max-length="ime.maxLength"
        :caret="ime.caret"
        :enter-label="ime.enterLabel ?? ''"
        @input="(text, caret) => session?.sendIme(ime!.id, 0, text, caret)"
        @enter="(text, caret) => { session?.sendIme(ime!.id, 0, text, caret); session?.sendIme(ime!.id, 1, text, caret); }"
        @close="session?.sendIme(ime!.id, 2, ime!.text, 0)"
      />

      <!-- Frame rate, over the game's top right corner -->
      <!-- (below the R button when the touch controls cover the corner) -->
      <div
        v-if="settings.showFps && state.phase === 'running'"
        class="fps absolute right-3 z-4 pointer-events-none select-none font-mono text-sm font-bold tabular-nums text-white"
        :class="touchVisible && !portrait ? 'top-16' : 'top-2'"
      >
        {{ state.fps.toFixed(0) }} FPS
      </div>

      <!-- Fullscreen: only the way out, on the right edge -->
      <button
        v-if="immersive"
        class="absolute right-0 top-1/2 -translate-y-1/2 z-5 flex items-center justify-start pl-1 w-7 h-10 border-0 rounded-l-full bg-secondary-container text-on-secondary-container opacity-15 hover:opacity-90 cursor-pointer transition-opacity duration-150"
        aria-label="Exit fullscreen"
        @click="toggleFullscreen"
      >
        <span class="i-lucide-chevron-left text-xl" />
      </button>

      <Transition name="fade">
        <div
          v-if="notice"
          class="absolute z-6 left-1/2 -translate-x-1/2 top-4 max-w-[calc(100%-32px)] flex items-center gap-3 pl-4 pr-1.5 py-1.5 rounded-xl bg-inverse-surface text-inverse-on-surface text-sm"
          role="status"
        >
          <span class="flex-1">{{ notice }}</span>
          <button class="icon-btn w-8 h-8 text-inverse-on-surface" aria-label="Dismiss" @click="notice = ''"><span class="i-lucide-x" /></button>
        </div>
      </Transition>
    </div>

    <LogsDialog :open="logsOpen" :lines="logLines" :version="logVersion" :title="title" :saved-to="logFileName" @close="logsOpen = false" />
    <BaseDialog :open="confirming !== null" :title="confirming === 'leave' ? 'Leave the game?' : 'Stop the game?'" @close="confirming = null">
      <p class="m-0 text-on-surface-variant leading-relaxed">
        {{ confirming === 'leave' ? 'The game stops and you go back to the library.' : 'The game stops; you can start it again.' }}
        Progress since the last in-game save is lost.
      </p>
      <template #actions>
        <button class="btn-text" @click="confirming = null">Cancel</button>
        <button class="btn-danger" autofocus @click="confirmed">{{ confirming === 'leave' ? 'Leave' : 'Stop' }}</button>
      </template>
    </BaseDialog>
  </div>
</template>

<style scoped>
.stage :deep(canvas.game-canvas) {
  position: absolute; inset: 0; width: 100%; height: 100%; touch-action: none;
  object-fit: contain; image-rendering: auto; display: block;
}
/* Phones held sideways: a compact bar, the game edge to edge. */
@media (orientation: landscape) and (max-height: 500px) {
  .top-bar { height: 44px; }
  .stage { margin: 0 !important; border-radius: 0 !important; }
}
/* Phones held upright with touch controls: the game at the top. */
.touch-portrait :deep(canvas.game-canvas) { object-position: center top; }
/* White with a black outline: readable over any frame. */
.fps {
  -webkit-text-stroke: 3px #000; paint-order: stroke fill;
  text-shadow: 0 0 2px #000;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.18s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

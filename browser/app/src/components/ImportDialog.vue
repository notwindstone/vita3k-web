<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { importJob, importFile, library } from '../library';
import { formatBytes } from '../runtime';
import { navigate } from '../router';
import BaseDialog from './BaseDialog.vue';
import SegmentedControl from './SegmentedControl.vue';
import ProgressBar from './ProgressBar.vue';

const props = defineProps<{ open: boolean; initial: 'game' | 'firmware' }>();
const emit = defineEmits<{ close: [] }>();

const kind = ref<'game' | 'firmware'>(props.initial);
const file = ref<File | null>(null);
const zrif = ref('');
const dragging = ref(false);
const picker = ref<HTMLInputElement | null>(null);

watch(() => props.open, (open) => {
  if (!open || importJob.active) return;
  kind.value = props.initial;
  file.value = null; zrif.value = '';
  Object.assign(importJob, { result: null, error: '', progress: null });
});

const isPkg = computed(() => /\.pkg$/i.test(file.value?.name ?? ''));
const accept = computed(() => (kind.value === 'game' ? '.zip,.vpk,.pkg' : '.pup,.PUP,.zip'));
const ready = computed(() => file.value !== null && (!isPkg.value || zrif.value.trim().length > 20) && !importJob.active);
const done = computed(() => importJob.result !== null && !importJob.active);
const importedName = computed(() => library.games.find((game) => game.title === importJob.result?.title)?.name ?? importJob.result?.title);
const phaseText = computed(() => {
  const progress = importJob.progress;
  if (!progress) return 'Reading the file…';
  const verbs: Record<string, string> = { load: 'Loading', prepare: 'Preparing', inflate: 'Inflating', unpack: 'Unpacking', decrypt: 'Decrypting', install: 'Installing', store: 'Storing' };
  const verb = verbs[progress.phase] ?? progress.phase;
  return `${verb} ${progress.path}`;
});
const fraction = computed(() => {
  const progress = importJob.progress;
  return progress && progress.total ? progress.bytes / progress.total : undefined;
});

function choose(files: FileList | null | undefined) {
  const chosen = files?.[0];
  if (!chosen) return;
  file.value = chosen;
  importJob.error = '';
  importJob.result = null;
}
function onDrop(event: DragEvent) {
  dragging.value = false;
  choose(event.dataTransfer?.files);
}
async function start() {
  if (!file.value) return;
  await importFile(file.value, kind.value, zrif.value);
}
function play() {
  const title = importJob.result?.title;
  emit('close');
  if (title) navigate('play', title, library.games.some((g) => g.title === title && g.source === 'server') ? 'package' : null);
}
</script>

<template>
  <BaseDialog :open="open" title="Import" wide :locked="importJob.active" @close="emit('close')">
    <!-- What to import -->
    <template v-if="!importJob.active && !done">
      <SegmentedControl
        v-model="kind"
        label="What to import"
        :options="[{ value: 'game', label: 'Game', icon: 'i-lucide-gamepad-2' }, { value: 'firmware', label: 'Firmware', icon: 'i-lucide-cpu' }]"
        @update:model-value="file = null"
      />
      <div class="mt-5 text-sm text-on-surface-variant leading-relaxed">
        <template v-if="kind === 'game'">
          <ul class="m-0 pl-5 space-y-1">
            <li><b class="text-on-surface font-medium">.zip / .vpk</b> — a game folder (as desktop Vita3K installs it) or an encrypted dump with its <code>work.bin</code>: decrypted here.</li>
            <li><b class="text-on-surface font-medium">.pkg</b> — a PSN download, with its zRIF license string.</li>
          </ul>
        </template>
        <template v-else>
          <ul class="m-0 pl-5 space-y-1">
            <li><b class="text-on-surface font-medium">System software</b> — Sony's <code>PSVUPDAT.PUP</code> (3.74 recommended), needed by every game.</li>
            <li><b class="text-on-surface font-medium">Font package</b> — its <code>.PUP</code>, for games that draw text with the system fonts.</li>
            <li>Or a <b class="text-on-surface font-medium">.zip</b> of an installed firmware's <code>os0</code>/<code>vs0</code> (and <code>sa0</code>) folders.</li>
          </ul>
          <div class="flex flex-wrap gap-2 mt-3">
            <a class="btn-tonal h-9 px-4 no-underline text-xs" href="https://www.playstation.com/en-us/support/hardware/psvita/system-software/" target="_blank" rel="noreferrer">
              <span class="i-lucide-external-link" />System software
            </a>
            <a class="btn-tonal h-9 px-4 no-underline text-xs" href="http://dus01.psp2.update.playstation.net/update/psp2/image/2022_0209/sd_59dcf059d3328fb67be7e51f8aa33418/PSP2UPDAT.PUP?dest=us" rel="noreferrer">
              <span class="i-lucide-download" />Font package
            </a>
          </div>
          <p class="mt-3 mb-0 text-xs text-outline">
            Installed now: {{ library.firmware.system ? 'system software' : 'no system software' }}{{ library.firmware.fonts ? ', fonts' : '' }}.
          </p>
        </template>
      </div>

      <!-- The file -->
      <div
        class="mt-5 flex flex-col items-center justify-center gap-3 rounded-card px-4 py-8 text-center transition-colors duration-150"
        :class="dragging ? 'bg-primary-container text-on-primary-container' : 'bg-surface-highest'"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
      >
        <span class="i-lucide-file-up text-3xl" :class="dragging ? '' : 'text-primary'" />
        <div v-if="file" class="text-sm">
          <div class="font-medium break-all">{{ file.name }}</div>
          <div class="text-outline mt-0.5">{{ formatBytes(file.size) }}</div>
        </div>
        <div v-else class="text-sm text-on-surface-variant">Drop a file here, or</div>
        <button class="btn-tonal" @click="picker?.click()">{{ file ? 'Choose another file' : 'Choose a file' }}</button>
        <input ref="picker" type="file" :accept="accept" hidden @change="choose(($event.target as HTMLInputElement).files); ($event.target as HTMLInputElement).value = ''">
      </div>

      <label v-if="isPkg" class="block mt-4">
        <span class="label-text">zRIF license</span>
        <input v-model="zrif" class="field mt-2 font-mono text-xs" placeholder="KO5ifR1dQ+eH…" autocomplete="off" spellcheck="false">
        <span class="block text-xs text-outline mt-2 px-1">The string NoPayStation lists next to the download.</span>
      </label>

      <p v-if="importJob.error" class="flex gap-2 mt-4 mb-0 p-4 rounded-2xl bg-error-container text-on-error-container text-sm">
        <span class="i-lucide-circle-alert shrink-0 mt-0.5" />{{ importJob.error }}
      </p>
    </template>

    <!-- Working -->
    <div v-else-if="importJob.active" class="py-2" aria-live="polite">
      <div class="flex items-center gap-3 mb-4">
        <span class="i-lucide-loader-circle animate-spin text-2xl text-primary" />
        <div class="min-w-0">
          <div class="font-medium break-all">{{ importJob.fileName }}</div>
          <div class="text-sm text-on-surface-variant truncate">{{ phaseText }}</div>
        </div>
      </div>
      <ProgressBar :value="fraction" label="Import progress" />
      <div class="text-xs text-outline mt-2">
        {{ importJob.progress ? formatBytes(importJob.progress.bytes) : '' }}{{ importJob.progress?.total ? ` of ${formatBytes(importJob.progress.total)}` : '' }}
      </div>
      <p class="text-sm text-on-surface-variant mt-4 mb-0">Keep this page open: large games take a few minutes.</p>
    </div>

    <!-- Done -->
    <div v-else class="flex flex-col items-center text-center py-4">
      <span class="flex items-center justify-center w-16 h-16 rounded-full bg-primary-container text-on-primary-container mb-4">
        <span class="i-lucide-check text-3xl" />
      </span>
      <template v-if="importJob.result?.kind === 'game'">
        <div class="text-lg">{{ importedName }} is ready</div>
        <div class="text-sm text-on-surface-variant mt-1">
          {{ importJob.result.files }} files · {{ formatBytes(importJob.result.bytes) }}{{ importJob.result.decrypted ? ' · decrypted' : '' }}
        </div>
      </template>
      <template v-else>
        <div class="text-lg">Firmware {{ importJob.result?.version ?? '' }} installed</div>
        <div class="text-sm text-on-surface-variant mt-1">
          {{ library.firmware.system ? 'System software' : '' }}{{ library.firmware.fonts ? ' and fonts' : '' }} ready · {{ formatBytes(importJob.result?.bytes ?? 0) }}
        </div>
      </template>
    </div>

    <template #actions>
      <template v-if="done">
        <button v-if="importJob.result?.kind === 'firmware'" class="btn-text" @click="Object.assign(importJob, { result: null }); file = null; kind = 'firmware'">Import more firmware</button>
        <button v-if="importJob.result?.kind === 'game'" class="btn-text" @click="emit('close')">Close</button>
        <button v-if="importJob.result?.kind === 'game'" class="btn-filled" @click="play"><span class="i-lucide-play" />Play</button>
        <button v-else class="btn-filled" @click="emit('close')">Done</button>
      </template>
      <template v-else-if="!importJob.active">
        <button class="btn-text" @click="emit('close')">Cancel</button>
        <button class="btn-filled" :disabled="!ready" @click="start"><span class="i-lucide-arrow-down-to-line" />Import</button>
      </template>
    </template>
  </BaseDialog>
</template>

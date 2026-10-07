<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { settings, resetSettings, threadsAvailable } from '../settings';
import { library, refreshLibrary } from '../library';
import { loadLibrary, formatBytes } from '../runtime';
import SettingRow from '../components/SettingRow.vue';
import ToggleSwitch from '../components/ToggleSwitch.vue';
import SegmentedControl from '../components/SegmentedControl.vue';
import BaseDialog from '../components/BaseDialog.vue';
import ProgressBar from '../components/ProgressBar.vue';
import ColorSchemePicker from '../components/ColorSchemePicker.vue';

const estimate = ref<{ usage?: number; quota?: number } | null>(null);
const refreshEstimate = async () => { estimate.value = await (await loadLibrary()).storageEstimate(); };
onMounted(refreshEstimate);

const confirming = ref<'firmware' | 'everything' | null>(null);
async function removeFirmware() {
  confirming.value = null;
  await (await loadLibrary()).removeFirmware();
  await refreshLibrary(); await refreshEstimate();
}
async function removeEverything() {
  confirming.value = null;
  const lib = await loadLibrary();
  for (const game of library.games.filter((g) => g.source === 'package')) await lib.removeTitle(game.title, game.app, { withSaves: true });
  await lib.removeFirmware();
  await refreshLibrary(); await refreshEstimate();
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-8 pt-2 lg:pt-10 pb-16">
    <h1 class="m-0 mb-6 text-3xl font-normal">Settings</h1>

    <h2 class="section-title">Interface</h2>
    <div class="card divide-y divide-surface">
      <div class="px-5 py-4">
        <ColorSchemePicker v-model="settings.colorScheme" />
      </div>
      <SettingRow title="Touch controls" description="The on-screen buttons and sticks. Automatic shows them on touch screens, unless a gamepad is connected." stack>
        <SegmentedControl
          v-model="settings.touch"
          label="Touch controls"
          :options="[{ value: 'auto', label: 'Automatic' }, { value: 'on', label: 'Always' }, { value: 'off', label: 'Hidden' }]"
        />
      </SettingRow>
      <SettingRow title="Control opacity" :description="`${settings.touchOpacity}%`">
        <input v-model.number="settings.touchOpacity" type="range" min="25" max="100" step="5" class="w-36 sm:w-48" aria-label="Control opacity">
      </SettingRow>
      <SettingRow title="Control size" :description="`${settings.touchSize}%`">
        <input v-model.number="settings.touchSize" type="range" min="70" max="130" step="5" class="w-36 sm:w-48" aria-label="Control size">
      </SettingRow>
      <SettingRow title="Frame rate counter" description="Frames per second in the corner of the game.">
        <ToggleSwitch v-model="settings.showFps" label="Frame rate counter" />
      </SettingRow>
    </div>

    <h2 class="section-title">Player</h2>
    <div class="card divide-y divide-surface">
      <SettingRow title="Resolution" description="Internal rendering resolution. 2× is sharper and needs a faster GPU." stack>
        <SegmentedControl v-model="settings.scale" label="Resolution" :options="[{ value: 1, label: '1× (960×544)' }, { value: 2, label: '2×' }]" />
      </SettingRow>
      <SettingRow title="Start muted" description="Games start without sound; the player's sound button turns it on.">
        <ToggleSwitch v-model="settings.startMuted" label="Start muted" />
      </SettingRow>
      <SettingRow title="Frame rate hack" description="Lets some games run faster than they were made to. May break timing.">
        <ToggleSwitch v-model="settings.fpsHack" label="Frame rate hack" />
      </SettingRow>
    </div>

    <h2 class="section-title">Performance</h2>
    <div class="card divide-y divide-surface">
      <SettingRow title="Multithreaded runtime" stack :disabled="!threadsAvailable">
        <template #description>
          Runs the game's threads in parallel: much faster on most devices.
          <span v-if="!threadsAvailable" class="block text-error mt-1">Unavailable: this page is not cross-origin isolated.</span>
        </template>
        <ToggleSwitch v-model="settings.threads" label="Multithreaded runtime" :disabled="!threadsAvailable" />
      </SettingRow>
      <SettingRow title="Background scene building" description="Prepares graphics on its own thread (multithreaded runtime only)." :disabled="!settings.threads || !threadsAvailable">
        <ToggleSwitch v-model="settings.asyncScene" label="Background scene building" :disabled="!settings.threads || !threadsAvailable" />
      </SettingRow>
      <SettingRow title="Ahead-of-time compilation" description="Compiles a game's code when it starts, for speed. Automatic does so for imported games." stack>
        <SegmentedControl
          v-model="settings.buildAot"
          label="Ahead-of-time compilation"
          :options="[{ value: 'auto', label: 'Automatic' }, { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]"
        />
      </SettingRow>
      <SettingRow title="Fast system calls" description="Handles the most frequent system calls without leaving compiled code.">
        <ToggleSwitch v-model="settings.hleIntrinsics" label="Fast system calls" />
      </SettingRow>
    </div>

    <h2 class="section-title">Storage</h2>
    <div class="card divide-y divide-surface">
      <div class="px-5 py-4">
        <div class="flex justify-between text-sm mb-2">
          <span>Used by this site</span>
          <span class="text-on-surface-variant">
            {{ estimate?.usage !== undefined ? formatBytes(estimate.usage) : '—' }}{{ estimate?.quota ? ` of ${formatBytes(estimate.quota)}` : '' }}
          </span>
        </div>
        <ProgressBar :value="estimate?.usage !== undefined && estimate?.quota ? estimate.usage / estimate.quota : 0" label="Storage used" />
      </div>
      <SettingRow
        title="Firmware"
        :description="library.firmware.files
          ? `${library.firmware.system ? 'System software' : 'No system software'}${library.firmware.fonts ? ' and fonts' : ', no fonts'} · ${formatBytes(library.firmware.bytes)}`
          : 'Not installed'"
      >
        <button class="btn-tonal" :disabled="!library.firmware.files" @click="confirming = 'firmware'">Remove</button>
      </SettingRow>
      <SettingRow title="Remove everything" description="Every imported game, its saves and the firmware.">
        <button class="btn-danger" @click="confirming = 'everything'">Remove</button>
      </SettingRow>
    </div>

    <h2 class="section-title">Others</h2>
    <div class="card divide-y divide-surface">
      <SettingRow title="Save logs to files" description="Every run of a game writes its log to vita3k-logs on the Files page, for bug reports. The newest 20 stay.">
        <ToggleSwitch v-model="settings.saveLogs" label="Save logs to files" />
      </SettingRow>
      <SettingRow title="Stop on missing functions" description="A game that calls a system function this build lacks stops, naming it. Off, the call returns 0 and the game goes on, as in desktop Vita3K.">
        <ToggleSwitch v-model="settings.strictImports" label="Stop on missing functions" />
      </SettingRow>
      <SettingRow title="Reset settings" description="Back to the defaults; games and saves stay.">
        <button class="btn-tonal" @click="resetSettings">Reset</button>
      </SettingRow>
    </div>

    <BaseDialog :open="confirming !== null" :title="confirming === 'firmware' ? 'Remove the firmware?' : 'Remove everything?'" @close="confirming = null">
      <p class="m-0 text-on-surface-variant leading-relaxed">
        {{ confirming === 'firmware'
          ? 'Games will not start until you import it again.'
          : 'Every imported game, every save and the firmware leave this browser. This cannot be undone.' }}
      </p>
      <template #actions>
        <button class="btn-text" @click="confirming = null">Cancel</button>
        <button class="btn-danger" @click="confirming === 'firmware' ? removeFirmware() : removeEverything()">Remove</button>
      </template>
    </BaseDialog>
  </div>
</template>

<style scoped>
.section-title { margin: 32px 4px 12px; font-size: 14px; font-weight: 500; color: rgb(var(--color-primary)); }
.section-title:first-of-type { margin-top: 8px; }
</style>

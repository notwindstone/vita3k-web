<script setup lang="ts">
import { computed, ref } from 'vue';
import { library, refreshLibrary, type Game } from '../library';
import { loadLibrary } from '../runtime';
import GameCard from '../components/GameCard.vue';
import ImportDialog from '../components/ImportDialog.vue';
import BaseDialog from '../components/BaseDialog.vue';

const query = ref('');
const importOpen = ref(false);
const importKind = ref<'game' | 'firmware'>('game');
const openImport = (kind: 'game' | 'firmware') => { importKind.value = kind; importOpen.value = true; };

const games = computed(() => {
  const words = query.value.toLowerCase().split(/\s+/).filter(Boolean);
  return library.games.filter((game) => words.every((word) => `${game.name} ${game.title}`.toLowerCase().includes(word)));
});
// Server and package copies of one title are told apart only when both exist.
const showSource = computed(() => library.games.some((game) => game.source === 'server'));

const message = ref('');
const removing = ref<Game | null>(null);
const savesInput = ref<HTMLInputElement | null>(null);
let savesFor: Game | null = null;

async function onAction(action: 'download-saves' | 'restore-saves' | 'remove', game: Game) {
  const lib = await loadLibrary();
  if (action === 'download-saves') {
    const zip = await lib.savesZip(game.title);
    if (!zip) { message.value = `${game.name} has no saves in this browser yet.`; return; }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(zip);
    link.download = `${game.title}-saves.zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  } else if (action === 'restore-saves') {
    savesFor = game;
    savesInput.value?.click();
  } else {
    removing.value = game;
  }
}
async function restoreSaves(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !savesFor) return;
  const game = savesFor;
  try {
    const lib = await loadLibrary();
    const count = await lib.restoreSaves(game.title, file, { confirmReplace: (existing, incoming) =>
      confirm(`Replace the ${existing} save file(s) of ${game.name} in this browser with ${incoming} from ${file.name}?`) });
    if (count) message.value = `Restored ${count} save file(s) for ${game.name}.`;
  } catch (error) {
    message.value = `Could not restore the saves: ${error instanceof Error ? error.message : error}`;
  }
}
async function remove(withSaves: boolean) {
  const game = removing.value;
  removing.value = null;
  if (!game) return;
  const lib = await loadLibrary();
  await lib.removeTitle(game.title, game.app, { withSaves });
  await refreshLibrary();
  message.value = `${game.name} was removed${withSaves ? ' with its saves' : ''}.`;
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-8 pt-2 lg:pt-10 pb-32">
    <div class="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
      <h1 class="m-0 text-3xl font-normal flex-1">Library</h1>
      <label class="relative block sm:w-80">
        <span class="sr-only">Search games</span>
        <span class="i-lucide-search absolute left-4 top-1/2 -translate-y-1/2 text-outline" />
        <input v-model="query" type="search" placeholder="Search games" class="field pl-12">
      </label>
    </div>

    <p v-if="!library.storage" class="card p-5 m-0 mb-6 bg-error-container text-on-error-container">
      This browser keeps no persistent storage for this site (a private window, or storage is blocked), so games cannot be imported.
    </p>
    <div
      v-else-if="!library.loading && !library.firmware.system && library.isStatic"
      class="card flex flex-col sm:flex-row sm:items-center gap-4 p-5 mb-6 bg-primary-container text-on-primary-container"
    >
      <span class="i-lucide-cpu text-3xl shrink-0" />
      <div class="flex-1">
        <div class="font-medium">Firmware needed</div>
        <div class="text-sm opacity-85 mt-0.5">Games run on the PS Vita system software: import Sony's firmware file once, then your games.</div>
      </div>
      <button class="btn-filled" @click="openImport('firmware')"><span class="i-lucide-download" />Import firmware</button>
    </div>
    <div
      v-else-if="!library.loading && library.firmware.system && !library.firmware.fonts"
      class="card flex items-center gap-3 px-5 py-3 mb-6 text-sm text-on-surface-variant"
    >
      <span class="i-lucide-type shrink-0" />
      <span class="flex-1">The firmware font package is missing: games that draw text with the system fonts need it.</span>
      <button class="btn-text" @click="openImport('firmware')">Import</button>
    </div>

    <div v-if="library.loading" class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
      <div v-for="n in 4" :key="n" class="card aspect-[3/4] animate-pulse" />
    </div>
    <div v-else-if="!library.games.length" class="flex flex-col items-center text-center py-16 px-4">
      <span class="flex items-center justify-center w-24 h-24 rounded-full bg-surface-container mb-6">
        <span class="i-lucide-gamepad-2 text-5xl text-primary" />
      </span>
      <h2 class="m-0 text-xl font-normal">Your library is empty</h2>
      <p class="max-w-md text-on-surface-variant leading-relaxed mt-2 mb-6">
        Everything stays in this browser. Import the PS Vita firmware once, then your games:
        decrypted folders, encrypted dumps (.zip/.vpk) or PSN downloads (.pkg with their zRIF).
      </p>
      <div class="flex flex-wrap justify-center gap-2">
        <button v-if="!library.firmware.system" class="btn-tonal" @click="openImport('firmware')"><span class="i-lucide-cpu" />Import firmware</button>
        <button class="btn-filled" @click="openImport('game')"><span class="i-lucide-plus" />Import a game</button>
      </div>
    </div>
    <template v-else>
      <div v-if="games.length" class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 sm:gap-4">
        <GameCard v-for="game in games" :key="game.source + game.title" :game="game" :show-source="showSource" @action="onAction" />
      </div>
      <p v-else class="text-center text-on-surface-variant py-16">No games match “{{ query }}”.</p>
    </template>
  </div>

  <!-- Import: a floating button, extended on wide screens -->
  <button
    class="fixed z-30 right-4 sm:right-8 bottom-[max(16px,env(safe-area-inset-bottom))] sm:bottom-8 flex items-center gap-3 h-14 px-4 sm:px-5 rounded-2xl border-0 bg-primary-container text-on-primary-container font-medium cursor-pointer hover:bg-primary-container-hover transition-colors duration-150"
    aria-label="Import a game or firmware"
    @click="openImport(library.firmware.system || !library.isStatic ? 'game' : 'firmware')"
  >
    <span class="i-lucide-plus text-2xl" />
    <span class="hidden sm:inline">Import</span>
  </button>

  <ImportDialog :open="importOpen" :initial="importKind" @close="importOpen = false" />
  <input ref="savesInput" type="file" accept=".zip,application/zip" hidden @change="restoreSaves">

  <BaseDialog :open="removing !== null" title="Remove this game?" @close="removing = null">
    <p class="m-0 text-on-surface-variant leading-relaxed">
      {{ removing?.name }} leaves this browser's storage. Its saves stay unless you remove them too.
    </p>
    <template #actions>
      <button class="btn-text" @click="removing = null">Cancel</button>
      <button class="btn-text text-error" @click="remove(true)">Remove with saves</button>
      <button class="btn-danger" @click="remove(false)">Remove</button>
    </template>
  </BaseDialog>

  <Transition name="fade">
    <div
      v-if="message"
      class="fixed z-40 left-1/2 -translate-x-1/2 bottom-24 sm:bottom-28 max-w-[calc(100%-32px)] flex items-center gap-3 pl-5 pr-2 py-2 rounded-xl bg-inverse-surface text-inverse-on-surface text-sm"
      role="status"
    >
      <span class="flex-1">{{ message }}</span>
      <button class="icon-btn w-8 h-8 text-inverse-on-surface" aria-label="Dismiss" @click="message = ''"><span class="i-lucide-x" /></button>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.18s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

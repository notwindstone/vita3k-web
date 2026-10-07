<script setup lang="ts">
import { ref } from 'vue';
import { onClickOutside } from '@vueuse/core';
import type { Game } from '../library';
import { href } from '../router';
import { formatBytes } from '../runtime';

// A game: its icon (sce_sys/icon0.png) and name; the card opens it, its menu
// holds the saves and removal.
const props = defineProps<{ game: Game; showSource: boolean }>();
const emit = defineEmits<{ action: [action: 'download-saves' | 'restore-saves' | 'remove', game: Game] }>();
const menu = ref(false);
const menuRoot = ref<HTMLElement | null>(null);
onClickOutside(menuRoot, () => { menu.value = false; });
const pick = (action: 'download-saves' | 'restore-saves' | 'remove') => { menu.value = false; emit('action', action, props.game); };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
</script>

<template>
  <article class="group relative card p-3 transition-colors duration-150 hover:bg-surface-high">
    <a
      :href="href('play', game.title, game.source === 'package' && showSource ? 'package' : null)"
      class="block no-underline text-inherit rounded-[14px] focus-visible:outline-offset-4"
      :aria-label="`Play ${game.name}`"
    >
      <div class="relative aspect-square overflow-hidden rounded-[14px] bg-surface-highest">
        <img v-if="game.icon" :src="game.icon" alt="" class="w-full h-full object-cover" loading="lazy" draggable="false">
        <div v-else class="w-full h-full flex items-center justify-center bg-tertiary-container text-on-tertiary-container text-3xl font-semibold">
          {{ initials(game.name) }}
        </div>
        <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-surface/40">
          <span class="flex items-center justify-center w-14 h-14 rounded-full bg-primary text-on-primary">
            <span class="i-lucide-play text-2xl ml-0.5" />
          </span>
        </div>
      </div>
      <div class="pt-3 pb-1 pr-8">
        <h3 class="m-0 text-base font-medium leading-snug line-clamp-2">{{ game.name }}</h3>
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-outline">
          <span>{{ game.title }}</span>
          <span v-if="game.bytes">· {{ formatBytes(game.bytes) }}</span>
          <span v-if="showSource" class="chip bg-secondary-container text-on-secondary-container h-5">{{ game.source }}</span>
        </div>
      </div>
    </a>
    <div ref="menuRoot" class="absolute right-1.5 bottom-2.5">
      <button class="icon-btn w-9 h-9" :aria-label="`More for ${game.name}`" :aria-expanded="menu" @click="menu = !menu">
        <span class="i-lucide-ellipsis-vertical" />
      </button>
      <div v-if="menu" class="absolute right-0 bottom-11 z-10 min-w-52 py-2 rounded-2xl bg-surface-highest" role="menu">
        <button class="menu-item" role="menuitem" @click="pick('download-saves')"><span class="i-lucide-download" />Download saves</button>
        <button class="menu-item" role="menuitem" @click="pick('restore-saves')"><span class="i-lucide-upload" />Restore saves…</button>
        <button v-if="game.source === 'package'" class="menu-item text-error" role="menuitem" @click="pick('remove')"><span class="i-lucide-trash-2" />Remove game…</button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.menu-item {
  display: flex; align-items: center; gap: 12px; width: 100%; height: 44px; padding: 0 16px;
  border: 0; background: transparent; text-align: left; font-size: 14px; cursor: pointer;
}
.menu-item:hover { background: rgb(var(--color-on-surface) / 0.08); }
</style>

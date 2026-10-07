<script setup lang="ts">
import { ref, watch } from 'vue';
import { route, href, type Page } from '../router';
import AppLogo from './AppLogo.vue';

// Wide screens: a sidebar. Narrow ones: a header whose menu button opens the
// same navigation over the whole screen.
const open = ref(false);
watch(() => route.value.page, () => { open.value = false; });

const items: { page: Page; label: string; icon: string }[] = [
  { page: 'library', label: 'Library', icon: 'i-lucide-library-big' },
  { page: 'files', label: 'Files', icon: 'i-lucide-folder-tree' },
  { page: 'settings', label: 'Settings', icon: 'i-lucide-settings-2' },
  { page: 'about', label: 'About', icon: 'i-lucide-info' },
];
</script>

<template>
  <!-- Header (narrow screens) -->
  <header class="lg:hidden sticky top-0 z-20 flex items-center gap-2 h-16 px-2 bg-surface">
    <button class="icon-btn" aria-label="Open navigation" :aria-expanded="open" @click="open = true">
      <span class="i-lucide-menu text-xl" />
    </button>
    <AppLogo :size="30" />
    <span class="font-semibold text-lg">Vita3K Web</span>
  </header>

  <!-- Sidebar (wide screens), or the full-screen menu -->
  <nav
    class="flex-col gap-1 bg-surface-low"
    :class="open
      ? 'fixed inset-0 z-40 flex p-4 pt-[max(16px,env(safe-area-inset-top))]'
      : 'hidden lg:flex lg:sticky lg:top-0 lg:h-screen lg:w-68 lg:shrink-0 p-4'"
    aria-label="Main"
  >
    <div class="flex items-center gap-3 px-3 h-16 mb-4">
      <AppLogo :size="36" />
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-lg leading-tight">Vita3K Web</div>
        <div class="text-xs text-outline">PS Vita in your browser</div>
      </div>
      <button v-if="open" class="icon-btn" aria-label="Close navigation" @click="open = false">
        <span class="i-lucide-x text-xl" />
      </button>
    </div>
    <a
      v-for="item in items"
      :key="item.page"
      :href="href(item.page)"
      class="flex items-center gap-4 h-14 lg:h-12 px-4 rounded-full no-underline text-base lg:text-sm font-medium transition-colors duration-150"
      :class="route.page === item.page
        ? 'bg-secondary-container text-on-secondary-container'
        : 'text-on-surface-variant hover:bg-on-surface/6'"
      :aria-current="route.page === item.page ? 'page' : undefined"
    >
      <span :class="item.icon" class="text-xl" />
      {{ item.label }}
    </a>
  </nav>
</template>

<script setup lang="ts">
import { colorSchemes, type ColorScheme } from '../palettes';

const model = defineModel<ColorScheme>({ required: true });
</script>

<template>
  <fieldset class="m-0 p-0 border-0 min-w-0">
    <legend class="px-0 text-base text-on-surface mb-1">Color scheme</legend>
    <p class="m-0 mb-3 text-sm text-on-surface-variant">Choose the colors of the app.</p>
    <div class="grid grid-cols-4 sm:grid-cols-7 gap-2">
      <label
        v-for="scheme in colorSchemes"
        :key="scheme"
        class="flex flex-col items-center gap-2 px-1 py-3 rounded-2xl cursor-pointer hover:bg-on-surface/8"
        :class="model === scheme ? 'bg-surface-highest' : ''"
      >
        <input v-model="model" type="radio" name="color-scheme" :value="scheme" class="scheme-input sr-only">
        <span :data-color-scheme="scheme" class="swatch flex items-center justify-center w-10 h-10 rounded-full bg-primary text-on-primary" aria-hidden="true">
          <span v-if="model === scheme" class="i-lucide-check text-xl" />
        </span>
        <span class="text-xs" :class="model === scheme ? 'font-medium text-on-surface' : 'text-on-surface-variant'">
          {{ scheme[0]?.toUpperCase() }}{{ scheme.slice(1) }}
        </span>
      </label>
    </div>
  </fieldset>
</template>

<style scoped>
.scheme-input:focus-visible + .swatch { outline: 2px solid rgb(var(--color-on-surface)); outline-offset: 4px; }
</style>

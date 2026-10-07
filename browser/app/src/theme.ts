import { watch } from 'vue';
import { settings } from './settings';
import { isColorScheme, palettes } from './palettes';

watch(() => settings.value.colorScheme, (value) => {
  const scheme = isColorScheme(value) ? value : 'blue';
  if (value !== scheme) settings.value.colorScheme = scheme;
  const palette = palettes[scheme];
  document.documentElement.dataset.colorScheme = scheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.surface);
  // Match the tab icon to the same two roles used by the app's logo.
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="${palette['primary-container']}"/><path d="M9 11h14a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-2a4 4 0 0 1 4-4z" fill="${palette.primary}"/><circle cx="10" cy="16" r="2" fill="${palette['primary-container']}"/><circle cx="22" cy="16" r="2" fill="${palette['primary-container']}"/></svg>`;
  document.querySelector('link[rel="icon"]')?.setAttribute('href', 'data:image/svg+xml,' + encodeURIComponent(icon));
}, { immediate: true });

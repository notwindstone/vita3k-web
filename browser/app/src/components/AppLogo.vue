<script setup lang="ts">
// The app's mark: a handheld silhouette in the primary container colour.
defineProps<{ size?: number }>();
</script>

<template>
  <svg :width="size ?? 40" :height="size ?? 40" viewBox="0 0 48 48" aria-hidden="true">
    <rect width="48" height="48" rx="14" fill="rgb(var(--color-primary-container))" />
    <path d="M13 16h22a6 6 0 0 1 6 6v4a6 6 0 0 1-6 6H13a6 6 0 0 1-6-6v-4a6 6 0 0 1 6-6z" fill="rgb(var(--color-primary))" />
    <rect x="17" y="19" width="14" height="10" rx="2.5" fill="rgb(var(--color-on-primary))" />
    <circle cx="12.5" cy="24" r="2.2" fill="rgb(var(--color-primary-container))" />
    <circle cx="35.5" cy="24" r="2.2" fill="rgb(var(--color-primary-container))" />
  </svg>
</template>

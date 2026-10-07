<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { onClickOutside } from '@vueuse/core';
import * as opfs from '../opfs';
import { filesHref } from '../router';
import { refreshLibrary } from '../library';
import { formatBytes } from '../runtime';
import BaseDialog from '../components/BaseDialog.vue';
import ProgressBar from '../components/ProgressBar.vue';

// The site's private storage (OPFS) as folders and files: what the library,
// the firmware and the saves are made of, and anything else put here.
const props = defineProps<{ path: string[] }>();

const entries = ref<opfs.Entry[]>([]);
const loading = ref(true);
const error = ref('');
const message = ref('');
const menuFor = ref<string | null>(null);
const menuRoot = ref<HTMLElement | null>(null);
onClickOutside(menuRoot, () => { menuFor.value = null; });

async function load() {
  loading.value = true;
  error.value = '';
  try {
    entries.value = await opfs.list(props.path);
  } catch (cause) {
    entries.value = [];
    error.value = props.path.length ? 'This folder no longer exists.' : String(cause);
  } finally {
    loading.value = false;
  }
}
watch(() => props.path.join('/'), load, { immediate: true });
// Content the emulator manages: the library may have changed.
const changed = async () => { await load(); await refreshLibrary(); };

// What the emulator keeps where (content_cache.js).
const known: Record<string, { label: string; icon: string }> = {
  'vita3k-content': { label: 'Games and firmware', icon: 'i-lucide-hard-drive' },
  'vita3k-meta': { label: 'File lists of games and firmware', icon: 'i-lucide-list' },
  'vita3k-saves': { label: 'Saves', icon: 'i-lucide-save' },
  'vita3k-logs': { label: 'Logs (Settings → Save logs to files)', icon: 'i-lucide-bug' },
  '_firmware': { label: 'Firmware', icon: 'i-lucide-cpu' },
  '_decrypt': { label: 'Temporary files of an import', icon: 'i-lucide-hourglass' },
};
const managed = computed(() => ['vita3k-content', 'vita3k-meta', 'vita3k-saves'].includes(props.path[0] ?? ''));
const crumbs = computed(() => props.path.map((name, index) => ({ name, href: filesHref(props.path.slice(0, index + 1)) })));
const iconFor = (entry: opfs.Entry) => {
  if (entry.kind === 'directory') return known[entry.name]?.icon ?? 'i-lucide-folder';
  if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(entry.name)) return 'i-lucide-file-image';
  if (/\.(json|txt|xml|ini|cfg)$/i.test(entry.name)) return 'i-lucide-file-text';
  if (/\.(zip|vpk|pkg|pup)$/i.test(entry.name)) return 'i-lucide-file-archive';
  if (/\.(at9|wav|mp3|ogg|wem)$/i.test(entry.name)) return 'i-lucide-file-audio';
  if (/\.(mp4|pmf)$/i.test(entry.name)) return 'i-lucide-file-video';
  return 'i-lucide-file';
};
const dateText = (ms: number) => (ms ? new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '');

// --- Folder size ----------------------------------------------------------------
const size = ref<{ bytes: number; files: number } | null>(null);
const sizing = ref(false);
watch(() => props.path.join('/'), () => { size.value = null; });
async function measure() {
  sizing.value = true;
  try { size.value = await opfs.folderSize(props.path); } finally { sizing.value = false; }
}

// --- New folder and rename ----------------------------------------------------------
const naming = reactive({ open: false, mode: 'create' as 'create' | 'rename', from: '', name: '', error: '' });
function openCreate() { Object.assign(naming, { open: true, mode: 'create', from: '', name: '', error: '' }); }
function openRename(entry: opfs.Entry) { menuFor.value = null; Object.assign(naming, { open: true, mode: 'rename', from: entry.name, name: entry.name, error: '' }); }
async function submitName() {
  const name = naming.name.trim();
  try {
    if (naming.mode === 'create') await opfs.createFolder(props.path, name);
    else await opfs.rename(props.path, naming.from, name);
    naming.open = false;
    await changed();
  } catch (cause) {
    naming.error = cause instanceof Error ? cause.message : String(cause);
  }
}

// --- Remove ---------------------------------------------------------------------------
const removing = ref<(opfs.Entry & { contents?: { bytes: number; files: number } }) | null>(null);
async function askRemove(entry: opfs.Entry) {
  menuFor.value = null;
  removing.value = { ...entry };
  if (entry.kind === 'directory') removing.value = { ...entry, contents: await opfs.folderSize([...props.path, entry.name]) };
}
async function confirmRemove() {
  const entry = removing.value;
  removing.value = null;
  if (!entry) return;
  try {
    await opfs.remove(props.path, entry.name);
    message.value = `Removed ${entry.name}.`;
  } catch (cause) {
    message.value = `Could not remove ${entry.name}: ${cause instanceof Error ? cause.message : cause}`;
  }
  await changed();
}

// --- Download -------------------------------------------------------------------------
async function download(entry: opfs.Entry) {
  menuFor.value = null;
  const file = await opfs.getFile(props.path, entry.name);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = entry.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 60000);
}

// --- Upload ---------------------------------------------------------------------------
const upload = reactive({ active: false, file: '', index: 0, count: 0, bytes: 0, total: 0, done: 0 });
const filesInput = ref<HTMLInputElement | null>(null);
const folderInput = ref<HTMLInputElement | null>(null);
const dragging = ref(false);
async function uploadFiles(files: { file: File; relative: string }[]) {
  if (!files.length || upload.active) return;
  const total = files.reduce((sum, item) => sum + item.file.size, 0);
  Object.assign(upload, { active: true, index: 0, count: files.length, total, done: 0 });
  try {
    for (const [index, item] of files.entries()) {
      Object.assign(upload, { file: item.relative, index: index + 1, bytes: 0 });
      await opfs.upload(props.path, item.file, item.relative, (bytes) => { upload.bytes = bytes; });
      upload.done += item.file.size;
    }
    message.value = `Uploaded ${files.length} file${files.length === 1 ? '' : 's'} (${formatBytes(total)}).`;
  } catch (cause) {
    message.value = `Upload failed at ${upload.file}: ${cause instanceof Error ? cause.message : cause}`;
  } finally {
    upload.active = false;
    await changed();
  }
}
function pickFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = [...(input.files ?? [])].map((file) => ({ file, relative: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name }));
  input.value = '';
  uploadFiles(files);
}
// Dropped files and folders (folders through the entries API).
async function onDrop(event: DragEvent) {
  dragging.value = false;
  const items = [...(event.dataTransfer?.items ?? [])];
  const files: { file: File; relative: string }[] = [];
  const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
      files.push({ file, relative: prefix + entry.name });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        if (!batch.length) break;
        for (const child of batch) await walk(child, `${prefix}${entry.name}/`);
      }
    }
  };
  const roots = items.map((item) => item.webkitGetAsEntry?.()).filter((entry): entry is FileSystemEntry => Boolean(entry));
  if (roots.length) for (const entry of roots) await walk(entry, '');
  else for (const file of [...(event.dataTransfer?.files ?? [])]) files.push({ file, relative: file.name });
  uploadFiles(files);
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-8 pt-2 lg:pt-10 pb-24">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
      <h1 class="m-0 text-3xl font-normal flex-1">Files</h1>
      <div class="flex flex-wrap gap-2">
        <button class="btn-tonal" :disabled="!opfs.supported() || upload.active" @click="openCreate"><span class="i-lucide-folder-plus" /><span class="hidden sm:inline">New folder</span></button>
        <button class="btn-tonal" :disabled="!opfs.supported() || upload.active" @click="folderInput?.click()"><span class="i-lucide-folder-up" /><span class="hidden sm:inline">Upload folder</span></button>
        <button class="btn-filled" :disabled="!opfs.supported() || upload.active" @click="filesInput?.click()"><span class="i-lucide-upload" />Upload files</button>
      </div>
      <input ref="filesInput" type="file" multiple hidden @change="pickFiles">
      <input ref="folderInput" type="file" webkitdirectory hidden @change="pickFiles">
    </div>

    <!-- Where we are -->
    <nav class="flex flex-wrap items-center gap-1 mb-4 text-sm" aria-label="Folder">
      <a :href="filesHref([])" class="flex items-center gap-1.5 h-8 px-3 rounded-full no-underline text-on-surface-variant hover:bg-on-surface/8">
        <span class="i-lucide-database" />Storage
      </a>
      <template v-for="(crumb, index) in crumbs" :key="crumb.href">
        <span class="i-lucide-chevron-right text-outline-variant" />
        <a
          :href="crumb.href"
          class="h-8 px-3 leading-8 rounded-full no-underline hover:bg-on-surface/8 max-w-56 truncate"
          :class="index === crumbs.length - 1 ? 'text-on-surface font-medium' : 'text-on-surface-variant'"
          :aria-current="index === crumbs.length - 1 ? 'page' : undefined"
        >{{ crumb.name }}</a>
      </template>
      <span class="flex-1" />
      <span v-if="size" class="text-xs text-outline">{{ size.files }} files · {{ formatBytes(size.bytes) }}</span>
      <button v-else class="btn-text h-8 text-xs" :disabled="sizing" @click="measure">{{ sizing ? 'Measuring…' : 'Folder size' }}</button>
    </nav>

    <p v-if="managed" class="card flex gap-3 p-4 m-0 mb-4 text-sm text-on-surface-variant leading-relaxed">
      <span class="i-lucide-triangle-alert shrink-0 mt-0.5 text-error" />
      <span>The emulator keeps its games, firmware and saves here, with file lists that must match the files. Removing a game, its
        saves or the firmware is safest from the Library and Settings; renaming or removing single files here can stop a game from starting.</span>
    </p>

    <!-- The folder -->
    <div
      class="card overflow-visible transition-colors duration-150"
      :class="dragging ? 'bg-primary-container' : ''"
      @dragover.prevent="dragging = !upload.active"
      @dragleave.self="dragging = false"
      @drop.prevent="!upload.active && onDrop($event)"
    >
      <p v-if="!opfs.supported()" class="m-0 p-6 text-on-surface-variant">This browser keeps no private storage for this site.</p>
      <div v-else-if="loading" class="p-6 text-sm text-on-surface-variant">Loading…</div>
      <div v-else-if="error" class="flex flex-col items-center gap-3 p-10 text-center">
        <span class="i-lucide-folder-x text-4xl text-outline" />
        <div class="text-on-surface-variant">{{ error }}</div>
        <a class="btn-tonal no-underline" :href="filesHref([])">Back to Storage</a>
      </div>
      <div v-else-if="!entries.length" class="flex flex-col items-center gap-2 p-10 text-center">
        <span class="i-lucide-folder-open text-4xl text-outline" />
        <div class="text-on-surface-variant">This folder is empty</div>
        <div class="text-xs text-outline">Drop files or folders here to upload them.</div>
      </div>
      <ul v-else class="list-none m-0 p-2">
        <li v-for="entry in entries" :key="entry.name" class="relative flex items-center gap-1 rounded-2xl hover:bg-on-surface/4">
          <component
            :is="entry.kind === 'directory' ? 'a' : 'div'"
            :href="entry.kind === 'directory' ? filesHref([...path, entry.name]) : undefined"
            class="flex flex-1 min-w-0 items-center gap-4 px-3 py-2.5 no-underline text-inherit rounded-2xl"
          >
            <span
              class="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
              :class="entry.kind === 'directory' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-highest text-on-surface-variant'"
            >
              <span :class="iconFor(entry)" class="text-lg" />
            </span>
            <span class="flex-1 min-w-0">
              <span class="block truncate">{{ entry.name }}</span>
              <span class="block text-xs text-outline truncate">
                <template v-if="entry.kind === 'directory'">{{ (!path.length && known[entry.name]?.label) || (path.length === 1 && known[entry.name]?.label) || 'Folder' }}</template>
                <template v-else>{{ formatBytes(entry.size) }} · {{ dateText(entry.modified) }}</template>
              </span>
            </span>
          </component>
          <div :ref="(el) => { if (menuFor === entry.name) menuRoot = el as HTMLElement }" class="relative shrink-0 pr-1">
            <button class="icon-btn" :aria-label="`Actions for ${entry.name}`" :aria-expanded="menuFor === entry.name" @click="menuFor = menuFor === entry.name ? null : entry.name">
              <span class="i-lucide-ellipsis-vertical" />
            </button>
            <div v-if="menuFor === entry.name" class="absolute right-1 top-11 z-10 min-w-48 py-2 rounded-2xl bg-surface-highest" role="menu">
              <button v-if="entry.kind === 'file'" class="menu-item" role="menuitem" @click="download(entry)"><span class="i-lucide-download" />Download</button>
              <button class="menu-item" role="menuitem" @click="openRename(entry)"><span class="i-lucide-pencil" />Rename…</button>
              <button class="menu-item text-error" role="menuitem" @click="askRemove(entry)"><span class="i-lucide-trash-2" />Remove…</button>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>

  <!-- Upload progress -->
  <div v-if="upload.active" class="fixed z-40 left-4 right-4 sm:left-auto sm:right-8 bottom-[max(16px,env(safe-area-inset-bottom))] sm:w-96 card bg-surface-high p-4" role="status">
    <div class="flex items-center gap-3 mb-3">
      <span class="i-lucide-loader-circle animate-spin text-primary" />
      <div class="flex-1 min-w-0 text-sm">
        <div class="truncate">{{ upload.file }}</div>
        <div class="text-xs text-outline">File {{ upload.index }} of {{ upload.count }} · {{ formatBytes(upload.done + upload.bytes) }} of {{ formatBytes(upload.total) }}</div>
      </div>
    </div>
    <ProgressBar :value="upload.total ? (upload.done + upload.bytes) / upload.total : undefined" label="Upload progress" />
  </div>

  <BaseDialog :open="naming.open" :title="naming.mode === 'create' ? 'New folder' : `Rename ${naming.from}`" @close="naming.open = false">
    <form @submit.prevent="submitName">
      <input v-model="naming.name" class="field" :placeholder="naming.mode === 'create' ? 'Folder name' : 'New name'" autofocus spellcheck="false" aria-label="Name">
      <p v-if="naming.error" class="mt-3 mb-0 text-sm text-error">{{ naming.error }}</p>
      <div class="flex justify-end gap-2 mt-6">
        <button type="button" class="btn-text" @click="naming.open = false">Cancel</button>
        <button type="submit" class="btn-filled" :disabled="!naming.name.trim()">{{ naming.mode === 'create' ? 'Create' : 'Rename' }}</button>
      </div>
    </form>
  </BaseDialog>

  <BaseDialog :open="removing !== null" :title="`Remove ${removing?.name ?? ''}?`" @close="removing = null">
    <p class="m-0 text-on-surface-variant leading-relaxed">
      <template v-if="removing?.kind === 'directory'">
        This folder and everything in it{{ removing.contents ? ` (${removing.contents.files} files, ${formatBytes(removing.contents.bytes)})` : '' }} leave this browser.
      </template>
      <template v-else>This file ({{ formatBytes(removing?.size ?? 0) }}) leaves this browser.</template>
      This cannot be undone.
    </p>
    <template #actions>
      <button class="btn-text" @click="removing = null">Cancel</button>
      <button class="btn-danger" @click="confirmRemove">Remove</button>
    </template>
  </BaseDialog>

  <Transition name="fade">
    <div
      v-if="message"
      class="fixed z-40 left-1/2 -translate-x-1/2 bottom-6 max-w-[calc(100%-32px)] flex items-center gap-3 pl-5 pr-2 py-2 rounded-xl bg-inverse-surface text-inverse-on-surface text-sm"
      :class="upload.active ? 'hidden' : ''"
      role="status"
    >
      <span class="flex-1">{{ message }}</span>
      <button class="icon-btn w-8 h-8 text-inverse-on-surface" aria-label="Dismiss" @click="message = ''"><span class="i-lucide-x" /></button>
    </div>
  </Transition>
</template>

<style scoped>
.menu-item {
  display: flex; align-items: center; gap: 12px; width: 100%; height: 44px; padding: 0 16px;
  border: 0; background: transparent; text-align: left; font-size: 14px; cursor: pointer;
}
.menu-item:hover { background: rgb(var(--color-on-surface) / 0.08); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.18s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>

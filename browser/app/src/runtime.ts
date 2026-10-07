// The emulator runtime lives in the site next to index.html (library.js,
// vita_session.js, pad_input.js, capabilities.js and the worker and wasm they
// load): it is shared with the player page (player.html) and loaded at run
// time, not bundled. These are the parts of it the app uses.

export interface Target {
  title: string;
  app: string;
  fromServer: boolean;
  stagedTitles: string[];
  isStatic: boolean;
}
export interface LaunchState { phase: string; detail: string; fraction?: number }
export interface SessionStats {
  frames: number; fps: number; running: boolean; elapsed: number; firstFrame: number;
}
export interface GuestDialog {
  id: number; state: 'open' | 'update' | 'close'; message: string; buttons: string[];
  progress: number | null; enterButton: 'cross' | 'circle';
}
export interface GuestIme { id: number; state: 'open' | 'close'; text: string; maxLength: number; caret: number; enterLabel?: string }
export interface PadState {
  set(id: string, state: { buttons?: number; axes?: number[] }): void;
  release(id: string): void;
  clear(): void;
}
export interface Session {
  on(type: 'status' | 'notice' | 'log', handler: (text: string) => void): () => void;
  on(type: 'launch', handler: (state: LaunchState | null) => void): () => void;
  on(type: 'frame', handler: (stats: SessionStats) => void): () => void;
  on(type: 'dialog', handler: (dialog: GuestDialog) => void): () => void;
  on(type: 'ime', handler: (ime: GuestIme) => void): () => void;
  on(type: 'first-frame' | 'running' | 'stopped' | 'exit' | 'saved', handler: (data: unknown) => void): () => void;
  start(target: Target): Promise<void>;
  stop(reason?: string | null): void;
  dispose(): void;
  stats(): SessionStats;
  pad: PadState;
  /** A front touchscreen finger: phase 0 down, 1 move, 2 up; x, y in [0, 1] over the picture. */
  touch(finger: number, phase: 0 | 1 | 2, x: number, y: number): void;
  ensureAudio(): void;
  setMuted(muted: boolean): void;
  readonly running: boolean;
  readonly active: boolean;
  readonly muted: boolean;
  pressDialog(id: number, button: number, selected: number): void;
  sendIme(id: number, kind: 0 | 1 | 2, text: string, caret: number): void;
}
export interface SessionModule {
  resolveTarget(options: { title?: string; app?: string; source?: string | null }): Promise<Target>;
  createSession(options: { settings: Record<string, unknown>; canvas: () => HTMLCanvasElement }): Session;
  webgpuProblem(): string | null;
  webgpuAdapterProblem(): Promise<string | null>;
}

export interface PackageEntry { title: string; app: string; files: number; bytes: number }
export interface TitleInfo { title: string; name: string; version: string; icon: Blob | null }
export interface FirmwareStatus { files: number; bytes: number; system: boolean; fonts: boolean }
export interface ImportProgress { phase: 'load' | 'prepare' | 'inflate' | 'unpack' | 'decrypt' | 'install' | 'store'; path: string; bytes: number; total: number }
export interface ImportResult {
  kind: 'game' | 'firmware'; title?: string; app?: string; files: number; bytes: number;
  version?: string; roots?: string[]; decrypted?: boolean;
}
export interface LibraryModule {
  storageSupported(): boolean;
  listPackages(): Promise<PackageEntry[]>;
  titleInfo(title: string, app?: string): Promise<TitleInfo>;
  removeTitle(title: string, app?: string, options?: { withSaves?: boolean }): Promise<void>;
  firmwareStatus(): Promise<FirmwareStatus>;
  removeFirmware(): Promise<void>;
  fileKind(name: string): 'pup' | 'pkg' | 'zip' | null;
  importFile(file: File, options: { expect?: 'game' | 'firmware'; zrif?: (name: string) => Promise<string> | string;
    onProgress?: (progress: ImportProgress) => void }): Promise<ImportResult>;
  listSaves(title: string): Promise<{ path: string; bytes: Uint8Array }[]>;
  savesZip(title: string): Promise<Blob | null>;
  restoreSaves(title: string, file: File, options?: { confirmReplace?: (existing: number, incoming: number) => boolean | Promise<boolean> }): Promise<number>;
  removeSaves(title: string): Promise<void>;
  storageEstimate(): Promise<{ usage?: number; quota?: number } | null>;
}

export interface PadInputModule {
  SCE_CTRL: Record<string, number>;
  keyMap: Record<string, { buttons?: number; axes?: number[] }>;
  createTouchControls(root: HTMLElement, pad: PadState, options: { enabled: () => boolean; onGesture?: () => void }): { clear(): void };
  createGamepadInput(pad: PadState, options: { enabled: () => boolean; onPress?: (button: number) => void;
    onGesture?: () => void; onConnect?: (gamepad: Gamepad, connected: boolean) => void }): { connected(): boolean; clear(): void };
}
export interface CapabilitiesModule {
  detectBrowserCapabilities(): Record<string, boolean>;
}

const siteUrl = (name: string) => new URL(name, document.baseURI).href;
const load = <T>(name: string) => import(/* @vite-ignore */ siteUrl(name)) as Promise<T>;
let library: Promise<LibraryModule> | null = null;
let session: Promise<SessionModule> | null = null;
let pad: Promise<PadInputModule> | null = null;
export const loadLibrary = () => (library ??= load<LibraryModule>('library.js'));
export const loadSession = () => (session ??= load<SessionModule>('vita_session.js'));
export const loadPadInput = () => (pad ??= load<PadInputModule>('pad_input.js'));
export const loadCapabilities = () => load<CapabilitiesModule>('capabilities.js');

export const mib = (bytes: number) => (bytes / 1048576).toFixed(bytes >= 1048576 * 100 ? 0 : 1);
export function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1) + ' GB';
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(bytes >= 100 * 1024 ** 2 ? 0 : 1) + ' MB';
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
  return bytes + ' B';
}

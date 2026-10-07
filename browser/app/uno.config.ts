import { defineConfig, transformerVariantGroup } from 'unocss';
import presetWind3 from '@unocss/preset-wind3';
import presetIcons from '@unocss/preset-icons';
import { colorSchemes, palettes, type ColorScheme } from './src/palettes';

// RGB channels let utilities such as bg-surface/90 retain their opacity.
const channels = (hex: string) => [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
const mix = (base: string, overlay: string, amount: number) =>
  channels(base).map((channel, i) => Math.round(channel * (1 - amount) + channels(overlay)[i]! * amount));
const hoverRoles = ['primary-hover', 'secondary-container-hover', 'primary-container-hover', 'error-container-hover'];
const colors = Object.fromEntries([...Object.keys(palettes.blue), ...hoverRoles]
  .map((role) => [role, `rgb(var(--color-${role}))`]));
function paletteCSS(scheme: ColorScheme) {
  const palette = palettes[scheme];
  const hover = {
    'primary-hover': scheme === 'blue' ? channels('#C3E4FC') : mix(palette.primary, '#FFFFFF', 0.25),
    'secondary-container-hover': scheme === 'blue' ? channels('#40566A') : mix(palette['secondary-container'], palette['on-secondary-container'], 0.12),
    'primary-container-hover': scheme === 'blue' ? channels('#0D5A7E') : mix(palette['primary-container'], palette.primary, 0.12),
    'error-container-hover': channels('#A0241E'),
  };
  const variables = { ...Object.fromEntries(Object.entries(palette).map(([role, hex]) => [role, channels(hex)])), ...hover };
  const selector = `${scheme === 'blue' ? ':root, ' : ''}[data-color-scheme="${scheme}"]`;
  return `${selector} { ${Object.entries(variables).map(([role, rgb]) => `--color-${role}: ${rgb.join(' ')};`).join(' ')} }`;
}

export default defineConfig({
  // Defaults first; a selected scheme overrides :root. The same selectors
  // let each Settings swatch preview its own palette without inline colors.
  preflights: [{ getCSS: () => ['blue' as const, ...colorSchemes.filter((scheme) => scheme !== 'blue')].map(paletteCSS).join('\n') }],
  // Grouped variants in class attributes: disabled:(opacity-60 cursor-not-allowed).
  transformers: [transformerVariantGroup()],
  presets: [
    presetWind3(),
    presetIcons({ scale: 1.2, extraProperties: { 'display': 'inline-block', 'vertical-align': 'middle', 'flex-shrink': '0' } }),
  ],
  theme: {
    colors,
    borderRadius: { card: '20px', dialog: '28px' },
    fontFamily: { sans: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', mono: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  },
  shortcuts: {
    'btn': 'inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full border-0 font-medium text-sm cursor-pointer select-none transition-colors duration-150 disabled:(opacity-60 cursor-not-allowed)',
    'btn-filled': 'btn bg-primary text-on-primary hover:bg-primary-hover',
    'btn-tonal': 'btn bg-secondary-container text-on-secondary-container hover:bg-secondary-container-hover',
    'btn-text': 'btn bg-transparent text-primary hover:bg-primary/8 px-3',
    'btn-danger': 'btn bg-error-container text-on-error-container hover:bg-error-container-hover',
    'icon-btn': 'inline-flex items-center justify-center w-10 h-10 rounded-full border-0 bg-transparent text-on-surface-variant cursor-pointer hover:bg-on-surface/8 transition-colors duration-150 disabled:(opacity-60 cursor-not-allowed)',
    'card': 'bg-surface-container rounded-card',
    'field': 'h-12 w-full rounded-full border-0 bg-surface-high text-on-surface px-5 text-sm outline-none focus:(ring-2 ring-primary) placeholder:text-outline-variant',
    'chip': 'inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-xs font-medium',
    'overlay-panel': 'absolute z-4 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(480px,calc(100%-32px))] max-h-[calc(100%-32px)] overflow-auto p-6 rounded-dialog bg-surface-high text-on-surface',
    'label-text': 'text-xs font-medium tracking-wide text-on-surface-variant',
  },
});

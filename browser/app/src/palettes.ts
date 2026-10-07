// Shared by UnoCSS (CSS variables) and the app (scheme choices and browser chrome).
const errors = {
  error: '#F2B8B5', 'on-error': '#601410',
  'error-container': '#8C1D18', 'on-error-container': '#F9DEDC',
};

export const palettes = {
  red: {
    primary: '#FEC7C0', 'on-primary': '#66060F', 'primary-container': '#90091A', 'on-primary-container': '#FFEDEA',
    secondary: '#FCC8C2', 'secondary-container': '#643C37', 'on-secondary-container': '#FEEDEB',
    'tertiary-container': '#534616', 'on-tertiary-container': '#FEF0CE',
    surface: '#181211', 'surface-low': '#201A19', 'surface-container': '#241E1D', 'surface-high': '#2F2928', 'surface-highest': '#3A3332',
    'on-surface': '#E9E1DF', 'on-surface-variant': '#E3D0CE', outline: '#B9A7A5', 'outline-variant': '#847371',
    'inverse-surface': '#E9E1DF', 'inverse-on-surface': '#352F2E', 'inverse-primary': '#AF2E2F',
    ...errors,
  },
  orange: {
    primary: '#FFCA9F', 'on-primary': '#4A2800', 'primary-container': '#6A3B07', 'on-primary-container': '#FEEEE1',
    secondary: '#F1CEB2', 'secondary-container': '#5B412B', 'on-secondary-container': '#FFEEE0',
    'tertiary-container': '#374D1F', 'on-tertiary-container': '#E0F9C1',
    surface: '#17120F', 'surface-low': '#1F1B18', 'surface-container': '#231F1C', 'surface-high': '#2D2926', 'surface-highest': '#383431',
    'on-surface': '#E7E1DD', 'on-surface-variant': '#DFD2C8', outline: '#B5A9A0', 'outline-variant': '#80756C',
    'inverse-surface': '#E7E1DD', 'inverse-on-surface': '#34302C', 'inverse-primary': '#8D4F03',
    ...errors,
  },
  yellow: {
    primary: '#FBCF5F', 'on-primary': '#3D2E02', 'primary-container': '#584408', 'on-primary-container': '#FEEFD4',
    secondary: '#E5D2AF', 'secondary-container': '#534527', 'on-secondary-container': '#FFEFD3',
    'tertiary-container': '#21502C', 'on-tertiary-container': '#C9FED0',
    surface: '#16130E', 'surface-low': '#1D1B17', 'surface-container': '#211F1B', 'surface-high': '#2C2A26', 'surface-highest': '#373430',
    'on-surface': '#E5E2DD', 'on-surface-variant': '#DBD4C7', outline: '#B1AA9E', 'outline-variant': '#7D766B',
    'inverse-surface': '#E5E2DD', 'inverse-on-surface': '#32302C', 'inverse-primary': '#755B05',
    ...errors,
  },
  green: {
    primary: '#73EC99', 'on-primary': '#06381B', 'primary-container': '#0B5229', 'on-primary-container': '#C3FFD1',
    secondary: '#B9DDC1', 'secondary-container': '#2E4E37', 'on-secondary-container': '#D5FADD',
    'tertiary-container': '#024F56', 'on-tertiary-container': '#CAF9FF',
    surface: '#101411', 'surface-low': '#191C19', 'surface-container': '#1D211D', 'surface-high': '#272B28', 'surface-highest': '#323632',
    'on-surface': '#DEE4DF', 'on-surface-variant': '#CBD8CD', outline: '#A2AEA5', 'outline-variant': '#6F7A71',
    'inverse-surface': '#DEE4DF', 'inverse-on-surface': '#2D312E', 'inverse-primary': '#026D36',
    ...errors,
  },
  blue: {
    primary: '#AFDAFB', 'on-primary': '#05344B', 'primary-container': '#094C6B', 'on-primary-container': '#E5F3FF',
    secondary: '#C2D7EA', 'secondary-container': '#354958', 'on-secondary-container': '#E4F3FF',
    'tertiary-container': '#50415B', 'on-tertiary-container': '#F8EDFE',
    surface: '#0F1417', 'surface-low': '#181C1F', 'surface-container': '#1C2023', 'surface-high': '#262A2E', 'surface-highest': '#313539',
    'on-surface': '#DEE3E8', 'on-surface-variant': '#CAD6E1', outline: '#A1ADB7', 'outline-variant': '#6D7882',
    'inverse-surface': '#DEE3E8', 'inverse-on-surface': '#2D3134', 'inverse-primary': '#1E6489',
    ...errors,
  },
  purple: {
    primary: '#DECCFE', 'on-primary': '#32226F', 'primary-container': '#4C3889', 'on-primary-container': '#F4EEFE',
    secondary: '#DBCFEF', 'secondary-container': '#4B425D', 'on-secondary-container': '#F4EEFF',
    'tertiary-container': '#6C3644', 'on-tertiary-container': '#FFECF0',
    surface: '#141317', 'surface-low': '#1C1B1F', 'surface-container': '#201F23', 'surface-high': '#2B292D', 'surface-highest': '#363438',
    'on-surface': '#E4E1E7', 'on-surface-variant': '#D7D2DF', outline: '#AEA9B5', 'outline-variant': '#797581',
    'inverse-surface': '#E4E1E7', 'inverse-on-surface': '#313034', 'inverse-primary': '#6750A4',
    ...errors,
  },
  pink: {
    primary: '#FCC6D6', 'on-primary': '#620833', 'primary-container': '#7D2649', 'on-primary-container': '#FEECF1',
    secondary: '#EECCD5', 'secondary-container': '#5B3F48', 'on-secondary-container': '#FFECF1',
    'tertiary-container': '#5E402C', 'on-tertiary-container': '#FFEDE3',
    surface: '#181213', 'surface-low': '#201A1C', 'surface-container': '#241E20', 'surface-high': '#2E282A', 'surface-highest': '#393335',
    'on-surface': '#E8E1E3', 'on-surface-variant': '#E2D0D5', outline: '#B8A7AC', 'outline-variant': '#837377',
    'inverse-surface': '#E8E1E3', 'inverse-on-surface': '#352F30', 'inverse-primary': '#984061',
    ...errors,
  },
};

export type ColorScheme = keyof typeof palettes;
export const colorSchemes = Object.keys(palettes) as ColorScheme[];
export function isColorScheme(value: unknown): value is ColorScheme {
  return typeof value === 'string' && Object.hasOwn(palettes, value);
}

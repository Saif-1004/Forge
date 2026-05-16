export const palette = {
  black: '#111111',
  white: '#FFFFFF',
  surface: { light: '#F7F7F7', dark: '#1A1A1A' },
  border: { light: '#E5E5E5', dark: '#2A2A2A' },
  muted: { light: '#6B6B6B', dark: '#888888' },
  danger: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
} as const;

export const light = {
  background: palette.white,
  surface: palette.surface.light,
  border: palette.border.light,
  text: palette.black,
  textMuted: palette.muted.light,
  accent: palette.black,
  accentForeground: palette.white,
  danger: palette.danger,
  error: palette.danger,
  success: palette.success,
  warning: palette.warning,
} as const;

export const dark = {
  background: palette.black,
  surface: palette.surface.dark,
  border: palette.border.dark,
  text: '#F5F5F5',
  textMuted: palette.muted.dark,
  accent: palette.white,
  accentForeground: palette.black,
  danger: palette.danger,
  error: palette.danger,
  success: palette.success,
  warning: palette.warning,
} as const;

export type ColorScheme = typeof light;

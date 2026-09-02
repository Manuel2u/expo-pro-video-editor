/**
 * Palette pulled directly from Figma's resolved variable values for the
 * "New Clip" flow (media picker / editor / post screens). The example app has
 * no design-token system of its own, so these are named constants rather
 * than scattered hex literals — not a general-purpose theme.
 */
export const colors = {
  mainColor: '#fe7395',
  stroke: '#e0e2e6',
  inputField: '#fafafa',
  textPrimary: '#000000',
  textSecondary: '#9e9b9b',
  bgColor: '#f2f1f1',
  bgTertiary: '#ffffff',
  bgSecondary: '#ffffff',
  neutral400: '#9ca3af',
  white: '#ffffff',
} as const;

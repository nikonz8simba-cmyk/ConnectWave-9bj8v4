// ConnectWave Design Tokens
export const Colors = {
  // Base
  background: '#0F0F1A',
  surface: '#1A1A2E',
  surfaceElevated: '#232340',
  surfaceBorder: '#2E2E4A',

  // Brand
  primary: '#7C5CFC',
  primaryLight: '#9B7FFE',
  primaryDark: '#5B3FD4',
  secondary: '#FF6B8A',
  secondaryLight: '#FF8FA6',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0C0',
  textMuted: '#606080',
  textOnPrimary: '#FFFFFF',

  // Semantic
  success: '#4ADE80',
  error: '#FF5252',
  warning: '#FFB800',
  info: '#38BDF8',

  // Gradient stops
  gradientStart: '#7C5CFC',
  gradientEnd: '#FF6B8A',

  // Tab bar
  tabActive: '#7C5CFC',
  tabInactive: '#4A4A6A',
  tabBackground: '#13131F',
  tabBorder: '#1E1E33',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 16,
  md: 18,
  lg: 20,
  xl: 24,
  xxl: 28,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const Shadows = {
  card: {
    shadowColor: '#7C5CFC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  tab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 20,
  },
};

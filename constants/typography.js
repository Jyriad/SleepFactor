// Typography constants
import { FONT_FAMILY } from './fonts';

const font = { fontFamily: FONT_FAMILY };

/**
 * Default text baseline. Overused Grotesk VF’s axis default is wght 300 (Light); if only fontFamily
 * is set, RN often renders that Light master — buttons looked thinner than body copy. Always pair
 * the family with Regular (400) unless a style sets another weight.
 */
export const appFont = { ...font, fontWeight: '400' };

export const typography = {
  // Font sizes
  sizes: {
    xl: 28, // Screen titles
    large: 24,
    medium: 20, // Card titles
    regular: 18,
    body: 16, // Body text
    small: 14, // Subtitles, labels
    xs: 12, // Helper text
  },
  
  // Font weights
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  
  // Line heights
  lineHeights: {
    xl: 36,
    large: 32,
    medium: 28,
    regular: 24,
    body: 22,
    small: 20,
    xs: 16,
  },
  
  // Text styles
  h1: {
    ...font,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
  },
  h2: {
    ...font,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
  },
  body: {
    ...font,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  },
  small: {
    ...font,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  xs: {
    ...font,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
};


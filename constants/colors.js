// Brand palette (Blue Zodiac, Cotton Blue, White Gray, Bay Of Many, Livid, Birthday Blue)

export const colors = {
  // Primary — Cotton Blue: buttons, links, selected controls, chart emphasis
  primary: '#2469B2',
  // Navy chrome — Blue Zodiac: status bar, date headers, screen top bars
  primaryDark: '#11294B',
  // Mid blue — Bay Of Many: secondary emphasis, alternate chart tone
  secondary: '#243D80',
  // Medium orange — habit line on timeline charts (distinct from sleep metric blues)
  habitTimeline: '#E8883A',
  // Lighter blue — Livid: highlights, primaryLight usage
  primaryLight: '#6698CF',

  // Background — White Gray
  background: '#F3F4F5',

  // Text (readable on light gray / white)
  textPrimary: '#11294B',
  textSecondary: '#5C6B7A',
  textLight: '#8B96A3',

  // Status (unchanged semantics for clarity)
  warning: '#F59E0B',
  success: '#10B981',
  error: '#EF4444',

  // UI — borders tinted toward Birthday Blue
  border: '#D4E4F2',
  cardBackground: '#FFFFFF',
  white: '#FFFFFF',

  // Soft fills — Birthday Blue / Livid (timeline track, skeleton)
  accent: '#B0CDEB',

  // Navigation
  tabActive: '#2469B2',
  tabInactive: '#6B7280',

  // Sleep stages: blues + lilac REM (distinct from light/deep blue) + amber awake
  sleepStages: {
    deep: '#11294B',
    light: '#6698CF',
    rem: '#A78BFA',
    awake: '#F59E0B',
  },
};

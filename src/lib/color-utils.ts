/**
 * Pre-compute common hex+opacity strings for philosopher brand colors.
 * Tailwind can't handle dynamic color values, so we use inline styles
 * with these helpers to keep the interpolation DRY.
 */
export function philosopherAccentStyles(color: string) {
  return {
    bgSubtle: `${color}08`,
    bgLight: `${color}10`,
    bgMedium: `${color}1a`,
    borderSubtle: `${color}18`,
    borderLight: `${color}24`,
    borderMedium: `${color}35`,
    textMuted: `${color}cc`,
    textSubtle: `${color}99`,
  };
}

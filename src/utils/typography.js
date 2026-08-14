export const MON_SAFE_FONT_STACK = "'Noto Sans Myanmar', 'Myanmar Text', 'Padauk', 'Tharlon', 'Pyidaungsu', sans-serif";

const MYANMAR_PATTERN = /[\u1000-\u109f\ua9e0-\ua9ff\uaa60-\uaa7f]/u;
const MON_SPECIFIC_PATTERN = /[\u1028\u1033\u1034\u105a-\u1060]/u;

export function containsMyanmarText(value) {
  return typeof value === 'string' && MYANMAR_PATTERN.test(value);
}

export function containsMonText(value) {
  return typeof value === 'string' && MON_SPECIFIC_PATTERN.test(value);
}

export function getTypographyProps(value, preferredFontFamily, letterSpacing = 0) {
  const isMyanmar = containsMyanmarText(value);
  const isMon = containsMonText(value);

  return {
    lang: isMon ? 'mnw' : isMyanmar ? 'my' : undefined,
    style: {
      fontFamily: isMon ? MON_SAFE_FONT_STACK : preferredFontFamily,
      // Tracking can split or distort complex Myanmar clusters. Preserve it for
      // Latin text but keep Unicode Myanmar and Mon runs safely shaped.
      letterSpacing: `${isMyanmar ? 0 : letterSpacing}px`,
      fontKerning: 'normal',
      fontVariantLigatures: 'common-ligatures contextual',
      fontFeatureSettings: '"kern" 1, "liga" 1, "clig" 1, "ccmp" 1, "locl" 1, "mark" 1, "mkmk" 1',
      textRendering: 'optimizeLegibility',
    },
  };
}

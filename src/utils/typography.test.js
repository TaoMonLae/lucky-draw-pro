import { containsMonText, containsMyanmarText, getTypographyProps, MON_SAFE_FONT_STACK } from './typography';

describe('Myanmar typography helpers', () => {
  test('detects Burmese and dedicated Mon characters', () => {
    expect(containsMyanmarText('မင်္ဂလာပါ')).toBe(true);
    expect(containsMonText('မန်ၚ')).toBe(true);
    expect(containsMonText('မင်္ဂလာပါ')).toBe(false);
  });

  test('keeps the selected face for Burmese but disables unsafe tracking', () => {
    const props = getTypographyProps('မြန်မာစာ', "'Z20 Khit Haungg', sans-serif", 2);
    expect(props.lang).toBe('my');
    expect(props.style.fontFamily).toContain('Z20 Khit Haungg');
    expect(props.style.letterSpacing).toBe('0px');
  });

  test('uses a complete Unicode fallback for a Mon text run', () => {
    const props = getTypographyProps('မန်ၚ', "'Z20 Khit Haungg', sans-serif", 2);
    expect(props.lang).toBe('mnw');
    expect(props.style.fontFamily).toBe(MON_SAFE_FONT_STACK);
    expect(props.style.fontFeatureSettings).toContain('"mark" 1');
  });
});

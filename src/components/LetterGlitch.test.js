import { MON_CHARACTERS } from './LetterGlitch';

describe('LetterGlitch Mon character pool', () => {
  test('includes the dedicated Unicode Mon letters', () => {
    expect(MON_CHARACTERS).toEqual(expect.stringContaining('ၚ'));
    expect(MON_CHARACTERS).toEqual(expect.stringContaining('ၛ'));
    expect(MON_CHARACTERS).toEqual(expect.stringContaining('ၜ'));
    expect(MON_CHARACTERS).toEqual(expect.stringContaining('ၝ'));
  });

  test('does not include standalone combining marks', () => {
    expect(MON_CHARACTERS).not.toMatch(/\p{Mark}/u);
  });
});

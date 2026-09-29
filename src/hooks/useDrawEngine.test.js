import {
  GRAND_FINALE_DRAW_DURATION_MS,
  getLockedDigitCount,
  getNumericReelConfigs,
  getPaddedDigits,
  getSpinningDigit,
  getWinnerAnimationDurationMs,
  isGrandPrizeDraw,
} from './useDrawEngine';

describe('draw engine helpers', () => {
  test('pads numeric display values to the configured width', () => {
    expect(getPaddedDigits(7, 3)).toEqual(['0', '0', '7']);
  });

  test('only marks the final configured prize as the grand-prize draw', () => {
    expect(isGrandPrizeDraw(2, 3)).toBe(true);
    expect(isGrandPrizeDraw(1, 3)).toBe(false);
    expect(isGrandPrizeDraw(0, 0)).toBe(false);
  });

  test('keeps regular numeric reel timing unchanged', () => {
    expect(getNumericReelConfigs(3, false)).toEqual([
      { start: 0, duration: 1300 },
      { start: 550, duration: 1650 },
      { start: 1100, duration: 2000 },
    ]);
  });

  test('extends the grand-prize reels to a synchronized 15-second finish', () => {
    const reels = getNumericReelConfigs(6, true);
    const endTimes = reels.map((reel) => reel.start + reel.duration);

    expect(endTimes.at(-1)).toBe(GRAND_FINALE_DRAW_DURATION_MS);
    expect(endTimes[0]).toBeGreaterThanOrEqual(10000);
    expect(endTimes.every((end, index) => index === 0 || end > endTimes[index - 1])).toBe(true);
  });

  test('uses the full finale duration even for a single digit', () => {
    expect(getNumericReelConfigs(1, true)).toEqual([
      { start: 0, duration: GRAND_FINALE_DRAW_DURATION_MS },
    ]);
  });

  test('locks the grand-prize digits in order, then all at the final deadline', () => {
    const reels = getNumericReelConfigs(6, true);
    const penultimateEnd = reels[4].start + reels[4].duration;

    expect(getLockedDigitCount(reels, penultimateEnd)).toBe(5);
    expect(getLockedDigitCount(reels, GRAND_FINALE_DRAW_DURATION_MS - 1)).toBe(5);
    expect(getLockedDigitCount(reels, GRAND_FINALE_DRAW_DURATION_MS)).toBe(6);
  });

  test('never presents the winning digit as stationary before its reel locks', () => {
    const duration = getNumericReelConfigs(4, true)[3].duration;
    for (let elapsed = 0; elapsed < duration; elapsed += 100) {
      expect(getSpinningDigit('4', elapsed, duration, true)).not.toBe(4);
    }
    expect(getSpinningDigit('4', duration - 261, duration, true))
      .not.toBe(getSpinningDigit('4', duration - 1, duration, true));
    expect(getSpinningDigit('4', duration, duration, true)).toBe(4);
  });

  test('accounts for the final result hold when sizing the audio build', () => {
    expect(getWinnerAnimationDurationMs({ drawMode: 'numbers', digitCount: 6, isGrandFinal: true }))
      .toBe(GRAND_FINALE_DRAW_DURATION_MS + 700);
    expect(getWinnerAnimationDurationMs({ drawMode: 'names', digitCount: 6, isGrandFinal: true }))
      .toBe(GRAND_FINALE_DRAW_DURATION_MS);
  });
});

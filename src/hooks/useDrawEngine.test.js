import {
  GRAND_FINALE_DRAW_DURATION_MS,
  getNumericReelConfigs,
  getPaddedDigits,
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

  test('accounts for the final suspense hold when sizing the audio build', () => {
    expect(getWinnerAnimationDurationMs({ drawMode: 'numbers', digitCount: 6, isGrandFinal: true }))
      .toBe(GRAND_FINALE_DRAW_DURATION_MS + 700);
    expect(getWinnerAnimationDurationMs({ drawMode: 'names', digitCount: 6, isGrandFinal: true }))
      .toBe(GRAND_FINALE_DRAW_DURATION_MS);
  });
});

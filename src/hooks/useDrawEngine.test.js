import { getPaddedDigits, isGrandPrizeDraw } from './useDrawEngine';

describe('draw engine helpers', () => {
  test('pads numeric display values to the configured width', () => {
    expect(getPaddedDigits(7, 3)).toEqual(['0', '0', '7']);
  });

  test('only marks the final configured prize as the grand-prize draw', () => {
    expect(isGrandPrizeDraw(2, 3)).toBe(true);
    expect(isGrandPrizeDraw(1, 3)).toBe(false);
    expect(isGrandPrizeDraw(0, 0)).toBe(false);
  });
});

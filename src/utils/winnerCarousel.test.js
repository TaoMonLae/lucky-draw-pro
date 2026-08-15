import { buildWinnerSlides } from './winnerCarousel';

describe('winner carousel helpers', () => {
  test('flattens every prize group into ordered winner slides', () => {
    expect(buildWinnerSlides([
      { prize: 'Consolation', tickets: ['A', 'B'] },
      { prize: 'Grand Prize', tickets: ['C'] },
    ])).toEqual([
      expect.objectContaining({ prize: 'Consolation', winner: 'A', prizeIndex: 0, ticketIndex: 0 }),
      expect.objectContaining({ prize: 'Consolation', winner: 'B', prizeIndex: 0, ticketIndex: 1 }),
      expect.objectContaining({ prize: 'Grand Prize', winner: 'C', prizeIndex: 1, ticketIndex: 0 }),
    ]);
  });

  test('ignores malformed groups and supplies a safe prize label', () => {
    expect(buildWinnerSlides([null, { tickets: [42] }, { prize: 'Empty', tickets: null }]))
      .toEqual([expect.objectContaining({ prize: 'Prize 2', winner: '42' })]);
    expect(buildWinnerSlides(null)).toEqual([]);
  });
});

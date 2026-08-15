import { updatePrizeName } from './prizes';

test('updates a prize name without mutating existing prize objects', () => {
  const first = { id: 1, name: 'First' };
  const grand = { id: 2, name: 'Grand' };
  const prizes = [first, grand];
  const updated = updatePrizeName(prizes, 0, '1st Prize');

  expect(updated).not.toBe(prizes);
  expect(updated[0]).toEqual({ id: 1, name: '1st Prize' });
  expect(updated[0]).not.toBe(first);
  expect(updated[1]).toBe(grand);
  expect(first.name).toBe('First');
});

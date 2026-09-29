import React from 'react';
import { render } from '@testing-library/react';
import RollingDigits from './RollingDigits';

test('a locked digit stays fixed while the final digit keeps rolling', () => {
  const { container, rerender } = render(
    <RollingDigits digits={['4', '2']} lockedDigits="4" />
  );

  const firstReel = container.querySelectorAll('.draw-console__reel')[0];
  expect(firstReel.textContent).toBe('4');
  expect(firstReel.querySelector('.draw-console__wheel-number')).toBeNull();

  rerender(<RollingDigits digits={['8', '9']} lockedDigits="4" />);

  expect(container.querySelectorAll('.draw-console__reel')[0].textContent).toBe('4');
  expect(container.querySelectorAll('.draw-console__reel')[1].querySelectorAll('.draw-console__wheel-number')).toHaveLength(10);
});

test('each confirmed digit keeps its original value through later reel updates', () => {
  const { container, rerender } = render(
    <RollingDigits digits={['0', '7', '5', '3']} lockedDigits="075" />
  );

  rerender(<RollingDigits digits={['9', '9', '9', '4']} lockedDigits="075" />);
  const reels = container.querySelectorAll('.draw-console__reel');
  expect(Array.from(reels).slice(0, 3).map((reel) => reel.textContent)).toEqual(['0', '7', '5']);
  expect(reels[3].querySelectorAll('.draw-console__wheel-number')).toHaveLength(10);

  rerender(<RollingDigits digits={['9', '9', '9', '4']} lockedDigits="0754" />);
  expect(Array.from(container.querySelectorAll('.draw-console__reel')).map((reel) => reel.textContent)).toEqual(['0', '7', '5', '4']);
});

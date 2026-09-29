import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import WinnerCarousel from './WinnerCarousel';

const winnersHistory = [
  { prize: 'Third Prize', tickets: ['01842'] },
  { prize: 'Second Prize', tickets: ['29471'] },
  { prize: 'Grand Prize', tickets: ['72006'] },
];

test('host controls keep the displayed winner tied to the selected slide', () => {
  const onPrevious = jest.fn();
  const onNext = jest.fn();
  const onTogglePlayback = jest.fn();
  const onClose = jest.fn();
  const { container, rerender } = render(
    <WinnerCarousel winnersHistory={winnersHistory} activeIndex={0} playing onPrevious={onPrevious} onNext={onNext} onTogglePlayback={onTogglePlayback} onClose={onClose} />,
  );

  expect(container.querySelector('.winner-plate__winner').textContent).toBe('01842');
  fireEvent.click(screen.getByRole('button', { name: 'Next winner' }));
  expect(onNext).toHaveBeenCalledTimes(1);

  rerender(<WinnerCarousel winnersHistory={winnersHistory} activeIndex={2} playing={false} onPrevious={onPrevious} onNext={onNext} onTogglePlayback={onTogglePlayback} onClose={onClose} />);
  expect(container.querySelector('.winner-plate__winner').textContent).toBe('72006');
  expect(screen.getByRole('button', { name: 'Play carousel' })).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Play carousel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close celebration' }));
  expect(onTogglePlayback).toHaveBeenCalledTimes(1);
  expect(onClose).toHaveBeenCalledTimes(1);
});

import { renderHook } from '@testing-library/react';
import { useFinaleModeReset } from './useFinaleModeReset';

test('clears the finale when operation mode leaves Standard Draw', () => {
  const timerId = setTimeout(() => {}, 10000);
  const finaleTimeoutRef = { current: timerId };
  const setGrandFinalePhase = jest.fn();
  const setShowConfetti = jest.fn();
  const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

  const { rerender } = renderHook(
    ({ operationMode }) => useFinaleModeReset({
      operationMode,
      finaleTimeoutRef,
      setGrandFinalePhase,
      setShowConfetti,
    }),
    { initialProps: { operationMode: 'standard' } },
  );

  expect(setGrandFinalePhase).not.toHaveBeenCalled();
  rerender({ operationMode: 'team-divider' });
  expect(clearTimeoutSpy).toHaveBeenCalledWith(timerId);
  expect(finaleTimeoutRef.current).toBeNull();
  expect(setGrandFinalePhase).toHaveBeenCalledWith('idle');
  expect(setShowConfetti).toHaveBeenCalledWith(false);

  clearTimeoutSpy.mockRestore();
});

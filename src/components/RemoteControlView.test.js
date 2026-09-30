import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import RemoteControlView from './RemoteControlView';
import { usePublicSync } from '../hooks/usePublicSync';
import { roomRequest } from '../lib/roomApi';

jest.mock('../hooks/usePublicSync', () => ({ usePublicSync: jest.fn() }));
jest.mock('../lib/roomApi', () => ({
  isRoomServiceConfigured: true,
  roomRequest: jest.fn(),
}));

const credentials = {
  roomId: '123e4567-e89b-42d3-a456-426614174000',
  remoteKey: 'a'.repeat(64),
};

describe('RemoteControlView', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    Object.defineProperty(window, 'crypto', {
      configurable: true,
      value: { randomUUID: () => '223e4567-e89b-42d3-a456-426614174001' },
    });
    usePublicSync.mockReturnValue({
      revision: 1,
      syncStatus: 'live',
      errorMessage: '',
      drawState: {
        title: 'Test Draw',
        operationMode: 'standard',
        live: {
          drawing: false,
          currentPrize: '1st Prize',
          remoteControlReady: true,
          remainingEntriesCount: 10,
          completedPrizeCount: 0,
          prizeCount: 2,
        },
      },
    });
    roomRequest.mockResolvedValue({ accepted: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('clears the host-response timeout when the remote unmounts', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const { unmount } = render(<RemoteControlView credentials={credentials} />);
    fireEvent.click(screen.getByRole('button', { name: 'Arm next draw' }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start draw' }));
      await Promise.resolve();
    });

    const responseTimerIndex = setTimeoutSpy.mock.calls.findIndex(([, delay]) => delay === 13000);
    expect(responseTimerIndex).toBeGreaterThanOrEqual(0);
    const responseTimerId = setTimeoutSpy.mock.results[responseTimerIndex].value;
    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(responseTimerId);

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  test('shows a structured host rejection without starting a response timeout', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    roomRequest.mockResolvedValueOnce({ accepted: false, message: 'The host is not ready' });
    render(<RemoteControlView credentials={credentials} />);
    fireEvent.click(screen.getByRole('button', { name: 'Arm next draw' }));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start draw' }));
      await Promise.resolve();
    });

    expect(screen.getByText('The host is not ready')).toBeTruthy();
    expect(setTimeoutSpy.mock.calls.some(([, delay]) => delay === 13000)).toBe(false);
    setTimeoutSpy.mockRestore();
  });

  test('requires an explicit second action before requesting a draw', async () => {
    render(<RemoteControlView credentials={credentials} />);

    fireEvent.click(screen.getByRole('button', { name: 'Arm next draw' }));
    expect(roomRequest).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start draw' })).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start draw' }));
      await Promise.resolve();
    });
    expect(roomRequest).toHaveBeenCalledTimes(1);
  });

  test('cancel and arm expiry prevent an accidental request', () => {
    render(<RemoteControlView credentials={credentials} />);

    fireEvent.click(screen.getByRole('button', { name: 'Arm next draw' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Arm next draw' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Arm next draw' }));
    act(() => { jest.advanceTimersByTime(10000); });
    expect(screen.getByRole('button', { name: 'Arm next draw' })).toBeTruthy();
    expect(roomRequest).not.toHaveBeenCalled();
  });

  test('disarms when the host changes the next prize', () => {
    const { rerender } = render(<RemoteControlView credentials={credentials} />);
    fireEvent.click(screen.getByRole('button', { name: 'Arm next draw' }));

    usePublicSync.mockReturnValue({
      revision: 1,
      syncStatus: 'live',
      errorMessage: '',
      drawState: {
        title: 'Test Draw',
        operationMode: 'standard',
        live: {
          drawing: false,
          currentPrize: 'Grand Prize',
          remoteControlReady: true,
          remainingEntriesCount: 10,
          completedPrizeCount: 1,
          prizeCount: 2,
        },
      },
    });
    rerender(<RemoteControlView credentials={credentials} />);

    expect(screen.getByRole('button', { name: 'Arm next draw' })).toBeTruthy();
    expect(roomRequest).not.toHaveBeenCalled();
  });
});

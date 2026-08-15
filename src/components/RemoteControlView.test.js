import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import RemoteControlView from './RemoteControlView';
import { usePublicSync } from '../hooks/usePublicSync';
import { supabase } from '../lib/supabaseClient';

jest.mock('../hooks/usePublicSync', () => ({ usePublicSync: jest.fn() }));
jest.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: jest.fn() },
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
    supabase.rpc.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('clears the host-response timeout when the remote unmounts', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const { unmount } = render(<RemoteControlView credentials={credentials} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Request next draw' }));
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
    supabase.rpc.mockResolvedValueOnce({
      data: { accepted: false, message: 'The host is not ready' },
      error: null,
    });
    render(<RemoteControlView credentials={credentials} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Request next draw' }));
      await Promise.resolve();
    });

    expect(screen.getByText('The host is not ready')).toBeTruthy();
    expect(setTimeoutSpy.mock.calls.some(([, delay]) => delay === 13000)).toBe(false);
    setTimeoutSpy.mockRestore();
  });
});

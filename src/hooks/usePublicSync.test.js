import { act, renderHook, waitFor } from '@testing-library/react';
import { usePublicSync } from './usePublicSync';
import { toPublicDrawState } from '../utils/realtimeRoom';

const mockFrom = jest.fn();
const mockRemoveChannel = jest.fn();
const mockChannelFactory = jest.fn();

jest.mock('../lib/supabaseClient', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (...args) => mockFrom(...args),
    channel: (...args) => mockChannelFactory(...args),
    removeChannel: (...args) => mockRemoveChannel(...args),
  },
}));

test('fetches the latest room state once after realtime subscribes', async () => {
  const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  mockFrom.mockReturnValue({ select });

  let subscriptionCallback;
  const channel = {
    on: jest.fn(() => channel),
    subscribe: jest.fn((callback) => {
      subscriptionCallback = callback;
      return channel;
    }),
  };
  mockChannelFactory.mockReturnValue(channel);

  const { unmount } = renderHook(() => usePublicSync({
    roomId: '123e4567-e89b-42d3-a456-426614174000',
  }));

  expect(mockFrom).not.toHaveBeenCalled();
  act(() => subscriptionCallback('SUBSCRIBED'));
  await waitFor(() => expect(mockFrom).toHaveBeenCalledTimes(1));
  expect(maybeSingle).toHaveBeenCalledTimes(1);

  unmount();
  expect(mockRemoveChannel).toHaveBeenCalledWith(channel);
});

test('keeps newer realtime data when an older initial fetch finishes later', async () => {
  let finishFetch;
  const maybeSingle = jest.fn(() => new Promise((resolve) => { finishFetch = resolve; }));
  mockFrom.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle }) }) });

  let subscriptionCallback;
  let updateCallback;
  const channel = {
    on: jest.fn((_, filter, callback) => {
      if (filter.event === '*') updateCallback = callback;
      return channel;
    }),
    subscribe: jest.fn((callback) => {
      subscriptionCallback = callback;
      return channel;
    }),
  };
  mockChannelFactory.mockReturnValue(channel);

  const { result } = renderHook(() => usePublicSync({ roomId: '123e4567-e89b-42d3-a456-426614174000' }));
  const older = { ...toPublicDrawState({}), updatedAt: '2026-09-28T10:00:00.000Z' };
  const newer = { ...toPublicDrawState({}), title: 'Latest result', updatedAt: '2026-09-28T10:00:01.000Z' };

  act(() => subscriptionCallback('SUBSCRIBED'));
  await waitFor(() => expect(maybeSingle).toHaveBeenCalledTimes(1));
  act(() => updateCallback({ new: { state: newer } }));
  await waitFor(() => expect(result.current.drawState?.title).toBe('Latest result'));
  await act(async () => finishFetch({ data: { state: older }, error: null }));

  expect(result.current.drawState).toEqual(newer);
});

test('does not revive a closed room from an in-flight fetch', async () => {
  let finishFetch;
  const maybeSingle = jest.fn(() => new Promise((resolve) => { finishFetch = resolve; }));
  mockFrom.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle }) }) });

  let subscriptionCallback;
  let deleteCallback;
  const channel = {
    on: jest.fn((_, filter, callback) => {
      if (filter.event === 'DELETE') deleteCallback = callback;
      return channel;
    }),
    subscribe: jest.fn((callback) => {
      subscriptionCallback = callback;
      return channel;
    }),
  };
  mockChannelFactory.mockReturnValue(channel);

  const roomId = '123e4567-e89b-42d3-a456-426614174000';
  const { result } = renderHook(() => usePublicSync({ roomId }));
  act(() => subscriptionCallback('SUBSCRIBED'));
  await waitFor(() => expect(maybeSingle).toHaveBeenCalledTimes(1));
  act(() => deleteCallback({ old: { room_id: roomId } }));
  await act(async () => finishFetch({ data: { state: toPublicDrawState({}) }, error: null }));

  expect(result.current.syncStatus).toBe('closed');
  expect(result.current.drawState).toBeNull();
});

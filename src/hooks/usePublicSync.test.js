import { act, renderHook, waitFor } from '@testing-library/react';
import { usePublicSync } from './usePublicSync';

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

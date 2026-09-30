import { act, renderHook } from '@testing-library/react';
import { usePublicSync } from './usePublicSync';
import { toPublicDrawState } from '../utils/realtimeRoom';

jest.mock('../lib/roomApi', () => ({
  isRoomServiceConfigured: true,
  roomSocketUrl: (id) => `wss://rooms.test/rooms/${id}/socket`,
  roomRequest: () => Promise.resolve({}),
}));

const roomId = '123e4567-e89b-42d3-a456-426614174000';
let sockets;
class FakeSocket {
  static OPEN = 1;
  constructor() { this.readyState = 0; sockets.push(this); }
  open() { this.readyState = 1; this.onopen?.(); }
  send() {}
  message(value) { this.onmessage?.({ data: JSON.stringify(value) }); }
  close() { this.readyState = 3; this.onclose?.(); }
}

beforeEach(() => { sockets = []; global.WebSocket = FakeSocket; });

test('loads the current public snapshot and shows host presence', () => {
  const { result, unmount } = renderHook(() => usePublicSync({ roomId }));
  const snapshot = toPublicDrawState({ title: 'Live room' });
  act(() => { sockets[0].open(); sockets[0].message({ type: 'state', status: 'open', revision: 1, snapshot, hostOnline: true, hostSeen: Date.now() }); });
  expect(result.current.drawState?.title).toBe('Live room');
  expect(result.current.revision).toBe(1);
  expect(result.current.syncStatus).toBe('live');
  unmount();
});

test('ignores stale snapshots and reports drawing, offline and closed', () => {
  const { result, unmount } = renderHook(() => usePublicSync({ roomId }));
  const newer = toPublicDrawState({ title: 'Newest', drawing: true });
  const older = toPublicDrawState({ title: 'Older' });
  act(() => {
    sockets[0].open();
    sockets[0].message({ type: 'state', status: 'open', revision: 2, snapshot: newer, hostOnline: true, hostSeen: Date.now() });
    sockets[0].message({ type: 'state', status: 'open', revision: 1, snapshot: older, hostOnline: true, hostSeen: Date.now() });
  });
  expect(result.current.drawState?.title).toBe('Newest');
  expect(result.current.syncStatus).toBe('drawing');
  act(() => sockets[0].message({ type: 'presence', hostOnline: false, hostSeen: Date.now() }));
  expect(result.current.syncStatus).toBe('offline');
  act(() => sockets[0].message({ type: 'closed' }));
  expect(result.current.drawState).toBeNull();
  expect(result.current.syncStatus).toBe('closed');
  unmount();
});

test('reconnects after an interrupted socket', async () => {
  jest.useFakeTimers();
  const { result, unmount } = renderHook(() => usePublicSync({ roomId }));
  await act(async () => { sockets[0].open(); sockets[0].close(); });
  expect(result.current.syncStatus).toBe('connecting');
  act(() => jest.advanceTimersByTime(1000));
  expect(sockets).toHaveLength(2);
  unmount();
  jest.useRealTimers();
});

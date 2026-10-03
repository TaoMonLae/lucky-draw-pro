import { act, renderHook } from '@testing-library/react';
import { useRealtimePublisher } from './useRealtimePublisher';
import { roomRequest } from '../lib/roomApi';

jest.mock('../lib/roomApi', () => ({
  isRoomServiceConfigured: true,
  roomSocketUrl: (id) => `wss://rooms.test/${id}`,
  roomRequest: jest.fn(),
}));
let sockets;
class FakeSocket {
  static OPEN = 1;
  constructor() { this.readyState = 0; this.sent = []; sockets.push(this); }
  open() { this.readyState = 1; this.onopen?.(); }
  send(value) { this.sent.push(JSON.parse(value)); }
  message(value) { this.onmessage?.({ data: JSON.stringify(value) }); }
  close() { this.readyState = 3; this.onclose?.(); }
}
const props = { roomId: 'room', writeKey: 'key', appState: {} };
beforeEach(() => {
  jest.useFakeTimers(); sockets = []; global.WebSocket = FakeSocket;
  roomRequest.mockReset().mockResolvedValue({});
});
afterEach(() => jest.useRealTimers());
const flush = async () => act(async () => { await Promise.resolve(); });
const authorize = (socket) => act(() => { socket.open(); socket.message({ type: 'authorized', revision: 0, snapshot: null }); });

test('queues the latest state until the current publication is acknowledged', async () => {
  const { rerender } = renderHook((value) => useRealtimePublisher(value), { initialProps: props });
  await flush(); authorize(sockets[0]);
  rerender({ ...props, appState: { title: 'Updated' } });
  expect(sockets[0].sent.filter((m) => m.type === 'publish')).toHaveLength(1);
  act(() => sockets[0].message({ type: 'published', revision: 1 }));
  expect(sockets[0].sent.at(-1).snapshot.title).toBe('Updated');
  expect(sockets[0].sent.at(-1).baseRevision).toBe(1);
});

test('a delayed callback from an old connection cannot disrupt a new room', async () => {
  const { result, rerender } = renderHook((value) => useRealtimePublisher(value), { initialProps: props });
  await flush(); authorize(sockets[0]);
  const old = sockets[0];
  rerender({ ...props, roomId: 'new-room' });
  await flush(); authorize(sockets[1]);
  act(() => {
    sockets[1].message({ type: 'published', revision: 1 });
    old.onclose();
    old.message({ type: 'closed' });
  });
  expect(result.current.status).toBe('live');
  expect(result.current.listenerStatus).toBe('listening');
});

test('does not connect after sharing is stopped during the initial fetch', async () => {
  let finish;
  roomRequest.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const { rerender } = renderHook((value) => useRealtimePublisher(value), { initialProps: props });
  rerender({ ...props, enabled: false });
  await act(async () => finish({}));
  expect(sockets).toHaveLength(0);
});

test('reconnects and publishes a final state after a disconnected publication', async () => {
  const { result } = renderHook(() => useRealtimePublisher(props));
  await flush(); authorize(sockets[0]);
  act(() => sockets[0].close());
  await act(async () => jest.advanceTimersByTime(1000));
  authorize(sockets[1]);
  expect(sockets[1].sent.at(-1).type).toBe('publish');
  act(() => sockets[1].message({ type: 'published', revision: 1 }));
  expect(result.current.status).toBe('live');
});

test('does not replace a newer room history with a stale host session', async () => {
  const { result } = renderHook(() => useRealtimePublisher(props));
  await flush();
  act(() => {
    sockets[0].open();
    sockets[0].message({ type: 'authorized', revision: 2, snapshot: { winnersHistory: [{ prize: 'First', tickets: ['Alice'] }] } });
  });
  expect(result.current.errorMessage).toMatch(/older draw history/);
  expect(sockets[0].sent.some((m) => m.type === 'publish')).toBe(false);
});

test.each([false, true])('negotiates winner-index support with the Worker: %s', async (supported) => {
  renderHook(() => useRealtimePublisher({ ...props, appState: { drawingWinnerIndex: 2 } }));
  await flush();
  act(() => {
    sockets[0].open();
    sockets[0].message({ type: 'authorized', revision: 0, snapshot: null, capabilities: supported ? ['winner-index'] : undefined });
  });
  expect(sockets[0].sent.at(-1).snapshot.live.drawingWinnerIndex).toBe(supported ? 2 : undefined);
});

import {
  REMOTE_CONTROL_STORAGE_KEY,
  buildRemoteControlUrl,
  clearRemoteControlCredentials,
  createRemoteControlCredentials,
  getRemoteControlCredentials,
  isHostReadyForRemoteDraw,
  isValidRemoteControlCredentials,
  loadRemoteControlCredentials,
  saveRemoteControlCredentials,
} from './remoteControl';

const roomId = '123e4567-e89b-42d3-a456-426614174000';
const remoteKey = `${'a'.repeat(32)}-${'b'.repeat(39)}`;

describe('remote control credentials', () => {
  test('creates a secure key independently from the room write key', () => {
    const ids = [
      '223e4567-e89b-42d3-a456-426614174001',
      '323e4567-e89b-42d3-a456-426614174002',
    ];
    const credentials = createRemoteControlCredentials(roomId, { randomUUID: () => ids.shift() });
    expect(credentials.roomId).toBe(roomId);
    expect(credentials.remoteKey).toHaveLength(72);
    expect(isValidRemoteControlCredentials(credentials)).toBe(true);
  });

  test('keeps the bearer key in the URL fragment instead of query parameters', () => {
    const credentials = { roomId, remoteKey };
    const url = buildRemoteControlUrl('https://draw.example.test/event?view=public&room=old', credentials);
    const parsed = new URL(url);
    expect(parsed.searchParams.get('view')).toBe('remote');
    expect(parsed.searchParams.get('room')).toBe(roomId);
    expect(parsed.searchParams.has('key')).toBe(false);
    expect(parsed.hash).toContain('key=');
    expect(getRemoteControlCredentials(url)).toEqual(credentials);
  });

  test('saves, loads, and clears valid host-side remote credentials', () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    const credentials = { roomId, remoteKey };
    saveRemoteControlCredentials(credentials, storage);
    expect(values.has(REMOTE_CONTROL_STORAGE_KEY)).toBe(true);
    expect(loadRemoteControlCredentials(storage)).toEqual(credentials);
    clearRemoteControlCredentials(storage);
    expect(loadRemoteControlCredentials(storage)).toBeNull();
  });

  test('rejects malformed or incomplete controller links', () => {
    expect(getRemoteControlCredentials('https://draw.example.test/?view=remote&room=bad#key=short')).toBeNull();
    expect(isValidRemoteControlCredentials({ roomId, remoteKey: 'short' })).toBe(false);
    expect(buildRemoteControlUrl('https://draw.example.test/', null)).toBe('');
  });

  test('allows the MC remote while host settings are open', () => {
    expect(isHostReadyForRemoteDraw({
      drawing: false,
      isCharging: false,
      remainingEntriesCount: 50,
      operationMode: 'standard',
      completedPrizeCount: 0,
      prizeCount: 5,
      showSettings: true,
    })).toBe(true);
  });

  test('blocks remote draws during active or completed draws', () => {
    expect(isHostReadyForRemoteDraw({ drawing: true, remainingEntriesCount: 50, prizeCount: 5 })).toBe(false);
    expect(isHostReadyForRemoteDraw({ isCharging: true, remainingEntriesCount: 50, prizeCount: 5 })).toBe(false);
    expect(isHostReadyForRemoteDraw({ remainingEntriesCount: 0, prizeCount: 5 })).toBe(false);
    expect(isHostReadyForRemoteDraw({ remainingEntriesCount: 50, completedPrizeCount: 5, prizeCount: 5 })).toBe(false);
  });
});

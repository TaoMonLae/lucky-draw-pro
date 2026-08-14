import {
  LIVE_ROOM_STORAGE_KEY,
  clearRoomCredentials,
  createRoomCredentials,
  isValidPublicDrawState,
  isValidRoomCredentials,
  loadRoomCredentials,
  saveRoomCredentials,
  toPublicDrawState,
} from './realtimeRoom';

const roomId = '123e4567-e89b-42d3-a456-426614174000';
const writeKey = 'a'.repeat(64);

describe('realtime room credentials', () => {
  test('creates secure room credentials from the supplied crypto API', () => {
    const ids = [roomId, '223e4567-e89b-42d3-a456-426614174001', '323e4567-e89b-42d3-a456-426614174002'];
    const credentials = createRoomCredentials({ randomUUID: () => ids.shift() });
    expect(credentials.roomId).toBe(roomId);
    expect(credentials.writeKey).toHaveLength(72);
    expect(isValidRoomCredentials(credentials)).toBe(true);
  });

  test('falls back to secure random bytes when randomUUID is unavailable', () => {
    let seed = 0;
    const credentials = createRoomCredentials({
      getRandomValues: (bytes) => bytes.map(() => (seed += 17) % 256),
    });
    expect(isValidRoomCredentials(credentials)).toBe(true);
  });

  test('saves, loads, and clears valid credentials', () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };
    const credentials = { roomId, writeKey };
    saveRoomCredentials(credentials, storage);
    expect(loadRoomCredentials(storage)).toEqual(credentials);
    expect(values.has(LIVE_ROOM_STORAGE_KEY)).toBe(true);
    clearRoomCredentials(storage);
    expect(loadRoomCredentials(storage)).toBeNull();
  });
});

describe('public realtime state', () => {
  test('excludes private participant and audit data', () => {
    const publicState = toPublicDrawState({
      title: 'Event',
      subtitle: 'Live',
      theme: 'Neon Party',
      backgroundImage: 'data:image/png;base64,public-background',
      titleFont: "'Z20 Khit Haungg', sans-serif",
      subtitleFont: "'Z11 Myan Sans', sans-serif",
      displayFont: "'Z06 Walone', sans-serif",
      titleColor: '#fafafa',
      subtitleColor: '#d4d4d8',
      titleFontSize: 54,
      subtitleFontSize: 18,
      displayFontSize: 110,
      displayLineHeight: 1.1,
      displayLetterSpacing: 0.05,
      drawMode: 'numbers',
      maxDigits: 5,
      initialEntries: ['Private Person'],
      auditLog: [{ selected: ['Private Person'] }],
      winnersHistory: [{ prize: 'Prize', tickets: ['Winner'] }],
      operationMode: 'standard',
      lastAssignmentResult: null,
      drawing: true,
      currentPrize: 'Grand Prize',
      publicDisplayValue: '00042',
      grandFinalePhase: 'build',
      showConfetti: true,
      completedPrizeCount: 2,
      prizeCount: 3,
      totalEntries: 100,
      remainingEntriesCount: 98,
    });
    expect(publicState.version).toBe(2);
    expect(publicState).not.toHaveProperty('initialEntries');
    expect(publicState).not.toHaveProperty('auditLog');
    expect(publicState.winnersHistory[0].tickets).toEqual(['Winner']);
    expect(publicState.theme).toBe('Neon Party');
    expect(publicState.backgroundImage).toContain('public-background');
    expect(publicState.titleFont).toContain('Z20 Khit Haungg');
    expect(publicState.live).toEqual({
      drawing: true,
      currentPrize: 'Grand Prize',
      displayValue: '00042',
      grandFinalePhase: 'build',
      showConfetti: true,
      completedPrizeCount: 2,
      prizeCount: 3,
      totalEntries: 100,
      remainingEntriesCount: 98,
    });
    expect(isValidPublicDrawState(publicState)).toBe(true);
  });

  test('continues accepting legacy public snapshots', () => {
    expect(isValidPublicDrawState({
      version: 1,
      title: 'Legacy Event',
      subtitle: '',
      logo: null,
      winnersHistory: [],
      operationMode: 'standard',
      lastAssignmentResult: null,
      updatedAt: new Date().toISOString(),
    })).toBe(true);
  });

  test('rejects malformed public state', () => {
    expect(isValidPublicDrawState({ version: 1, title: 'Missing fields' })).toBe(false);
    expect(isValidPublicDrawState({
      ...toPublicDrawState({ title: 'Event', subtitle: '', winnersHistory: [] }),
      live: { drawing: 'yes' },
    })).toBe(false);
  });
});

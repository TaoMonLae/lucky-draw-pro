import { isValidSessionData } from './validation';

export const LIVE_ROOM_STORAGE_KEY = 'lucky-draw-live-room';
export const MAX_PUBLIC_STATE_CHARS = 750_000;

export function createRoomCredentials(cryptoApi = window.crypto) {
  const secureUuid = () => {
    if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
    if (typeof cryptoApi?.getRandomValues !== 'function') return '';

    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };

  const roomId = secureUuid();
  const firstSecret = secureUuid();
  const secondSecret = secureUuid();
  if (!roomId || !firstSecret || !secondSecret) {
    throw new Error('This browser cannot generate secure live-room credentials.');
  }
  return {
    roomId,
    writeKey: `${firstSecret}${secondSecret}`,
  };
}

export function isValidRoomCredentials(value) {
  return Boolean(
    value
    && typeof value.roomId === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.roomId)
    && typeof value.writeKey === 'string'
    && value.writeKey.length >= 64
  );
}

export function loadRoomCredentials(storage = window.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(LIVE_ROOM_STORAGE_KEY) || 'null');
    return isValidRoomCredentials(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveRoomCredentials(credentials, storage = window.localStorage) {
  if (!isValidRoomCredentials(credentials)) throw new Error('Invalid live-room credentials.');
  storage?.setItem(LIVE_ROOM_STORAGE_KEY, JSON.stringify(credentials));
}

export function clearRoomCredentials(storage = window.localStorage) {
  storage?.removeItem(LIVE_ROOM_STORAGE_KEY);
}

export function toPublicDrawState(appState) {
  const publicState = {
    version: 1,
    title: typeof appState.title === 'string' ? appState.title.slice(0, 200) : 'Lucky Draw',
    subtitle: typeof appState.subtitle === 'string' ? appState.subtitle.slice(0, 300) : '',
    logo: typeof appState.logo === 'string' && appState.logo.length <= 250_000 ? appState.logo : null,
    winnersHistory: Array.isArray(appState.winnersHistory) ? appState.winnersHistory : [],
    operationMode: appState.operationMode || 'standard',
    lastAssignmentResult: appState.lastAssignmentResult || null,
    updatedAt: new Date().toISOString(),
  };

  if (!isValidPublicDrawState(publicState)) throw new Error('Public draw state is invalid.');
  if (JSON.stringify(publicState).length > MAX_PUBLIC_STATE_CHARS) {
    throw new Error('Public draw state is too large to synchronize.');
  }
  return publicState;
}

export function isValidPublicDrawState(value) {
  if (!value || typeof value !== 'object' || value.version !== 1) return false;
  if (typeof value.title !== 'string' || typeof value.subtitle !== 'string') return false;
  if (value.logo !== null && value.logo !== undefined && typeof value.logo !== 'string') return false;
  if (typeof value.updatedAt !== 'string' || Number.isNaN(Date.parse(value.updatedAt))) return false;

  return isValidSessionData({
    initialEntries: [],
    winnersHistory: value.winnersHistory,
    operationMode: value.operationMode,
    lastAssignmentResult: value.lastAssignmentResult,
  });
}

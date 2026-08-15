export const REMOTE_CONTROL_STORAGE_KEY = 'lucky-draw-remote-control';

export function isHostReadyForRemoteDraw({
  drawing = false,
  isCharging = false,
  remainingEntriesCount = 0,
  operationMode = 'standard',
  completedPrizeCount = 0,
  prizeCount = 0,
} = {}) {
  return !drawing
    && !isCharging
    && remainingEntriesCount > 0
    && (operationMode !== 'standard' || completedPrizeCount < prizeCount);
}

function secureUuid(cryptoApi) {
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  if (typeof cryptoApi?.getRandomValues !== 'function') return '';

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createRemoteControlCredentials(roomId, cryptoApi = window.crypto) {
  const firstSecret = secureUuid(cryptoApi);
  const secondSecret = secureUuid(cryptoApi);
  if (!roomId || !firstSecret || !secondSecret) {
    throw new Error('This browser cannot generate secure remote-control credentials.');
  }
  return { roomId, remoteKey: `${firstSecret}${secondSecret}` };
}

export function isValidRemoteControlCredentials(value) {
  return Boolean(
    value
    && typeof value.roomId === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.roomId)
    && typeof value.remoteKey === 'string'
    && value.remoteKey.length >= 64
  );
}

export function buildRemoteControlUrl(currentUrl, credentials) {
  if (!isValidRemoteControlCredentials(credentials)) return '';
  const url = new URL(currentUrl);
  url.search = '';
  url.searchParams.set('view', 'remote');
  url.searchParams.set('room', credentials.roomId);
  url.hash = new URLSearchParams({ key: credentials.remoteKey }).toString();
  return url.toString();
}

export function getRemoteControlCredentials(urlString) {
  try {
    const url = new URL(urlString);
    const credentials = {
      roomId: url.searchParams.get('room') || '',
      remoteKey: new URLSearchParams(url.hash.replace(/^#/, '')).get('key') || '',
    };
    return isValidRemoteControlCredentials(credentials) ? credentials : null;
  } catch {
    return null;
  }
}

export function loadRemoteControlCredentials(storage = window.localStorage) {
  try {
    const parsed = JSON.parse(storage?.getItem(REMOTE_CONTROL_STORAGE_KEY) || 'null');
    return isValidRemoteControlCredentials(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveRemoteControlCredentials(credentials, storage = window.localStorage) {
  if (!isValidRemoteControlCredentials(credentials)) throw new Error('Invalid remote-control credentials.');
  storage?.setItem(REMOTE_CONTROL_STORAGE_KEY, JSON.stringify(credentials));
}

export function clearRemoteControlCredentials(storage = window.localStorage) {
  storage?.removeItem(REMOTE_CONTROL_STORAGE_KEY);
}

import { isValidSessionData } from './validation';

export const LIVE_ROOM_STORAGE_KEY = 'lucky-draw-live-room';
export const MAX_PUBLIC_STATE_CHARS = 750_000;
const PUBLIC_THEMES = ['Event Night', 'Corporate Blue', 'Carnival Red', 'Neon Party'];
const PUBLIC_FINALE_PHASES = ['idle', 'build', 'reveal'];

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
  const safeNumber = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const backgroundImage = typeof appState.backgroundImage === 'string' && appState.backgroundImage.length <= 350_000
    ? appState.backgroundImage
    : '';
  const publicState = {
    version: 2,
    title: typeof appState.title === 'string' ? appState.title.slice(0, 200) : 'Lucky Draw',
    subtitle: typeof appState.subtitle === 'string' ? appState.subtitle.slice(0, 300) : '',
    theme: PUBLIC_THEMES.includes(appState.theme) ? appState.theme : 'Event Night',
    backgroundImage,
    titleFont: typeof appState.titleFont === 'string' ? appState.titleFont.slice(0, 500) : undefined,
    subtitleFont: typeof appState.subtitleFont === 'string' ? appState.subtitleFont.slice(0, 500) : undefined,
    displayFont: typeof appState.displayFont === 'string' ? appState.displayFont.slice(0, 500) : undefined,
    titleColor: typeof appState.titleColor === 'string' ? appState.titleColor.slice(0, 40) : '',
    subtitleColor: typeof appState.subtitleColor === 'string' ? appState.subtitleColor.slice(0, 40) : '',
    titleFontSize: safeNumber(appState.titleFontSize, 48),
    subtitleFontSize: safeNumber(appState.subtitleFontSize, 16),
    displayFontSize: safeNumber(appState.displayFontSize, 92),
    displayLineHeight: safeNumber(appState.displayLineHeight, 1.02),
    displayLetterSpacing: safeNumber(appState.displayLetterSpacing, 0.1),
    drawMode: appState.drawMode === 'names' ? 'names' : 'numbers',
    maxDigits: Math.max(1, Math.min(10, Math.round(safeNumber(appState.maxDigits, 2)))),
    logo: typeof appState.logo === 'string' && appState.logo.length <= 250_000 ? appState.logo : null,
    winnersHistory: Array.isArray(appState.winnersHistory) ? appState.winnersHistory : [],
    operationMode: appState.operationMode || 'standard',
    lastAssignmentResult: appState.lastAssignmentResult || null,
    live: {
      drawing: Boolean(appState.drawing),
      currentPrize: typeof appState.currentPrize === 'string' ? appState.currentPrize.slice(0, 200) : '',
      displayValue: typeof appState.publicDisplayValue === 'string' || typeof appState.publicDisplayValue === 'number'
        ? String(appState.publicDisplayValue).slice(0, 500)
        : '',
      grandFinalePhase: PUBLIC_FINALE_PHASES.includes(appState.grandFinalePhase) ? appState.grandFinalePhase : 'idle',
      showConfetti: Boolean(appState.showConfetti),
      completedPrizeCount: Math.max(0, Math.round(safeNumber(appState.completedPrizeCount, 0))),
      prizeCount: Math.max(0, Math.round(safeNumber(appState.prizeCount, 0))),
      totalEntries: Math.max(0, Math.round(safeNumber(appState.totalEntries, 0))),
      remainingEntriesCount: Math.max(0, Math.round(safeNumber(appState.remainingEntriesCount, 0))),
    },
    updatedAt: new Date().toISOString(),
  };

  if (!isValidPublicDrawState(publicState)) throw new Error('Public draw state is invalid.');
  if (JSON.stringify(publicState).length > MAX_PUBLIC_STATE_CHARS) {
    throw new Error('Public draw state is too large to synchronize.');
  }
  return publicState;
}

export function isValidPublicDrawState(value) {
  if (!value || typeof value !== 'object' || ![1, 2].includes(value.version)) return false;
  if (typeof value.title !== 'string' || typeof value.subtitle !== 'string') return false;
  if (value.logo !== null && value.logo !== undefined && typeof value.logo !== 'string') return false;
  if (typeof value.updatedAt !== 'string' || Number.isNaN(Date.parse(value.updatedAt))) return false;

  if (value.version === 2) {
    if (!PUBLIC_THEMES.includes(value.theme)) return false;
    if (typeof value.backgroundImage !== 'string') return false;
    if (!value.live || typeof value.live !== 'object') return false;
    if (typeof value.live.drawing !== 'boolean' || typeof value.live.showConfetti !== 'boolean') return false;
    if (typeof value.live.currentPrize !== 'string' || typeof value.live.displayValue !== 'string') return false;
    if (!PUBLIC_FINALE_PHASES.includes(value.live.grandFinalePhase)) return false;
    for (const field of ['completedPrizeCount', 'prizeCount', 'totalEntries', 'remainingEntriesCount']) {
      if (!Number.isInteger(value.live[field]) || value.live[field] < 0) return false;
    }
  }

  return isValidSessionData({
    initialEntries: [],
    winnersHistory: value.winnersHistory,
    operationMode: value.operationMode,
    lastAssignmentResult: value.lastAssignmentResult,
    titleFont: value.titleFont,
    subtitleFont: value.subtitleFont,
    displayFont: value.displayFont,
    drawMode: value.drawMode,
    maxDigits: value.maxDigits,
    theme: value.theme,
    titleColor: value.titleColor,
    subtitleColor: value.subtitleColor,
    titleFontSize: value.titleFontSize,
    subtitleFontSize: value.subtitleFontSize,
    displayFontSize: value.displayFontSize,
    displayLineHeight: value.displayLineHeight,
    displayLetterSpacing: value.displayLetterSpacing,
  });
}

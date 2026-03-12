const VALID_OPERATION_MODES = ['standard', 'team-divider', 'role-selector'];
const VALID_DRAW_MODES = ['numbers', 'names'];

export function isValidSessionData(data) {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.initialEntries)) return false;

  if (data.prizes !== undefined) {
    if (!Array.isArray(data.prizes)) return false;
    for (const prize of data.prizes) {
      if (!prize || typeof prize !== 'object') return false;
      if (prize.id === undefined || prize.name === undefined) return false;
    }
  }

  if (data.winnersHistory !== undefined) {
    if (!Array.isArray(data.winnersHistory)) return false;
    for (const group of data.winnersHistory) {
      if (!group || typeof group !== 'object') return false;
      if (typeof group.prize !== 'string') return false;
      if (!Array.isArray(group.tickets)) return false;
    }
  }

  if (data.operationMode !== undefined && !VALID_OPERATION_MODES.includes(data.operationMode)) {
    return false;
  }

  if (data.drawMode !== undefined && !VALID_DRAW_MODES.includes(data.drawMode)) {
    return false;
  }

  return true;
}

export function parseSessionJson(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { data: null, error: 'Malformed JSON: could not parse session file.' };
  }
  if (!isValidSessionData(data)) {
    return { data: null, error: 'Session file is missing required fields or has invalid structure.' };
  }
  return { data, error: null };
}

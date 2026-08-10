import { themes } from './themeConfig';

const VALID_OPERATION_MODES = ['standard', 'team-divider', 'role-selector'];
const VALID_DRAW_MODES = ['numbers', 'names'];
const VALID_ELIGIBILITY_MODES = ['remove', 'keep'];
const OPTIONAL_STRING_FIELDS = [
  'inputValue', 'title', 'subtitle', 'backgroundImage', 'titleColor', 'subtitleColor',
  'titleFont', 'subtitleFont', 'displayFont', 'roleConfigText',
];
const OPTIONAL_NUMERIC_RANGES = {
  titleLineSpacing: [0.5, 3], subtitleLineSpacing: [0.5, 3],
  titleLetterSpacing: [-20, 100], subtitleLetterSpacing: [-20, 100],
  titleFontSize: [8, 300], subtitleFontSize: [8, 200],
  displayFontSize: [8, 300], displayLineHeight: [0.5, 3], displayLetterSpacing: [-20, 100],
  displayBoxWidth: [100, 4000], displayBoxHeight: [80, 2000],
  masterVolume: [-60, 12], sfxVolume: [-60, 12], musicVolume: [-60, 12],
};

export function isValidSessionData(data) {
  if (!data || typeof data !== 'object') return false;
  if (!Array.isArray(data.initialEntries)) return false;
  if (!data.initialEntries.every((entry) => typeof entry === 'string')) return false;

  if (data.remainingEntries !== undefined) {
    if (!Array.isArray(data.remainingEntries)) return false;
    if (!data.remainingEntries.every((entry) => typeof entry === 'string')) return false;
  }

  if (data.prizes !== undefined) {
    if (!Array.isArray(data.prizes)) return false;
    for (const prize of data.prizes) {
      if (!prize || typeof prize !== 'object') return false;
      if (prize.id === undefined || typeof prize.name !== 'string') return false;
    }
  }

  if (data.winnersHistory !== undefined) {
    if (!Array.isArray(data.winnersHistory)) return false;
    for (const group of data.winnersHistory) {
      if (!group || typeof group !== 'object') return false;
      if (typeof group.prize !== 'string') return false;
      if (!Array.isArray(group.tickets)) return false;
      if (!group.tickets.every((ticket) => typeof ticket === 'string')) return false;
    }
  }

  if (data.auditLog !== undefined) {
    if (!Array.isArray(data.auditLog)) return false;
    for (const entry of data.auditLog) {
      if (!entry || typeof entry !== 'object') return false;
      if (!Array.isArray(entry.selected) || !entry.selected.every((item) => typeof item === 'string')) return false;
      if (typeof entry.mode !== 'string' || typeof entry.context !== 'string' || typeof entry.timestamp !== 'string') return false;
    }
  }

  if (data.lastAssignmentResult !== undefined && data.lastAssignmentResult !== null) {
    const result = data.lastAssignmentResult;
    if (!result || typeof result !== 'object') return false;
    if (result.mode === 'team-divider') {
      if (!Array.isArray(result.teams)) return false;
      if (!result.teams.every((team) => team && typeof team.teamName === 'string' && Array.isArray(team.members) && team.members.every((member) => typeof member === 'string'))) return false;
    } else if (result.mode === 'role-selector') {
      if (!Array.isArray(result.assignments)) return false;
      if (!result.assignments.every((assignment) => assignment && typeof assignment.role === 'string' && Array.isArray(assignment.participants) && assignment.participants.every((participant) => typeof participant === 'string'))) return false;
    } else {
      return false;
    }
  }

  if (data.operationMode !== undefined && !VALID_OPERATION_MODES.includes(data.operationMode)) {
    return false;
  }

  if (data.drawMode !== undefined && !VALID_DRAW_MODES.includes(data.drawMode)) {
    return false;
  }

  if (data.theme !== undefined && !Object.prototype.hasOwnProperty.call(themes, data.theme)) {
    return false;
  }

  if (data.winnersPerPrize !== undefined && (!Number.isInteger(data.winnersPerPrize) || data.winnersPerPrize < 1)) {
    return false;
  }

  if (data.maxDigits !== undefined && (!Number.isInteger(data.maxDigits) || data.maxDigits < 1 || data.maxDigits > 10)) {
    return false;
  }

  if (data.teamCount !== undefined && (!Number.isInteger(data.teamCount) || data.teamCount < 2 || data.teamCount > 100)) {
    return false;
  }

  if (data.winnerEligibilityMode !== undefined && !VALID_ELIGIBILITY_MODES.includes(data.winnerEligibilityMode)) {
    return false;
  }

  if (OPTIONAL_STRING_FIELDS.some((field) => data[field] !== undefined && typeof data[field] !== 'string')) {
    return false;
  }

  for (const [field, [minimum, maximum]] of Object.entries(OPTIONAL_NUMERIC_RANGES)) {
    if (data[field] === undefined) continue;
    const value = typeof data[field] === 'string' && data[field].trim() !== ''
      ? Number(data[field])
      : data[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) return false;
  }

  if (data.logo !== undefined && data.logo !== null && typeof data.logo !== 'string') return false;
  if (data.allowMultipleRoles !== undefined && typeof data.allowMultipleRoles !== 'boolean') return false;
  if (data.noRepeatAcrossPrizes !== undefined && typeof data.noRepeatAcrossPrizes !== 'boolean') return false;

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

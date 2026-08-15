const CSV_SPLIT_REGEX = /[\n,]+/;
export const MAX_ENTRIES = 70000;

const collapseWhitespace = (value) => value.replace(/\s+/g, ' ').trim();

const getDedupKey = (value, drawMode) => {
  const collapsed = collapseWhitespace(value);
  return drawMode === 'names' ? collapsed.toLocaleLowerCase() : collapsed;
};

export function parseMixedParticipants(inputValue = '') {
  return inputValue
    .split(CSV_SPLIT_REGEX)
    .map((part) => part.trim());
}

export function parseCsvParticipants(csvText = '') {
  const entries = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (char === ',' || char === '\n' || char === '\r')) {
      entries.push(current.trim());
      current = '';

      if (char === '\r' && nextChar === '\n') {
        i += 1;
      }
      continue;
    }

    current += char;
  }

  entries.push(current.trim());
  return entries;
}

export function normalizeEntries(rawEntries = [], drawMode = 'numbers') {
  const uniqueEntries = [];
  const keyToEntry = new Map();
  const duplicateGroups = [];
  let blankCount = 0;
  const normalizedValues = rawEntries.map((entry) => collapseWhitespace(String(entry ?? '')));
  const numericWidth = drawMode === 'numbers'
    ? normalizedValues.reduce((maximum, value) => Math.max(maximum, value.length), 0)
    : 0;

  normalizedValues.forEach((value) => {
    const normalized = drawMode === 'numbers' && value
      ? value.padStart(numericWidth, '0')
      : value;
    if (!normalized) {
      blankCount += 1;
      return;
    }

    const key = getDedupKey(normalized, drawMode);
    const existing = keyToEntry.get(key);

    if (!existing) {
      keyToEntry.set(key, normalized);
      uniqueEntries.push(normalized);
      return;
    }

    const group = duplicateGroups.find((item) => item.kept === existing);
    if (group) {
      group.removed.push(normalized);
    } else {
      duplicateGroups.push({ kept: existing, removed: [normalized] });
    }
  });

  return {
    entries: uniqueEntries,
    duplicateGroups,
    blankCount,
  };
}

const parseNumberRange = (inputValue) => {
  const input = inputValue.trim();
  if (!input.includes('-') || input.includes(',') || /\n|\r/.test(input)) {
    return null;
  }

  const parts = input.split('-').map((p) => p.trim());
  if (parts.length !== 2) return { error: 'Invalid range format. Please use "start-end".' };

  const [startStr, endStr] = parts;
  if (!/^\d+$/.test(startStr) || !/^\d+$/.test(endStr)) {
    return { error: 'Invalid range. Ticket numbers must use digits only.' };
  }
  const startNum = parseInt(startStr, 10);
  const endNum = parseInt(endStr, 10);

  if (Number.isNaN(startNum) || Number.isNaN(endNum) || startNum >= endNum) {
    return { error: 'Invalid range. Start must be less than end.' };
  }

  const padding = startStr.length;
  if (Math.max(startStr.length, endStr.length) > 10) return { error: 'Ticket numbers cannot exceed 10 digits.' };
  if (endNum - startNum + 1 > MAX_ENTRIES) {
    return { error: `Range is too large. Please use a range of ${MAX_ENTRIES.toLocaleString()} tickets or less.` };
  }

  return {
    entries: Array.from({ length: endNum - startNum + 1 }, (_, i) => String(startNum + i).padStart(padding, '0')),
    duplicateGroups: [],
    blankCount: 0,
  };
};

export function parseEntries(inputValue, drawMode) {
  if (drawMode === 'numbers') {
    const rangeResult = parseNumberRange(inputValue);
    if (rangeResult) return rangeResult;
  }

  const rawEntries = parseMixedParticipants(inputValue);
  return normalizeAndValidateEntries(rawEntries, drawMode);
}

export function parseEntriesFromCsv(csvText, drawMode) {
  const rawEntries = parseCsvParticipants(csvText);
  return normalizeAndValidateEntries(rawEntries, drawMode);
}

function normalizeAndValidateEntries(rawEntries, drawMode) {
  const result = normalizeEntries(rawEntries, drawMode);
  if (result.entries.length > MAX_ENTRIES) {
    return {
      ...result,
      entries: [],
      error: `Too many entries. Please provide ${MAX_ENTRIES.toLocaleString()} or less.`,
    };
  }
  if (drawMode !== 'numbers') return result;

  const nonNumericEntry = result.entries.find((entry) => !/^\d+$/.test(entry));
  if (nonNumericEntry) {
    return { ...result, entries: [], error: `Invalid ticket number: "${nonNumericEntry}". Use digits only.` };
  }

  const oversizedEntry = result.entries.find((entry) => entry.length > 10);
  if (oversizedEntry) {
    return { ...result, entries: [], error: 'Ticket numbers cannot exceed 10 digits.' };
  }

  return result;
}

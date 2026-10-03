export const MAX_ENTRIES = 70000;

const collapseWhitespace = (value) => value.replace(/\s+/g, ' ').trim();

const getDedupKey = (value, drawMode) => {
  const collapsed = collapseWhitespace(value);
  return drawMode === 'names' ? collapsed.toLocaleLowerCase() : collapsed;
};

export function parseMixedParticipants(inputValue = '') {
  return parseCsvParticipants(inputValue);
}

export function formatEntriesForInput(entries = []) {
  return entries.map((entry) => {
    const value = String(entry);
    return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }).join(', ');
}

export function parseCsvParticipants(csvText = '') {
  return parseCsvRows(csvText).flat();
}

function parseCsvRows(csvText = '') {
  const source = csvText.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const nextChar = source[i + 1];

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
      row.push(current.trim());
      current = '';

      if (char === ',') continue;
      rows.push(row);
      row = [];
      if (char === '\r' && nextChar === '\n') {
        i += 1;
      }
      continue;
    }

    current += char;
  }

  if (row.length || current || !/[\r\n]$/.test(source)) {
    row.push(current.trim());
    rows.push(row);
  }
  return rows;
}

export function normalizeEntries(rawEntries = [], drawMode = 'numbers') {
  const uniqueEntries = [];
  const keyToEntry = new Map();
  const duplicateGroups = [];
  const groupsByEntry = new Map();
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

    const group = groupsByEntry.get(existing);
    if (group) {
      group.removed.push(normalized);
    } else {
      const newGroup = { kept: existing, removed: [normalized] };
      groupsByEntry.set(existing, newGroup);
      duplicateGroups.push(newGroup);
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
  const rows = parseCsvRows(csvText);
  const headers = drawMode === 'numbers'
    ? ['number', 'numbers', 'ticket', 'tickets', 'ticket number', 'ticket_number', 'id']
    : ['name', 'names', 'participant', 'participants', 'participant name', 'full name'];
  const headerColumn = rows.length > 1
    ? rows[0].findIndex((cell) => headers.includes(cell.toLocaleLowerCase()))
    : -1;
  const headerSkipped = headerColumn >= 0 ? rows[0][headerColumn] : null;
  const rawEntries = headerColumn >= 0
    ? rows.slice(1).map((row) => row[headerColumn] ?? '')
    : rows.flat();
  return {
    ...normalizeAndValidateEntries(rawEntries, drawMode),
    headerSkipped,
    ignoredColumns: headerColumn >= 0 ? Math.max(0, rows[0].length - 1) : 0,
  };
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

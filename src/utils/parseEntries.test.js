import { MAX_ENTRIES, normalizeEntries, parseEntries, parseEntriesFromCsv } from './parseEntries';

describe('parseEntries', () => {
  test('supports mixed commas and line breaks', () => {
    const result = parseEntries(' Alice, Bob\nCharlie\n\nDelta, Echo ', 'names');
    expect(result.entries).toEqual(['Alice', 'Bob', 'Charlie', 'Delta', 'Echo']);
  });

  test('removes blanks and deduplicates names ignoring case/extra spacing', () => {
    const result = parseEntries(' Alice , alice\nALICE\n Bob  Smith\nBob Smith ', 'names');
    expect(result.entries).toEqual(['Alice', 'Bob Smith']);
    expect(result.blankCount).toBe(0);
    expect(result.duplicateGroups).toHaveLength(2);
  });

  test('keeps number range behavior intact', () => {
    const result = parseEntries('001-003', 'numbers');
    expect(result.entries).toEqual(['001', '002', '003']);
  });

  test('accepts a number range containing exactly 70,000 tickets', () => {
    const result = parseEntries(`1-${MAX_ENTRIES}`, 'numbers');
    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(MAX_ENTRIES);
    expect(result.entries[0]).toBe('1');
    expect(result.entries[MAX_ENTRIES - 1]).toBe(String(MAX_ENTRIES));
  });

  test('rejects a number range containing more than 70,000 tickets', () => {
    const result = parseEntries(`1-${MAX_ENTRIES + 1}`, 'numbers');
    expect(result.entries).toBeUndefined();
    expect(result.error).toMatch(/70,000/);
  });

  test('deduplicates number entries while preserving value formatting', () => {
    const result = parseEntries('001, 001, 002\n002', 'numbers');
    expect(result.entries).toEqual(['001', '002']);
    expect(result.duplicateGroups).toHaveLength(2);
  });

  test('deduplicates numeric tickets after canonical zero-padding', () => {
    const result = parseEntries('9, 09, 15', 'numbers');
    expect(result.entries).toEqual(['09', '15']);
    expect(result.duplicateGroups).toEqual([{ kept: '09', removed: ['09'] }]);
  });

  test('applies the same canonical duplicate detection to CSV imports', () => {
    const result = parseEntriesFromCsv('7,007,120', 'numbers');
    expect(result.entries).toEqual(['007', '120']);
    expect(result.duplicateGroups).toEqual([{ kept: '007', removed: ['007'] }]);
  });

  test('rejects non-numeric ticket values in numbers mode', () => {
    const result = parseEntries('001, ticket-2, 003', 'numbers');
    expect(result.entries).toEqual([]);
    expect(result.error).toMatch(/digits only/);
  });

  test('rejects number ranges with partial numeric values', () => {
    const result = parseEntries('1a-3', 'numbers');
    expect(result.error).toMatch(/digits only/);
  });

  test('rejects a range whose end exceeds ten digits', () => {
    const result = parseEntries('9999999999-10000000000', 'numbers');
    expect(result.error).toMatch(/10 digits/);
  });
});

describe('normalizeEntries', () => {
  test('counts blank entries', () => {
    const result = normalizeEntries(['Alice', ' ', '', ' Bob '], 'names');
    expect(result.entries).toEqual(['Alice', 'Bob']);
    expect(result.blankCount).toBe(2);
  });
});

describe('parseEntriesFromCsv', () => {
  test('parses csv values and quoted values', () => {
    const result = parseEntriesFromCsv('Alice,"Bob, Jr"\nCharlie\n"Dana"', 'names');
    expect(result.entries).toEqual(['Alice', 'Bob, Jr', 'Charlie', 'Dana']);
  });

  test('normalizes csv duplicates', () => {
    const result = parseEntriesFromCsv('Alice,alice,ALICE', 'names');
    expect(result.entries).toEqual(['Alice']);
    expect(result.duplicateGroups).toHaveLength(1);
  });

  test('rejects CSV input above the shared entry limit', () => {
    const csv = Array.from({ length: MAX_ENTRIES + 1 }, (_, index) => `Name ${index + 1}`).join('\n');
    const result = parseEntriesFromCsv(csv, 'names');
    expect(result.entries).toEqual([]);
    expect(result.error).toMatch(/70,000/);
  });
});

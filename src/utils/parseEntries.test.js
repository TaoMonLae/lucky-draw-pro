import { normalizeEntries, parseEntries, parseEntriesFromCsv } from './parseEntries';

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

  test('deduplicates number entries while preserving value formatting', () => {
    const result = parseEntries('001, 001, 002\n002', 'numbers');
    expect(result.entries).toEqual(['001', '002']);
    expect(result.duplicateGroups).toHaveLength(2);
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
});

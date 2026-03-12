import { isValidSessionData, parseSessionJson } from './validation';

describe('isValidSessionData', () => {
  test('returns true for minimal valid data', () => {
    expect(isValidSessionData({ initialEntries: [] })).toBe(true);
  });

  test('returns false for null', () => {
    expect(isValidSessionData(null)).toBe(false);
  });

  test('returns false for non-object', () => {
    expect(isValidSessionData('string')).toBe(false);
    expect(isValidSessionData(42)).toBe(false);
  });

  test('returns false when initialEntries is missing', () => {
    expect(isValidSessionData({ prizes: [] })).toBe(false);
  });

  test('returns false when initialEntries is not an array', () => {
    expect(isValidSessionData({ initialEntries: 'oops' })).toBe(false);
  });

  test('returns false when a prize is missing name', () => {
    expect(isValidSessionData({ initialEntries: [], prizes: [{ id: 1 }] })).toBe(false);
  });

  test('returns false when a prize is missing id', () => {
    expect(isValidSessionData({ initialEntries: [], prizes: [{ name: 'Grand Prize' }] })).toBe(false);
  });

  test('returns false when prizes is not an array', () => {
    expect(isValidSessionData({ initialEntries: [], prizes: 'bad' })).toBe(false);
  });

  test('returns false when winnersHistory group is missing tickets', () => {
    expect(isValidSessionData({ initialEntries: [], winnersHistory: [{ prize: '1st' }] })).toBe(false);
  });

  test('returns false when winnersHistory group is missing prize string', () => {
    expect(isValidSessionData({ initialEntries: [], winnersHistory: [{ tickets: ['A'] }] })).toBe(false);
  });

  test('returns false when winnersHistory is not an array', () => {
    expect(isValidSessionData({ initialEntries: [], winnersHistory: {} })).toBe(false);
  });

  test('returns false for invalid operationMode', () => {
    expect(isValidSessionData({ initialEntries: [], operationMode: 'hack-mode' })).toBe(false);
  });

  test('returns false for invalid drawMode', () => {
    expect(isValidSessionData({ initialEntries: [], drawMode: 'quantum' })).toBe(false);
  });

  test('returns true with valid operationMode: standard', () => {
    expect(isValidSessionData({ initialEntries: [], operationMode: 'standard' })).toBe(true);
  });

  test('returns true with valid operationMode: team-divider', () => {
    expect(isValidSessionData({ initialEntries: [], operationMode: 'team-divider' })).toBe(true);
  });

  test('returns true with valid operationMode: role-selector', () => {
    expect(isValidSessionData({ initialEntries: [], operationMode: 'role-selector' })).toBe(true);
  });

  test('returns true with valid drawMode: numbers', () => {
    expect(isValidSessionData({ initialEntries: [], drawMode: 'numbers' })).toBe(true);
  });

  test('returns true with valid drawMode: names', () => {
    expect(isValidSessionData({ initialEntries: [], drawMode: 'names' })).toBe(true);
  });

  test('returns true with fully populated valid data', () => {
    const data = {
      initialEntries: ['Alice', 'Bob'],
      prizes: [{ id: 1, name: '1st Prize' }],
      winnersHistory: [{ prize: '1st Prize', tickets: ['Alice'] }],
      operationMode: 'standard',
      drawMode: 'names',
    };
    expect(isValidSessionData(data)).toBe(true);
  });
});

describe('parseSessionJson', () => {
  test('returns error for malformed JSON', () => {
    const { data, error } = parseSessionJson('not valid json {{{');
    expect(data).toBeNull();
    expect(error).toMatch(/Malformed JSON/);
  });

  test('returns error for empty string', () => {
    const { data, error } = parseSessionJson('');
    expect(data).toBeNull();
    expect(error).toMatch(/Malformed JSON/);
  });

  test('returns error for JSON missing required keys', () => {
    const { data, error } = parseSessionJson(JSON.stringify({ foo: 'bar' }));
    expect(data).toBeNull();
    expect(error).toMatch(/missing required fields/);
  });

  test('returns error for JSON with invalid prize structure', () => {
    const session = { initialEntries: [], prizes: [{ id: 1 }] };
    const { data, error } = parseSessionJson(JSON.stringify(session));
    expect(data).toBeNull();
    expect(error).toMatch(/missing required fields/);
  });

  test('returns error for JSON with invalid operationMode', () => {
    const session = { initialEntries: [], operationMode: 'bad-mode' };
    const { data, error } = parseSessionJson(JSON.stringify(session));
    expect(data).toBeNull();
    expect(error).toMatch(/missing required fields/);
  });

  test('returns data for valid session JSON', () => {
    const session = { initialEntries: ['001', '002'] };
    const { data, error } = parseSessionJson(JSON.stringify(session));
    expect(error).toBeNull();
    expect(data.initialEntries).toEqual(['001', '002']);
  });

  test('returns data for complete valid session JSON', () => {
    const session = {
      initialEntries: ['Alice', 'Bob'],
      prizes: [{ id: 1, name: '1st' }],
      winnersHistory: [{ prize: '1st', tickets: ['Alice'] }],
      drawMode: 'names',
      operationMode: 'standard',
    };
    const { data, error } = parseSessionJson(JSON.stringify(session));
    expect(error).toBeNull();
    expect(data).toEqual(session);
  });
});

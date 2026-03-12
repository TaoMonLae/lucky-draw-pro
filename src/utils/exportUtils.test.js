import { buildWinnersCsvRows, buildAuditLogCsvRows, downloadCsv } from './exportUtils';

describe('buildWinnersCsvRows', () => {
  test('returns header row for empty history', () => {
    const rows = buildWinnersCsvRows([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(['Prize', 'Winner', 'Draw Order']);
  });

  test('returns one data row per winner ticket', () => {
    const history = [
      { prize: '2nd Prize', tickets: ['Alice', 'Bob'] },
      { prize: '1st Prize', tickets: ['Charlie'] },
    ];
    const rows = buildWinnersCsvRows(history);
    expect(rows).toHaveLength(4); // header + 3 winners
  });

  test('assigns correct prize names and draw order', () => {
    const history = [
      { prize: '2nd Prize', tickets: ['Alice'] },
      { prize: '1st Prize', tickets: ['Bob'] },
    ];
    const rows = buildWinnersCsvRows(history);
    expect(rows[1]).toEqual(['2nd Prize', 'Alice', 1]);
    expect(rows[2]).toEqual(['1st Prize', 'Bob', 2]);
  });

  test('handles multiple tickets per prize with same draw order', () => {
    const history = [{ prize: 'Grand Prize', tickets: ['A', 'B', 'C'] }];
    const rows = buildWinnersCsvRows(history);
    expect(rows[1][2]).toBe(1);
    expect(rows[2][2]).toBe(1);
    expect(rows[3][2]).toBe(1);
  });
});

describe('buildAuditLogCsvRows', () => {
  test('returns only header row for empty log', () => {
    const rows = buildAuditLogCsvRows([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(['Timestamp', 'Mode', 'Context', 'Selected', 'Remaining Count']);
  });

  test('returns one data row per audit entry', () => {
    const log = [
      { timestamp: '2024-01-01T00:00:00.000Z', mode: 'standard', context: '1st Prize', selected: ['Alice'], remainingCount: 9 },
      { timestamp: '2024-01-01T00:01:00.000Z', mode: 'standard', context: '2nd Prize', selected: ['Bob'], remainingCount: 8 },
    ];
    const rows = buildAuditLogCsvRows(log);
    expect(rows).toHaveLength(3);
  });

  test('joins multiple selected entries with semicolons', () => {
    const log = [
      { timestamp: '2024-01-01', mode: 'standard', context: 'test', selected: ['A', 'B', 'C'], remainingCount: 7 },
    ];
    const rows = buildAuditLogCsvRows(log);
    expect(rows[1][3]).toBe('A; B; C');
  });

  test('uses empty string when remainingCount is undefined', () => {
    const log = [
      { timestamp: '2024-01-01', mode: 'team-divider', context: '3 teams', selected: ['X'], remainingCount: undefined },
    ];
    const rows = buildAuditLogCsvRows(log);
    expect(rows[1][4]).toBe('');
  });

  test('maps each field to the correct column', () => {
    const entry = { timestamp: '2024-06-01', mode: 'role-selector', context: 'Council Roles', selected: ['Dana'], remainingCount: 5 };
    const rows = buildAuditLogCsvRows([entry]);
    expect(rows[1][0]).toBe('2024-06-01');
    expect(rows[1][1]).toBe('role-selector');
    expect(rows[1][2]).toBe('Council Roles');
    expect(rows[1][3]).toBe('Dana');
    expect(rows[1][4]).toBe(5);
  });
});

describe('downloadCsv (CSV escaping)', () => {
  beforeEach(() => {
    // Stub URL and DOM APIs used inside downloadCsv
    global.URL.createObjectURL = jest.fn(() => 'blob:mock');
    global.URL.revokeObjectURL = jest.fn();
    document.createElement = jest.fn(() => ({ click: jest.fn(), href: '', download: '' }));
  });

  test('does not throw for normal data', () => {
    expect(() => downloadCsv('test.csv', [['Name', 'Score'], ['Alice', 100]])).not.toThrow();
  });
});

import { assignRoles, createAuditEntry, divideIntoTeams, getNoRepeatSet } from './drawModes';

describe('divideIntoTeams', () => {
  test('balances members as evenly as possible', () => {
    const participants = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const teams = divideIntoTeams(participants, 3, () => 0.2);
    const sizes = teams.map((team) => team.members.length).sort((a, b) => a - b);
    expect(sizes).toEqual([2, 2, 3]);
  });
});

describe('assignRoles', () => {
  test('assigns unique participants when allowMultipleRoles is false', () => {
    const assignments = assignRoles(
      ['A', 'B', 'C'],
      [
        { name: 'Host', count: 1 },
        { name: 'Judge', count: 2 },
      ],
      { allowMultipleRoles: false },
      () => 0.1,
    );

    const picked = assignments.flatMap((role) => role.participants);
    expect(new Set(picked).size).toBe(picked.length);
  });

  test('can reuse participants when allowMultipleRoles is true', () => {
    const assignments = assignRoles(
      ['A', 'B'],
      [{ name: 'Role', count: 4 }],
      { allowMultipleRoles: true },
      () => 0.1,
    );

    expect(assignments[0].participants).toHaveLength(4);
  });
});

describe('no-repeat and audit helpers', () => {
  test('builds no-repeat set from history selected entries', () => {
    const seen = getNoRepeatSet([
      { selected: ['A', 'B'] },
      { selected: ['C'] },
    ]);
    expect(seen.has('A')).toBe(true);
    expect(seen.has('C')).toBe(true);
    expect(seen.has('Z')).toBe(false);
  });

  test('creates audit entry with expected shape', () => {
    const entry = createAuditEntry({
      mode: 'standard',
      context: '1st Prize',
      selected: ['A'],
      remainingCount: 9,
    });

    expect(entry.mode).toBe('standard');
    expect(entry.context).toBe('1st Prize');
    expect(entry.selected).toEqual(['A']);
    expect(entry.remainingCount).toBe(9);
    expect(typeof entry.timestamp).toBe('string');
  });
});

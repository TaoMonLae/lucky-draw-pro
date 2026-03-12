import { sessionTemplates } from './sessionTemplates';

describe('sessionTemplates', () => {
  test('exports an array with five templates', () => {
    expect(Array.isArray(sessionTemplates)).toBe(true);
    expect(sessionTemplates).toHaveLength(5);
  });

  test('contains all required template IDs', () => {
    const ids = sessionTemplates.map(t => t.id);
    expect(ids).toContain('school-assembly');
    expect(ids).toContain('raffle-draw');
    expect(ids).toContain('classroom-picker');
    expect(ids).toContain('student-council');
    expect(ids).toContain('team-divider');
  });

  test('each template has required top-level fields', () => {
    for (const template of sessionTemplates) {
      expect(typeof template.id).toBe('string');
      expect(typeof template.label).toBe('string');
      expect(typeof template.description).toBe('string');
      expect(template.settings).toBeTruthy();
      expect(typeof template.settings).toBe('object');
    }
  });

  test('each template settings contains a non-empty prizes array', () => {
    for (const template of sessionTemplates) {
      expect(Array.isArray(template.settings.prizes)).toBe(true);
      expect(template.settings.prizes.length).toBeGreaterThan(0);
      for (const prize of template.settings.prizes) {
        expect(typeof prize.id).not.toBeUndefined();
        expect(typeof prize.name).toBe('string');
      }
    }
  });

  test('team-divider template uses team-divider operationMode with teamCount > 1', () => {
    const t = sessionTemplates.find(t => t.id === 'team-divider');
    expect(t.settings.operationMode).toBe('team-divider');
    expect(t.settings.teamCount).toBeGreaterThan(1);
  });

  test('student-council template uses role-selector mode with roleConfigText', () => {
    const t = sessionTemplates.find(t => t.id === 'student-council');
    expect(t.settings.operationMode).toBe('role-selector');
    expect(typeof t.settings.roleConfigText).toBe('string');
    expect(t.settings.roleConfigText.length).toBeGreaterThan(0);
  });

  test('classroom-picker keeps winners eligible (keep mode)', () => {
    const t = sessionTemplates.find(t => t.id === 'classroom-picker');
    expect(t.settings.winnerEligibilityMode).toBe('keep');
  });

  test('raffle-draw uses numbers drawMode', () => {
    const t = sessionTemplates.find(t => t.id === 'raffle-draw');
    expect(t.settings.drawMode).toBe('numbers');
  });

  test('school-assembly uses names drawMode with noRepeat enabled', () => {
    const t = sessionTemplates.find(t => t.id === 'school-assembly');
    expect(t.settings.drawMode).toBe('names');
    expect(t.settings.noRepeatAcrossPrizes).toBe(true);
  });

  test('every template has a theme that is a non-empty string', () => {
    for (const template of sessionTemplates) {
      expect(typeof template.settings.theme).toBe('string');
      expect(template.settings.theme.length).toBeGreaterThan(0);
    }
  });
});

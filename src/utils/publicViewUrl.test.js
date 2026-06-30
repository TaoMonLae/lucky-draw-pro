import { buildPublicViewUrl } from './publicViewUrl';

describe('buildPublicViewUrl', () => {
  test('adds the public view parameter to a plain URL', () => {
    expect(buildPublicViewUrl('https://example.com/draw')).toBe('https://example.com/draw?view=public');
  });

  test('preserves existing query parameters while setting public view', () => {
    expect(buildPublicViewUrl('https://example.com/draw?event=summer&view=host')).toBe('https://example.com/draw?event=summer&view=public');
  });

  test('keeps hash fragments after the updated query string', () => {
    expect(buildPublicViewUrl('https://example.com/draw#stage')).toBe('https://example.com/draw?view=public#stage');
  });
});

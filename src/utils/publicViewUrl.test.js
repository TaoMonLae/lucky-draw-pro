import { buildPublicViewUrl, getPublicRoomId } from './publicViewUrl';

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

  test('adds a realtime room to the public URL', () => {
    expect(buildPublicViewUrl('https://example.com/draw', '123e4567-e89b-42d3-a456-426614174000'))
      .toBe('https://example.com/draw?view=public&room=123e4567-e89b-42d3-a456-426614174000');
  });

  test('reads only valid-looking room IDs', () => {
    expect(getPublicRoomId('https://example.com/?view=public&room=123e4567-e89b-42d3-a456-426614174000'))
      .toBe('123e4567-e89b-42d3-a456-426614174000');
    expect(getPublicRoomId('https://example.com/?room=../../bad')).toBe('');
  });
});

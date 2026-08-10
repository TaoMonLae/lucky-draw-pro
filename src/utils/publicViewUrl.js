export function buildPublicViewUrl(currentHref, roomId = '') {
  const url = new URL(currentHref, window.location.origin);
  url.searchParams.set('view', 'public');
  if (roomId) url.searchParams.set('room', roomId);
  else url.searchParams.delete('room');
  return url.toString();
}

export function getPublicRoomId(currentHref) {
  const url = new URL(currentHref, window.location.origin);
  const roomId = url.searchParams.get('room') || '';
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(roomId) ? roomId : '';
}

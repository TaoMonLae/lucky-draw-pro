export const roomServiceUrl = (process.env.REACT_APP_ROOM_WORKER_URL || '').trim().replace(/\/+$/, '');
export const isRoomServiceConfigured = /^https?:\/\/[^/]+$/i.test(roomServiceUrl);

function endpoint(roomId, action = '') {
  return `${roomServiceUrl}/rooms/${encodeURIComponent(roomId)}${action ? `/${action}` : ''}`;
}

export async function roomRequest(roomId, action, { method = 'GET', key = '', body } = {}) {
  if (!isRoomServiceConfigured) throw new Error('The room service is not configured.');
  const response = await fetch(endpoint(roomId, action), {
    method,
    cache: 'no-store',
    headers: {
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok && !Object.prototype.hasOwnProperty.call(result, 'accepted')) {
    const error = new Error(result.error || 'The room service request failed.');
    error.status = response.status;
    throw error;
  }
  return result;
}

export function roomSocketUrl(roomId) {
  return endpoint(roomId, 'socket').replace(/^http/i, 'ws');
}

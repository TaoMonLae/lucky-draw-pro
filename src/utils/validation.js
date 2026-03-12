export function isValidSessionData(data) {
  return !!data && typeof data === 'object' && Array.isArray(data.initialEntries);
}

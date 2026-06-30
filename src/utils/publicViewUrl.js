export function buildPublicViewUrl(currentHref) {
  const url = new URL(currentHref, window.location.origin);
  url.searchParams.set('view', 'public');
  return url.toString();
}

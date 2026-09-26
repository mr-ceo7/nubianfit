/**
 * Read and clear the ?open=<tab>&clientId=…&groupId=… parameters that notification taps
 * append, keeping any other parameters (e.g. ?portal= in development).
 */
export function consumeDeepLink(): { tab: string; clientId?: string; groupId?: string } | null {
  const url = new URL(window.location.href);
  const tab = url.searchParams.get('open');
  if (!tab) return null;
  const link = {
    tab,
    clientId: url.searchParams.get('clientId') ?? undefined,
    groupId: url.searchParams.get('groupId') ?? undefined,
  };
  ['open', 'clientId', 'groupId'].forEach(k => url.searchParams.delete(k));
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  return link;
}

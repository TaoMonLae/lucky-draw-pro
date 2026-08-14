import { useEffect, useRef } from 'react';
import { toPublicDrawState } from '../utils/realtimeRoom';

export function usePublicBroadcast(storageKey, appState, enabled = true) {
  const channelRef = useRef(null);
  const appStateRef = useRef(appState);
  const enabledRef = useRef(enabled);
  appStateRef.current = appState;
  enabledRef.current = enabled;

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const channel = new BroadcastChannel(`${storageKey}-sync`);
    const handleMessage = (event) => {
      if (event.data?.type !== 'request-public-state' || !enabledRef.current) return;
      try {
        channel.postMessage(toPublicDrawState(appStateRef.current));
      } catch (error) {
        console.error('Failed to answer public state request', error);
      }
    };
    channelRef.current = channel;
    channel.addEventListener('message', handleMessage);
    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!enabled) return;
    try {
      channelRef.current?.postMessage(toPublicDrawState(appState));
    } catch (error) {
      console.error('Failed to broadcast public draw state', error);
    }
  }, [appState, enabled]);
}

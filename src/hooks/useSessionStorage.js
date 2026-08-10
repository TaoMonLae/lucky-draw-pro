import { useEffect, useRef } from 'react';

export function useSessionStorage(key, value, enabled = true) {
  const syncChannelRef = useRef(null);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;

    const channel = new BroadcastChannel(`${key}-sync`);
    syncChannelRef.current = channel;
    return () => {
      channel.close();
      if (syncChannelRef.current === channel) syncChannelRef.current = null;
    };
  }, [key]);

  useEffect(() => {
    if (!enabled) return;

    try {
      localStorage.setItem(key, JSON.stringify(value));
      syncChannelRef.current?.postMessage(value);
    } catch (error) {
      console.error('Failed to save session to localStorage', error);
    }
  }, [enabled, key, value]);
}

import { useEffect, useState } from 'react';
import { isValidSessionData } from '../utils/validation';

export function usePublicSync(storageKey = 'lucky-draw-autosave', intervalMs = 1000) {
  const [drawState, setDrawState] = useState(null);

  useEffect(() => {
    const updateState = () => {
      try {
        const savedState = localStorage.getItem(storageKey);
        if (!savedState) return;
        const parsedState = JSON.parse(savedState);
        if (isValidSessionData(parsedState)) {
          setDrawState(parsedState);
        }
      } catch (error) {
        console.error('Failed to parse public state', error);
      }
    };

    updateState();
    window.addEventListener('storage', updateState);
    const syncChannel = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(`${storageKey}-sync`)
      : null;
    const handleChannelMessage = (event) => {
      if (isValidSessionData(event.data)) {
        setDrawState(event.data);
      }
    };
    syncChannel?.addEventListener('message', handleChannelMessage);
    const refreshInterval = setInterval(updateState, intervalMs);
    return () => {
      window.removeEventListener('storage', updateState);
      syncChannel?.removeEventListener('message', handleChannelMessage);
      syncChannel?.close();
      clearInterval(refreshInterval);
    };
  }, [storageKey, intervalMs]);

  return drawState;
}

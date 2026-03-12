import { useEffect, useState } from 'react';

export function usePublicSync(storageKey = 'lucky-draw-autosave', intervalMs = 1000) {
  const [drawState, setDrawState] = useState(null);

  useEffect(() => {
    const updateState = () => {
      try {
        const savedState = localStorage.getItem(storageKey);
        if (savedState) setDrawState(JSON.parse(savedState));
      } catch (error) {
        console.error('Failed to parse public state', error);
      }
    };

    updateState();
    window.addEventListener('storage', updateState);
    const refreshInterval = setInterval(updateState, intervalMs);
    return () => {
      window.removeEventListener('storage', updateState);
      clearInterval(refreshInterval);
    };
  }, [storageKey, intervalMs]);

  return drawState;
}

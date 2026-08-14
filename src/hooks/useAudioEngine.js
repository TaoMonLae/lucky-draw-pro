import { useEffect } from 'react';

export function useAudioEngine({ setScriptsLoaded }) {
  useEffect(() => {
    // Tone.js is bundled with the app and is ready for initialization.
    setScriptsLoaded({ tone: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

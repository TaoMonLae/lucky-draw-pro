import { useEffect } from 'react';

export function useAudioEngine({ scriptsLoaded, setScriptsLoaded, setError }) {
  useEffect(() => {
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Lobster&family=Montserrat:wght@400;700&family=Noto+Sans+Myanmar:wght@400;600;700&family=Noto+Serif+Myanmar:wght@400;600;700&family=Playfair+Display:wght@400;700&family=Roboto+Mono:wght@400;700&family=Roboto:wght@400;700&display=swap';
    document.head.appendChild(fontLink);

    const loadScript = (src, onDone) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = onDone;
      script.onerror = () => setError(`Failed to load script: ${src}`);
      document.head.appendChild(script);
    };

    if (!scriptsLoaded.htmlToImage) loadScript('https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js', () => setScriptsLoaded((s) => ({ ...s, htmlToImage: true })));
    if (!scriptsLoaded.tone) loadScript('https://cdnjs.cloudflare.com/ajax/libs/tone/14.7.77/Tone.js', () => setScriptsLoaded((s) => ({ ...s, tone: true })));
    if (!scriptsLoaded.qrcode) loadScript('https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js', () => setScriptsLoaded((s) => ({ ...s, qrcode: true })));

    return () => {
      document.head.removeChild(fontLink);
    };
  }, [scriptsLoaded.htmlToImage, scriptsLoaded.qrcode, scriptsLoaded.tone, setError, setScriptsLoaded]);
}

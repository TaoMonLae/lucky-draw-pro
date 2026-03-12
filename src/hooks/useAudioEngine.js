import { useEffect } from 'react';

export function useAudioEngine({ setScriptsLoaded }) {
  useEffect(() => {
    // Load Google Fonts (kept as CDN — fonts don't need to be bundled)
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Lobster&family=Montserrat:wght@400;700&family=Noto+Sans+Myanmar:wght@400;600;700&family=Noto+Serif+Myanmar:wght@400;600;700&family=Playfair+Display:wght@400;700&family=Roboto+Mono:wght@400;700&family=Roboto:wght@400;700&display=swap';
    document.head.appendChild(fontLink);

    // html-to-image, Tone.js and QRCode are now npm packages — mark them loaded immediately
    setScriptsLoaded({ htmlToImage: true, tone: true, qrcode: true });

    return () => {
      document.head.removeChild(fontLink);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

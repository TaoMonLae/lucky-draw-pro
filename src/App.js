import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// The import for html-to-image is removed and will be loaded via a script tag.

// --- Theme Definitions ---
const themes = {
  'Event Night': {
    '--bg-color': '#111827',
    '--text-color': '#ffffff',
    '--text-muted': '#9ca3af',
    '--panel-bg': 'rgba(17, 24, 39, 0.8)',
    '--panel-border': '#374151',
    '--input-bg': '#374151',
    '--display-bg': '#000000',
    '--display-border': '#374151',
    '--display-text': '#06b6d4',
    '--display-shadow': 'rgba(6, 182, 212, 0.7)',
    '--title-color': '#facc15',
    '--button-primary-bg': '#3b82f6',
    '--button-action-bg': '#f59e0b',
    '--confetti-colors': ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800'],
  },
  'Corporate Blue': {
    '--bg-color': '#f0f4f8',
    '--text-color': '#1e293b',
    '--text-muted': '#475569',
    '--panel-bg': 'rgba(255, 255, 255, 0.9)',
    '--panel-border': '#cbd5e1',
    '--input-bg': '#ffffff',
    '--display-bg': '#0f172a',
    '--display-border': '#d4af37',
    '--display-text': '#ffffff',
    '--display-shadow': 'rgba(212, 175, 55, 0.5)',
    '--title-color': '#0f172a',
    '--button-primary-bg': '#0f172a',
    '--button-action-bg': '#d4af37',
    '--confetti-colors': ['#0f172a', '#d4af37', '#ffffff', '#94a3b8'],
  },
  'Carnival Red': {
    '--bg-color': '#fffbeb',
    '--text-color': '#7f1d1d',
    '--text-muted': '#b91c1c',
    '--panel-bg': 'rgba(254, 252, 232, 0.9)',
    '--panel-border': '#fca5a5',
    '--input-bg': '#ffffff',
    '--display-bg': '#dc2626',
    '--display-border': '#ffffff',
    '--display-text': '#ffffff',
    '--display-shadow': 'rgba(255, 255, 255, 0.7)',
    '--title-color': '#dc2626',
    '--button-primary-bg': '#1d4ed8',
    '--button-action-bg': '#dc2626',
    '--confetti-colors': ['#dc2626', '#1d4ed8', '#ffffff', '#fef08a'],
  },
  'Neon Party': {
    '--bg-color': '#000000',
    '--text-color': '#f5f5f5',
    '--text-muted': '#a3a3a3',
    '--panel-bg': 'rgba(23, 23, 23, 0.8)',
    '--panel-border': '#ec4899',
    '--input-bg': '#171717',
    '--display-bg': '#000000',
    '--display-border': '#a855f7',
    '--display-text': '#34d399',
    '--display-shadow': 'rgba(52, 211, 153, 0.7)',
    '--title-color': '#ec4899',
    '--button-primary-bg': '#a855f7',
    '--button-action-bg': '#ec4899',
    '--confetti-colors': ['#ec4899', '#a855f7', '#34d399', '#facc15', '#0ea5e9'],
  },
};

const fonts = {
    'Sans Serif': 'sans-serif',
    'Serif': 'serif',
    'Monospace': 'monospace',
    'Montserrat': 'Montserrat',
    'Playfair Display': 'Playfair Display',
    'Roboto': 'Roboto',
    'Lobster': 'Lobster',
};

// --- Helper Components ---

const Button = ({ children, className, ...props }) => (
  <button
    className={`text-white font-bold py-2 px-4 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity shadow-lg transform active:scale-95 ${className}`}
    {...props}
  >
    {children}
  </button>
);

const Input = (props) => (
  <input
    className="border rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-[var(--button-primary-bg)] focus:outline-none shadow-sm"
    {...props}
  />
);

const ConfettiParticle = ({ colors, ...props }) => {
    return (
        <motion.div
            className="absolute rounded-full z-50"
            animate={{ y: '100vh', opacity: [1, 1, 0] }}
            transition={{ duration: Math.random() * 2 + 3, ease: "easeIn" }}
            style={{
                left: `${Math.random() * 100}vw`,
                top: `-${Math.random() * 20}vh`,
                width: `${Math.random() * 10 + 5}px`,
                height: `${Math.random() * 10 + 5}px`,
                backgroundColor: colors[Math.floor(Math.random() * colors.length)],
            }}
            {...props}
        />
    );
};

// --- Main App Component ---

export default function App() {
  const [maxDigits, setMaxDigits] = useState(2);
  const getDigits = (numOrStr) => String(numOrStr).padStart(maxDigits, '0').split('');

  // State
  const [drawing, setDrawing] = useState(false);
  const [winnersHistory, setWinnersHistory] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [currentPrize, setCurrentPrize] = useState('');
  const [initialEntries, setInitialEntries] = useState(Array.from({ length: 50 }, (_, i) => String(i + 1).padStart(2, '0')));
  const [remainingEntries, setRemainingEntries] = useState(Array.from({ length: 50 }, (_, i) => String(i + 1).padStart(2, '0')));
  const [inputValue, setInputValue] = useState("1-50");
  const [displayValue, setDisplayValue] = useState("01");
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [prizes, setPrizes] = useState([
    { id: 1, name: '3rd Prize' },
    { id: 2, name: '2nd Prize' },
    { id: 3, name: '1st Prize' },
  ]);
  const [winnersPerPrize, setWinnersPerPrize] = useState(1);
  const [drawMode, setDrawMode] = useState('numbers');
  const [scriptsLoaded, setScriptsLoaded] = useState({ htmlToImage: false, tone: false, qrcode: false });
  const [pulse, setPulse] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [winnerToExport, setWinnerToExport] = useState(null);
  const [exportAllTrigger, setExportAllTrigger] = useState(false);
  const [title, setTitle] = useState('Live Lucky Draw');
  const [subtitle, setSubtitle] = useState('The most exciting draw on the web!');
  const [titleLineSpacing, setTitleLineSpacing] = useState(1.2);
  const [subtitleLineSpacing, setSubtitleLineSpacing] = useState(1.5);
  const [titleFontSize, setTitleFontSize] = useState(48);
  const [subtitleFontSize, setSubtitleFontSize] = useState(16);
  const [titleColor, setTitleColor] = useState('');
  const [subtitleColor, setSubtitleColor] = useState('');
  const [titleFont, setTitleFont] = useState('sans-serif');
  const [subtitleFont, setSubtitleFont] = useState('sans-serif');
  const [theme, setTheme] = useState('Event Night');
  const [logo, setLogo] = useState(null);
  const [backgroundImage, setBackgroundImage] = useState('');
  const [settingsTab, setSettingsTab] = useState('main');
  const [charge, setCharge] = useState(0);
  const [isCharging, setIsCharging] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0);
  const [sfxVolume, setSfxVolume] = useState(-6);
  const [musicVolume, setMusicVolume] = useState(0);

  // Refs
  const timeoutRef = useRef(null);
  const chargeIntervalRef = useRef(null);
  const displayRef = useRef(null);
  const fileInputRef = useRef(null);
  const sessionInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const bgImageInputRef = useRef(null);
  const exportRef = useRef(null);
  const exportAllRef = useRef(null);
  const audioStarted = useRef(false);
  const almostTriggered = useRef(false);
  const sfxVolumeNode = useRef(null);
  const musicVolumeNode = useRef(null);
  const tickSynth = useRef(null);
  const winSynth = useRef(null);
  const fireworkWhoosh = useRef(null);
  const fireworkCrackle = useRef(null);
  const drumrollSynth = useRef(null);
  const applauseSynth = useRef(null);

  // --- SESSION MANAGEMENT ---
  useEffect(() => {
    const appState = {
        initialEntries, remainingEntries, winnersHistory,
        prizes, winnersPerPrize, inputValue, maxDigits, theme, logo,
        title, subtitle, titleLineSpacing, subtitleLineSpacing,
        backgroundImage, masterVolume, sfxVolume, musicVolume,
        titleColor, subtitleColor, titleFont, subtitleFont,
        titleFontSize, subtitleFontSize, drawMode
    };
    try {
        localStorage.setItem('lucky-draw-autosave', JSON.stringify(appState));
    } catch (e) {
        console.error("Failed to save session to localStorage", e);
    }
  }, [
    initialEntries, remainingEntries, winnersHistory, prizes,
    inputValue, maxDigits, theme, logo, title, subtitle, titleLineSpacing, 
    subtitleLineSpacing, winnersPerPrize, backgroundImage, masterVolume, 
    sfxVolume, musicVolume, titleColor, subtitleColor, titleFont, subtitleFont,
    titleFontSize, subtitleFontSize, drawMode
  ]);

  const restoreSession = (data) => {
    try {
        if (!data || typeof data !== 'object' || !Array.isArray(data.initialEntries)) {
            throw new Error("Invalid session data structure.");
        }
        setInitialEntries(data.initialEntries || []);
        setRemainingEntries(data.remainingEntries || []);
        setWinnersHistory(data.winnersHistory || []);
        setPrizes(data.prizes || [{ id: 1, name: '3rd Prize' }, { id: 2, name: '2nd Prize' }, { id: 3, name: '1st Prize' }]);
        setInputValue(data.inputValue || '1-50');
        const restoredMaxDigits = data.maxDigits || 2;
        setMaxDigits(restoredMaxDigits);
        setTitle(data.title || 'Live Lucky Draw');
        setSubtitle(data.subtitle || 'The most exciting draw on the web!');
        setTitleLineSpacing(data.titleLineSpacing || 1.2);
        setSubtitleLineSpacing(data.subtitleLineSpacing || 1.5);
        setTitleFontSize(data.titleFontSize || 48);
        setSubtitleFontSize(data.subtitleFontSize || 16);
        setWinnersPerPrize(data.winnersPerPrize || 1);
        setTheme(data.theme || 'Event Night');
        setLogo(data.logo || null);
        setBackgroundImage(data.backgroundImage || '');
        setMasterVolume(data.masterVolume ?? 0);
        setSfxVolume(data.sfxVolume ?? -6);
        setMusicVolume(data.musicVolume ?? 0);
        setTitleColor(data.titleColor || '');
        setSubtitleColor(data.subtitleColor || '');
        setTitleFont(data.titleFont || 'sans-serif');
        setSubtitleFont(data.subtitleFont || 'sans-serif');
        setDrawMode(data.drawMode || 'numbers');
        const firstEntry = (data.remainingEntries && data.remainingEntries[0]) || (data.initialEntries && data.initialEntries[0]) || '1';
        setDisplayValue(firstEntry);
        setSuccessMessage('Session restored successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
        setError('Invalid or corrupted session file.');
        setTimeout(() => setError(''), 3000);
    }
  };

  // Script and Audio Setup
  useEffect(() => {
    const loadScript = (src, onDone) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = onDone;
        script.onerror = () => setError(`Failed to load script: ${src}`);
        document.head.appendChild(script);
        return () => document.head.removeChild(script);
    };
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.min.js', () => setScriptsLoaded(s => ({...s, htmlToImage: true})));
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/tone/14.7.77/Tone.js', () => setScriptsLoaded(s => ({...s, tone: true})));
  }, []);

  useEffect(() => {
    if (scriptsLoaded.tone && !tickSynth.current) {
        sfxVolumeNode.current = new window.Tone.Volume(sfxVolume).toDestination();
        musicVolumeNode.current = new window.Tone.Volume(musicVolume).toDestination();
        
        tickSynth.current = new window.Tone.MembraneSynth().connect(sfxVolumeNode.current);
        fireworkWhoosh.current = new window.Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.005, decay: 0.3, sustain: 0 } }).connect(sfxVolumeNode.current);
        fireworkCrackle.current = new window.Tone.MetalSynth({ frequency: 200, envelope: { attack: 0.001, decay: 0.1, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).connect(sfxVolumeNode.current);
        drumrollSynth.current = new window.Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 2, envelope: { attack: 0.001, decay: 0.1, sustain: 0 } }).connect(sfxVolumeNode.current);
        
        winSynth.current = new window.Tone.PolySynth(window.Tone.Synth).connect(musicVolumeNode.current);
        applauseSynth.current = new window.Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0 }}).connect(sfxVolumeNode.current);
    }
  }, [scriptsLoaded.tone, sfxVolume, musicVolume]);

  useEffect(() => {
    if(window.Tone) {
        window.Tone.Destination.volume.value = masterVolume;
    }
  }, [masterVolume]);

  useEffect(() => {
    if(sfxVolumeNode.current) sfxVolumeNode.current.volume.value = sfxVolume;
  }, [sfxVolume]);

  useEffect(() => {
    if(musicVolumeNode.current) musicVolumeNode.current.volume.value = musicVolume;
  }, [musicVolume]);

  // Logic Functions
  const getPrizeName = () => {
    if (winnersHistory.length >= prizes.length) return "All prizes drawn!";
    return prizes[winnersHistory.length].name;
  };

  const processEntries = (entries) => {
    if (entries.length > 0) {
        if (drawMode === 'numbers') {
            const maxLength = entries.reduce((max, entry) => Math.max(max, entry.length), 0);
            setMaxDigits(maxLength);
            const paddedEntries = entries.map(t => t.padStart(maxLength, '0'));
            setInitialEntries(paddedEntries);
            resetDraw(paddedEntries, maxLength);
        } else {
            setInitialEntries(entries);
            resetDraw(entries);
        }
    }
  };

  const updateEntries = () => {
    setError('');
    let newEntries = [];
    if (drawMode === 'numbers') {
        const input = inputValue.trim();
        if (input.includes('-') && !input.includes(',')) {
            const parts = input.split('-').map(p => p.trim());
            if (parts.length !== 2) { setError('Invalid range format. Please use "start-end".'); return; }
            const startStr = parts[0];
            const endStr = parts[1];
            const startNum = parseInt(startStr, 10);
            const endNum = parseInt(endStr, 10);
            if (isNaN(startNum) || isNaN(endNum) || startNum >= endNum) { setError('Invalid range. Start must be less than end.'); return; }
            const padding = startStr.length;
            if (padding > 10) { setError('Ticket numbers cannot exceed 10 digits.'); return; }
            if (endNum - startNum + 1 > 40000) { setError('Range is too large. Please use a range of 40,000 tickets or less.'); return; }
            newEntries = Array.from({ length: endNum - startNum + 1 }, (_, i) => String(startNum + i).padStart(padding, '0'));
        } else {
            newEntries = Array.from(new Set(inputValue.split(',').map(s => s.trim()).filter(s => s.length > 0)));
        }
    } else { // Names mode
        newEntries = Array.from(new Set(inputValue.split(',').map(s => s.trim()).filter(s => s.length > 0)));
    }
    
    if (newEntries.length < 1) { setError('Please provide at least one valid entry.'); return; }
    if (newEntries.length > 40000) { setError('Too many entries. Please provide 40,000 or less.'); return; }
    processEntries(newEntries);
  };

  const resetDraw = (entriesToUse = initialEntries, newMaxDigits = maxDigits) => {
    setRemainingEntries(entriesToUse);
    setWinnersHistory([]);
    const firstEntry = entriesToUse[0] || (drawMode === 'numbers' ? '1' : 'Winner');
    setDisplayValue(firstEntry);
    setError('');
    setShowConfetti(false);
  };
  
  const handleUndo = () => {
    if (winnersHistory.length === 0 || drawing) return;
    const lastWinnerGroup = winnersHistory[winnersHistory.length - 1];
    setWinnersHistory(winnersHistory.slice(0, -1));
    setRemainingEntries([...remainingEntries, ...lastWinnerGroup.tickets].sort());
    setDisplayValue(lastWinnerGroup.tickets[0]);
    setError('');
  };

  const handleSaveSession = () => {
    const appState = {
        initialEntries, remainingEntries, winnersHistory,
        prizes, winnersPerPrize, inputValue, maxDigits, theme, logo,
        title, subtitle, titleLineSpacing, subtitleLineSpacing,
        titleFontSize, subtitleFontSize,
        backgroundImage, masterVolume, sfxVolume, musicVolume,
        titleColor, subtitleColor, titleFont, subtitleFont, drawMode
    };
    const blob = new Blob([JSON.stringify(appState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lucky-draw-session.json';
    a.click();
    URL.revokeObjectURL(url);
  };
  
  //const handleLoadSession = (e) => {
  //  const file = e.target.files[0];
 //   if (!file) return;
//    const reader = new FileReader();
   // reader.onload = (event) => {
   //     try {
   //         restoreSession(JSON.parse(event.target.result));
 //       } catch (err) {
 //           setError('Invalid or corrupted session file.');
  ///          setTimeout(() => setError(''), 3000);
   //     }
  //  };
 //   reader.readAsText(file);
//    e.target.value = null;
//  };
  
  const handleFileImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const entries = event.target.result.split('\n').map(t => t.trim()).filter(Boolean);
        setInputValue(entries.join(', '));
        processEntries(entries);
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            setLogo(event.target.result);
        };
        reader.readAsDataURL(file);
    }
  };
  
  const handleBgImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            setBackgroundImage(event.target.result);
        };
        reader.readAsDataURL(file);
    }
  };
  
  const playDrumroll = () => {
    if (drumrollSynth.current) {
        const now = window.Tone.now();
        drumrollSynth.current.triggerAttack("C2", now);
        drumrollSynth.current.triggerAttack("C2", now + 0.05);
        drumrollSynth.current.triggerAttack("G1", now + 0.1);
        drumrollSynth.current.triggerAttack("C2", now + 0.15);
        drumrollSynth.current.triggerAttack("G1", now + 0.2);
    }
  };

  const playApplause = () => {
    if (applauseSynth.current) {
        for (let i = 0; i < 20; i++) {
            applauseSynth.current.triggerAttackRelease('8n', `+${i * 0.03}`);
        }
    }
  };

  const startCharging = async () => {
    if (drawing || remainingEntries.length === 0 || winnersHistory.length >= prizes.length) return;
    
    if (scriptsLoaded.tone && !audioStarted.current) {
        await window.Tone.start();
        audioStarted.current = true;
    }

    setIsCharging(true);
    chargeIntervalRef.current = setInterval(() => {
        setCharge(prev => {
            const newCharge = prev + 2;
            if (tickSynth.current) {
                const pitch = 40 + (newCharge * 1.5);
                tickSynth.current.triggerAttackRelease(pitch, "8n");
            }
            if (newCharge >= 100) {
                clearInterval(chargeIntervalRef.current);
                setIsCharging(false);
                setCharge(0);
                drawNextWinner();
                return 100;
            }
            return newCharge;
        });
    }, 30);
  };

  const stopCharging = () => {
    clearInterval(chargeIntervalRef.current);
    setIsCharging(false);
    setCharge(0);
  };

  const runSingleWinnerAnimation = (winnerEntry, isFinalWinnerOfBatch) => {
    return new Promise((resolve) => {
        const isFinalPrize = winnersHistory.length + 1 === prizes.length;
        const slowMoDuration = isFinalPrize && isFinalWinnerOfBatch ? 14000 : 4000;
        
        const animationStart = Date.now();
        
        if (drawMode === 'names') {
            const nameAnimationLoop = () => {
                const elapsed = Date.now() - animationStart;
                if (elapsed >= slowMoDuration) {
                    setDisplayValue(winnerEntry);
                    resolve();
                    return;
                }
                setDisplayValue(initialEntries[Math.floor(Math.random() * initialEntries.length)]);
                if (tickSynth.current) tickSynth.current.triggerAttackRelease("C1", "8n");
                const progress = elapsed / slowMoDuration;
                const easing = 1 - Math.pow(1 - progress, 2);
                const nextDelay = 50 + easing * 400;
                timeoutRef.current = setTimeout(nameAnimationLoop, nextDelay);
            };
            nameAnimationLoop();
        } else {
            const winnerDigits = getDigits(winnerEntry);
            const lockTimings = Array.from({ length: maxDigits - 1 }, (_, i) => 800 + i * 400);
            const slowMoStartTime = lockTimings[lockTimings.length - 1] || 800;
            
            const animationLoop = () => {
                const elapsed = Date.now() - animationStart;
                let nextDelay = 75;

                if (elapsed < slowMoStartTime) {
                    const newDisplayDigits = winnerDigits.map((digit, index) => {
                        if (index >= maxDigits - 1) return Math.floor(Math.random() * 10);
                        if (elapsed >= lockTimings[index]) return digit;
                        return Math.floor(Math.random() * 10);
                    });
                    setDisplayValue(newDisplayDigits.join(''));
                    if (tickSynth.current) tickSynth.current.triggerAttackRelease("C1", "8n");
                } else {
                    const slowMoElapsed = elapsed - slowMoStartTime;
                    if (slowMoElapsed >= slowMoDuration) {
                        setDisplayValue(winnerDigits.join(''));
                        resolve();
                        return;
                    }
                    
                    if (isFinalPrize && slowMoElapsed >= slowMoDuration - 2000 && !almostTriggered.current) {
                        almostTriggered.current = true;
                        let fakeDigit = Math.floor(Math.random() * 10);
                        const finalWinnerDigit = parseInt(winnerDigits[maxDigits - 1], 10);
                        while (fakeDigit === finalWinnerDigit) {
                            fakeDigit = Math.floor(Math.random() * 10);
                        }
                        
                        const newDisplayDigits = [...winnerDigits];
                        newDisplayDigits[maxDigits - 1] = fakeDigit;
                        setDisplayValue(newDisplayDigits.join(''));
        
                        timeoutRef.current = setTimeout(() => {
                            timeoutRef.current = setTimeout(animationLoop, 50);
                        }, 800);
                        return;
                    }

                    const newDisplayDigits = [...winnerDigits];
                    const finalDigitIndex = maxDigits - 1;
                    const progress = slowMoElapsed / slowMoDuration;
                    const easing = 1 - Math.pow(1 - progress, 2);
                    const totalSteps = 10;
                    const currentStep = Math.floor(easing * totalSteps);
                    const finalDigit = parseInt(winnerDigits[finalDigitIndex], 10);
                    newDisplayDigits[finalDigitIndex] = (finalDigit + totalSteps - currentStep) % 10;
                    setDisplayValue(newDisplayDigits.join(''));
                    
                    if (tickSynth.current) tickSynth.current.triggerAttackRelease("C1", "8n");
                    nextDelay = 50 + easing * 400;
                }
                timeoutRef.current = setTimeout(animationLoop, nextDelay);
            };
            animationLoop();
        }
    });
  };

  const drawNextWinner = async () => {
    const numToDraw = Math.min(winnersPerPrize, remainingEntries.length);
    if (drawing || numToDraw === 0 || winnersHistory.length >= prizes.length) {
        if (remainingEntries.length === 0) setError('All entries have been drawn!');
        if (winnersHistory.length >= prizes.length) setError('All prizes have been awarded!');
        return;
    }

    setDrawing(true);
    setError('');
    setShowConfetti(false);
    setPulse(true);
    
    const currentPrizeName = getPrizeName();
    setCurrentPrize(currentPrizeName);

    const drawnTickets = [];
    let tempRemaining = [...remainingEntries];
    for(let i = 0; i < numToDraw; i++) {
        const winnerIndex = Math.floor(Math.random() * tempRemaining.length);
        drawnTickets.push(tempRemaining.splice(winnerIndex, 1)[0]);
    }

    for (let i = 0; i < drawnTickets.length; i++) {
        const ticket = drawnTickets[i];
        const isFinalWinnerOfBatch = i === drawnTickets.length - 1;
        await runSingleWinnerAnimation(ticket, isFinalWinnerOfBatch);
        if (isFinalWinnerOfBatch) {
             const isFinalPrize = winnersHistory.length + 1 === prizes.length;
             if (winSynth.current) {
                const now = window.Tone.now();
                if (isFinalPrize) {
                    fireworkWhoosh.current.triggerAttack(now);
                    for(let i = 0; i < 10; i++) {
                       fireworkCrackle.current.triggerAttackRelease("16n", now + 0.3 + Math.random() * 0.5);
                    }
                    winSynth.current.triggerAttackRelease(["C4", "G4", "C5", "E5"], "2s", now + 0.8);
                    winSynth.current.triggerAttackRelease(["F4", "A4", "C5", "F5"], "2s", now + 1.8);
                    winSynth.current.triggerAttackRelease(["G4", "B4", "D5", "G5"], "3s", now + 2.8);
                } else {
                    winSynth.current.triggerAttackRelease(["C4", "E4", "G4"], "1s");
                }
            }
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 5000);
        } else {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Pause between reveals
        }
    }

    const newHistory = [...winnersHistory, { prize: currentPrizeName, tickets: drawnTickets }];
    setWinnersHistory(newHistory);
    setRemainingEntries(tempRemaining);
    setDrawing(false);
  };

  useEffect(() => {
    if (winnerToExport && exportRef.current && window.htmlToImage) {
        const exportImage = async () => {
            try {
                const dataUrl = await window.htmlToImage.toPng(exportRef.current, {
                    style: { margin: '0', padding: '0' },
                    width: 500,
                    height: 300,
                });
                const link = document.createElement('a');
                link.download = `${winnerToExport.prize.replace(' ', '-')}-winner-${winnerToExport.ticket}.png`;
                link.href = dataUrl;
                link.click();
            } catch (err) {
                console.error('Failed to export image', err);
            } finally {
                setWinnerToExport(null);
            }
        };
        exportImage();
    }
  }, [winnerToExport]);

  useEffect(() => {
    if (exportAllTrigger && exportAllRef.current && window.htmlToImage) {
        const exportAllImage = async () => {
             try {
                const dataUrl = await window.htmlToImage.toPng(exportAllRef.current, {
                    quality: 0.95,
                    backgroundColor: themes[theme]['--bg-color'],
                });
                const link = document.createElement('a');
                link.download = `all-winners-${title.replace(/\s/g, '-')}.png`;
                link.href = dataUrl;
                link.click();
            } catch (err) {
                console.error('Failed to export all winners image', err);
            } finally {
                setExportAllTrigger(false);
            }
        };
        exportAllImage();
    }
  }, [exportAllTrigger, theme, title, logo, winnersHistory]);
  
  useEffect(() => {
    return () => {
        clearTimeout(timeoutRef.current);
        clearInterval(chargeIntervalRef.current);
    };
  }, []);

  const currentTheme = themes[theme];
  const mainStyle = {
    ...currentTheme,
    backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  return (
    <div style={mainStyle} className="relative flex flex-col items-center justify-center min-h-screen text-[var(--text-color)] p-4 gap-6 font-sans overflow-hidden transition-all duration-500 bg-[var(--bg-color)]">
      <AnimatePresence>
        {showConfetti && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{duration: 0.5}}
            className="absolute inset-0 z-40"
            style={{ background: 'radial-gradient(circle at center, transparent 40%, rgba(0,0,0,0.7) 80%)' }}
          />
        )}
      </AnimatePresence>
      {showConfetti && Array.from({ length: 150 }).map((_, i) => <ConfettiParticle key={i} colors={currentTheme['--confetti-colors']} />)}
      
       {logo && <img src={logo} alt="Event Logo" className="absolute top-4 left-4 h-16 w-auto z-30" />}
       
       {successMessage && (
        <div className="absolute top-0 left-0 right-0 bg-green-600 text-white p-2 flex justify-center items-center gap-4 z-50">
            <span>{successMessage}</span>
            <Button onClick={() => setSuccessMessage('')} className="!bg-transparent !text-white text-lg !py-0 !px-2">&times;</Button>
        </div>
       )}
       {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-600 text-white p-2 flex justify-center items-center gap-4 z-50">
            <span>Error: {error}</span>
            <Button onClick={() => setError('')} className="!bg-transparent !text-white text-lg !py-0 !px-2">&times;</Button>
        </div>
       )}

       <Button onClick={() => setShowSettings(true)} className="absolute top-4 right-4 z-30 !bg-gray-700 hover:!bg-gray-600">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2.73l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2.73l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
      </Button>

      <AnimatePresence>
        {showSettings && (
            <motion.div 
                initial={{x: '100%'}}
                animate={{x: 0}}
                exit={{x: '100%'}}
                transition={{type: 'spring', stiffness: 300, damping: 30}}
                className="absolute top-0 right-0 h-full w-full max-w-md bg-[var(--panel-bg)] backdrop-blur-sm shadow-2xl z-50 border-l border-[var(--panel-border)] flex flex-col"
            >
                <div className="flex-shrink-0 p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-[var(--title-color)]">Settings</h2>
                        <Button onClick={() => setShowSettings(false)} style={{backgroundColor: '#dc2626'}}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </Button>
                    </div>
                    <div className="flex border-b border-[var(--panel-border)] mb-4">
                        <button className={`py-2 px-4 ${settingsTab === 'main' ? 'border-b-2 border-[var(--title-color)] text-[var(--title-color)]' : 'text-[var(--text-muted)]'}`} onClick={() => setSettingsTab('main')}>Main</button>
                        <button className={`py-2 px-4 ${settingsTab === 'sound' ? 'border-b-2 border-[var(--title-color)] text-[var(--title-color)]' : 'text-[var(--text-muted)]'}`} onClick={() => setSettingsTab('sound')}>Sound</button>
                        <button className={`py-2 px-4 ${settingsTab === 'about' ? 'border-b-2 border-[var(--title-color)] text-[var(--title-color)]' : 'text-[var(--text-muted)]'}`} onClick={() => setSettingsTab('about')}>About</button>
                    </div>
                </div>
                
                <div className="flex-grow overflow-y-auto px-6 pb-6">
                    {settingsTab === 'main' && (
                        <div className="space-y-6">
                            <div>
                                <label className="font-semibold text-sm mb-1 block">Theme</label>
                                <select value={theme} onChange={(e) => setTheme(e.target.value)} className="w-full p-2 rounded-lg bg-[var(--input-bg)] border border-[var(--panel-border)]">
                                    {Object.keys(themes).map(themeName => (<option key={themeName} value={themeName}>{themeName}</option>))}
                                </select>
                            </div>
                            <div>
                                <label className="font-semibold text-sm mb-1 block">Event Title</label>
                                <div className="flex items-center gap-2">
                                    <Input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" disabled={drawing} />
                                    <input type="color" value={titleColor || themes[theme]['--title-color']} onChange={e => setTitleColor(e.target.value)} className="w-10 h-10 p-1 bg-transparent border-none cursor-pointer" />
                                </div>
                                <label className="text-xs mt-1 block">Font Family</label>
                                <select value={titleFont} onChange={e => setTitleFont(e.target.value)} className="w-full p-2 rounded-lg bg-[var(--input-bg)] border border-[var(--panel-border)] text-sm">
                                    {Object.keys(fonts).map(fontName => (<option key={fontName} value={fonts[fontName]}>{fontName}</option>))}
                                </select>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs mt-1 block">Font Size (px)</label>
                                        <Input type="number" value={titleFontSize} onChange={e => setTitleFontSize(parseInt(e.target.value, 10) || 16)} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" />
                                    </div>
                                    <div>
                                        <label className="text-xs mt-1 block">Line Spacing</label>
                                        <Input type="number" step="0.1" value={titleLineSpacing} onChange={e => setTitleLineSpacing(e.target.value)} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="font-semibold text-sm mb-1 block">Event Subtitle</label>
                                 <div className="flex items-center gap-2">
                                    <Input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" disabled={drawing} />
                                    <input type="color" value={subtitleColor || themes[theme]['--text-muted']} onChange={e => setSubtitleColor(e.target.value)} className="w-10 h-10 p-1 bg-transparent border-none cursor-pointer" />
                                </div>
                                <label className="text-xs mt-1 block">Font Family</label>
                                <select value={subtitleFont} onChange={e => setSubtitleFont(e.target.value)} className="w-full p-2 rounded-lg bg-[var(--input-bg)] border border-[var(--panel-border)] text-sm">
                                    {Object.keys(fonts).map(fontName => (<option key={fontName} value={fonts[fontName]}>{fontName}</option>))}
                                </select>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs mt-1 block">Font Size (px)</label>
                                        <Input type="number" value={subtitleFontSize} onChange={e => setSubtitleFontSize(parseInt(e.target.value, 10) || 16)} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" />
                                    </div>
                                    <div>
                                        <label className="text-xs mt-1 block">Line Spacing</label>
                                        <Input type="number" step="0.1" value={subtitleLineSpacing} onChange={e => setSubtitleLineSpacing(e.target.value)} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="font-semibold text-sm mb-1 block">Ticket Numbers</label>
                                <div className="flex items-center gap-2">
                                    <Input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="e.g., 001-100 or 001, 007" className="flex-grow bg-[var(--input-bg)] border-[var(--panel-border)]" disabled={drawing} />
                                    <Button onClick={updateEntries} disabled={drawing} className="flex-shrink-0" style={{backgroundColor: 'var(--button-primary-bg)'}}>Set</Button>
                                </div>
                                <Button onClick={() => fileInputRef.current && fileInputRef.current.click()} disabled={drawing} className="w-full mt-2 text-sm !bg-gray-600 hover:!bg-gray-700">Load from File (.txt)</Button>
                                <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".txt" className="hidden" />
                            </div>
                            <div>
                                <label className="font-semibold text-sm mb-1 block">Prizes</label>
                                {prizes.map((prize, index) => (
                                    <div key={prize.id} className="flex items-center gap-2 mb-2">
                                        <Input type="text" value={prize.name} onChange={e => {
                                            const newPrizes = [...prizes];
                                            newPrizes[index].name = e.target.value;
                                            setPrizes(newPrizes);
                                        }} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" />
                                        <Button onClick={() => setPrizes(prizes.filter(p => p.id !== prize.id))} className="!bg-red-600 text-xs !p-2">X</Button>
                                    </div>
                                ))}
                                <Button onClick={() => setPrizes([...prizes, {id: Date.now(), name: `New Prize`}])} className="w-full text-sm !bg-gray-600 hover:!bg-gray-700">Add Prize</Button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="winners-per-prize" className="font-semibold text-sm mb-1 block">Winners per Prize</label>
                                    <Input id="winners-per-prize" type="number" value={winnersPerPrize} onChange={(e) => setWinnersPerPrize(Math.max(1, parseInt(e.target.value, 10) || 1))} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" disabled={drawing} min="1" />
                                </div>
                            </div>
                            <div>
                                <label className="font-semibold text-sm mb-1 block">Custom Background</label>
                                <div className="flex items-center gap-2 mt-2">
                                    <Button onClick={() => bgImageInputRef.current && bgImageInputRef.current.click()} disabled={drawing} className="w-full text-sm !bg-gray-600 hover:!bg-gray-700">Upload Image</Button>
                                    <Button onClick={() => setBackgroundImage('')} disabled={drawing || !backgroundImage} className="w-full text-sm !bg-gray-600 hover:!bg-gray-700">Remove Image</Button>
                                </div>
                                <input type="file" ref={bgImageInputRef} onChange={handleBgImageUpload} accept="image/*" className="hidden" />
                            </div>
                            <div>
                                <label className="font-semibold text-sm mb-1 block">Logo</label>
                                <div className="flex items-center gap-2">
                                    <Button onClick={() => logoInputRef.current && logoInputRef.current.click()} disabled={drawing} className="w-full text-sm !bg-gray-600 hover:!bg-gray-700">Upload Logo</Button>
                                    <Button onClick={() => setLogo(null)} disabled={drawing || !logo} className="w-full text-sm !bg-gray-600 hover:!bg-gray-700">Remove</Button>
                                </div>
                                <input type="file" ref={logoInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--panel-border)]">
                                <Button onClick={handleSaveSession} disabled={drawing} className="w-full !bg-green-600 hover:!bg-green-700">Save Session</Button>
                                <Button onClick={() => sessionInputRef.current && sessionInputRef.current.click()} disabled={drawing} className="w-full !bg-purple-600 hover:!bg-purple-700">Load Session</Button>
                            </div>
                        </div>
                    )}
                    {settingsTab === 'sound' && (
                        <div className="space-y-6">
                            <div>
                                <label className="font-semibold text-sm mb-1 block">Master Volume ({masterVolume} dB)</label>
                                <input type="range" min="-40" max="6" step="1" value={masterVolume} onChange={e => setMasterVolume(e.target.value)} className="w-full" />
                            </div>
                            <div>
                                <label className="font-semibold text-sm mb-1 block">Sound Effects Volume ({sfxVolume} dB)</label>
                                <input type="range" min="-40" max="6" step="1" value={sfxVolume} onChange={e => setSfxVolume(e.target.value)} className="w-full" />
                            </div>
                            <div>
                                <label className="font-semibold text-sm mb-1 block">Music Volume ({musicVolume} dB)</label>
                                <input type="range" min="-40" max="6" step="1" value={musicVolume} onChange={e => setMusicVolume(e.target.value)} className="w-full" />
                            </div>
                            <div className="pt-4 border-t border-[var(--panel-border)]">
                                <h3 className="text-lg font-bold text-[var(--text-color)] mb-2">Soundboard</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <Button onClick={playDrumroll} disabled={drawing} style={{backgroundColor: 'var(--button-primary-bg)'}}>Drumroll</Button>
                                    <Button onClick={playApplause} disabled={drawing} style={{backgroundColor: 'var(--button-primary-bg)'}}>Applause</Button>
                                </div>
                            </div>
                        </div>
                    )}
                    {settingsTab === 'about' && (
                        <div className="space-y-4 text-[var(--text-muted)]">
                            <h3 className="text-xl font-bold text-[var(--text-color)]">Lucky Draw Pro</h3>
                            <p>Version 1.9.0</p>
                            <p>A fully customizable application for running exciting live lucky draws for any event. This tool is designed for reliability and high audience engagement.</p>
                            <p className="pt-4">Created by: <span className="font-bold text-[var(--text-color)]">Tao Mon Lae</span></p>
                        </div>
                    )}
                </div>
            </motion.div>
        )}
      </AnimatePresence>
      
      <div className="text-center z-10" style={{textShadow: '0 2px 4px rgba(0,0,0,0.5)'}}>
        <h1 className="font-bold" style={{color: titleColor || 'var(--title-color)', lineHeight: titleLineSpacing, fontFamily: titleFont, fontSize: `${titleFontSize}px`}}>{title}</h1>
        <p className="mt-2" style={{color: subtitleColor || 'var(--text-muted)', lineHeight: subtitleLineSpacing, fontFamily: subtitleFont, fontSize: `${subtitleFontSize}px`}}>{subtitle}</p>
      </div>

      <div className="flex flex-col items-center z-20">
        <AnimatePresence>
            {drawing && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="text-2xl font-bold mb-2" style={{color: 'var(--title-color)'}}>
                    Now Drawing: {currentPrize}
                </motion.div>
            )}
        </AnimatePresence>
        <motion.div 
            ref={displayRef} 
            className="w-full max-w-sm h-40 rounded-2xl shadow-inner flex items-center justify-center p-4 border-4"
            style={{backgroundColor: 'var(--display-bg)', borderColor: 'var(--display-border)'}}
            animate={pulse ? {boxShadow: ['0 0 0px #fff', '0 0 40px #fff', '0 0 0px #fff']} : {}}
            transition={pulse ? {duration: 0.8, ease: 'easeInOut'} : {}}
            onAnimationComplete={() => setPulse(false)}
        >
            {drawMode === 'numbers' ? (
                <div className="flex text-7xl md:text-8xl font-mono font-bold tracking-widest" style={{color: 'var(--display-text)', textShadow: `0 0 20px ${currentTheme['--display-shadow']}`}}>
                    {getDigits(displayValue).map((digit, index) => (
                        <div key={index} className="w-[1ch] text-center overflow-hidden">
                            <AnimatePresence mode="popLayout">
                                <motion.span key={digit + '-' + index} initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} transition={{ duration: 0.2 }}>
                                    {digit === ' ' ? '\u00A0' : digit}
                                </motion.span>
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            ) : (
                 <div className="text-4xl md:text-5xl font-bold px-4 text-center" style={{color: 'var(--display-text)', textShadow: `0 0 20px ${currentTheme['--display-shadow']}`}}>
                    <AnimatePresence mode="popLayout">
                        <motion.span key={displayValue} initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} transition={{ duration: 0.2 }}>
                            {displayValue}
                        </motion.span>
                    </AnimatePresence>
                </div>
            )}
        </motion.div>
      </div>

      <div className="flex flex-col items-center gap-2 z-20">
        <div className="font-semibold">Prizes Drawn: {winnersHistory.length} / {prizes.length}</div>
        <div className="text-sm" style={{color: 'var(--text-muted)'}}>{remainingEntries.length} / {initialEntries.length} Entries Remaining</div>
        <div className="relative w-full max-w-xs mt-2">
            <AnimatePresence>
            {isCharging && (
                <motion.div
                    className="absolute bottom-full left-0 right-0 mb-2 h-4 rounded-full"
                    style={{backgroundColor: 'var(--panel-border)'}}
                    initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}
                >
                    <motion.div 
                        className="h-4 rounded-full"
                        style={{backgroundColor: 'var(--button-action-bg)'}}
                        initial={{width: 0}}
                        animate={{width: `${charge}%`}}
                        transition={{duration: 0.1, ease: 'linear'}}
                    />
                </motion.div>
            )}
            </AnimatePresence>
            <Button 
                onMouseDown={startCharging}
                onMouseUp={stopCharging}
                onMouseLeave={stopCharging}
                onTouchStart={startCharging}
                onTouchEnd={stopCharging}
                disabled={drawing || remainingEntries.length === 0 || winnersHistory.length >= prizes.length} 
                className="w-full px-10 py-4 text-xl text-black" 
                style={{backgroundColor: 'var(--button-action-bg)'}}
            >
              {isCharging ? "Charging..." : "Hold to Draw"}
            </Button>
        </div>
      </div>
      
      {winnersHistory.length > 0 && (
          <div className="w-full max-w-md bg-[var(--panel-bg)] backdrop-blur-sm p-4 rounded-xl shadow-lg mt-4 z-10 border border-[var(--panel-border)]">
              <h2 className="text-2xl font-bold text-center mb-4" style={{color: 'var(--title-color)'}}>Draw History</h2>
              <ul className="space-y-2">
                  {winnersHistory.slice().reverse().map((winnerGroup) => (
                      <li key={winnerGroup.prize} className="p-3 rounded-lg" style={{backgroundColor: 'var(--display-bg)'}}>
                          <span className="font-bold text-lg">{winnerGroup.prize}:</span>
                          <div className="pl-4 mt-1 space-y-1">
                            {winnerGroup.tickets.map(ticket => (
                                <div key={ticket} className="flex justify-between items-center">
                                    <span className="font-mono" style={{color: 'var(--display-text)'}}>{ticket}</span>
                                    <Button onClick={() => setWinnerToExport({prize: winnerGroup.prize, ticket})} disabled={!scriptsLoaded.htmlToImage} className="text-xs py-1 px-2" style={{backgroundColor: 'var(--button-primary-bg)'}}>
                                        {scriptsLoaded.htmlToImage ? 'Export' : '...'}
                                    </Button>
                                </div>
                            ))}
                          </div>
                      </li>
                  ))}
              </ul>
              <div className="flex justify-center items-center gap-4 mt-4">
                <Button onClick={handleUndo} disabled={drawing || winnersHistory.length === 0} className="!bg-red-600 hover:!bg-red-700">Undo Last Draw</Button>
                <Button onClick={() => setExportAllTrigger(true)} disabled={drawing || winnersHistory.length === 0} className="!bg-green-600 hover:!bg-green-700">Export All</Button>
                <Button onClick={() => resetDraw()} disabled={drawing} style={{backgroundColor: 'var(--button-primary-bg)'}}>Reset Draw</Button>
              </div>
          </div>
      )}

      {/* Hidden components for PNG export */}
      <div className="absolute -left-full -top-full">
         <div ref={exportRef}>
            {winnerToExport && (
                 <div style={{width: 500, height: 300, ...themes[theme]}} className="flex flex-col items-center justify-center p-8 relative bg-[var(--display-bg)] text-[var(--text-color)]">
                     {logo && <img src={logo} alt="Logo" className="absolute top-4 left-4 h-12 w-auto" />}
                     <h3 className="text-4xl font-bold" style={{color: 'var(--title-color)'}}>{winnerToExport.prize}</h3>
                     <div className="text-8xl font-mono font-bold my-4" style={{color: 'var(--display-text)'}}>{winnerToExport.ticket}</div>
                     <p className="text-xl" style={{color: 'var(--text-muted)'}}>Congratulations!</p>
                 </div>
            )}
         </div>
         <div ref={exportAllRef}>
            {exportAllTrigger && (
                 <div style={{...themes[theme]}} className="p-8 bg-[var(--bg-color)] text-[var(--text-color)]">
                     {logo && <img src={logo} alt="Logo" className="h-20 w-auto mb-6" />}
                     <h2 className="text-4xl font-bold mb-6" style={{color: 'var(--title-color)'}}>{title} - Winners</h2>
                     <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                        {winnersHistory.map(group => (
                            <div key={group.prize}>
                                <h3 className="text-2xl font-bold border-b-2" style={{borderColor: 'var(--panel-border)'}}>{group.prize}</h3>
                                <ul className="mt-2 space-y-1">
                                    {group.tickets.map(ticket => <li key={ticket} className="font-mono text-xl" style={{color: 'var(--display-text)'}}>{ticket}</li>)}
                                </ul>
                            </div>
                        ))}
                     </div>
                 </div>
            )}
         </div>
      </div>
    </div>
  );
}

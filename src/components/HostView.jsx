import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { themes, fonts } from '../utils/themeConfig';
import { Button, Input, ConfettiParticle } from './ui';
import SettingsPanel from './SettingsPanel';
import PrizeEditor from './PrizeEditor';
import DrawDisplay from './DrawDisplay';
import { useSessionStorage } from '../hooks/useSessionStorage';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { parseEntries } from '../utils/parseEntries';
import { downloadJson } from '../utils/exportUtils';
import { isValidSessionData } from '../utils/validation';
import { getPaddedDigits } from '../hooks/useDrawEngine';

export default function HostView() {
  const [maxDigits, setMaxDigits] = useState(2);
  const getDigits = (numOrStr) => getPaddedDigits(numOrStr, maxDigits);

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
  const [titleLetterSpacing, setTitleLetterSpacing] = useState(0);
  const [subtitleLetterSpacing, setSubtitleLetterSpacing] = useState(0);
  const [titleFontSize, setTitleFontSize] = useState(48);
  const [subtitleFontSize, setSubtitleFontSize] = useState(16);
  const [titleColor, setTitleColor] = useState('');
  const [subtitleColor, setSubtitleColor] = useState('');
  const [titleFont, setTitleFont] = useState('sans-serif');
  const [subtitleFont, setSubtitleFont] = useState('sans-serif');
  const [displayFont, setDisplayFont] = useState("'Roboto Mono', 'Noto Sans Myanmar', monospace");
  const [displayFontSize, setDisplayFontSize] = useState(92);
  const [displayLineHeight, setDisplayLineHeight] = useState(1.02);
  const [displayLetterSpacing, setDisplayLetterSpacing] = useState(0.1);
  const [displayBoxWidth, setDisplayBoxWidth] = useState(480);
  const [displayBoxHeight, setDisplayBoxHeight] = useState(180);
  const [theme, setTheme] = useState('Event Night');
  const [logo, setLogo] = useState(null);
  const [backgroundImage, setBackgroundImage] = useState('');
  const [settingsTab, setSettingsTab] = useState('main');
  const [charge, setCharge] = useState(0);
  const [isCharging, setIsCharging] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0);
  const [sfxVolume, setSfxVolume] = useState(-6);
  const [musicVolume, setMusicVolume] = useState(0);
  const [currentTime, setCurrentTime] = useState(() => new Date());

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
  const drawActionRef = useRef(() => {});
  const qrCodeRef = useRef(null);
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
  const whistleSynth = useRef(null);
  const wowSynth = useRef(null);

  const appState = {
    initialEntries, remainingEntries, winnersHistory,
    prizes, winnersPerPrize, inputValue, maxDigits, theme, logo,
    title, subtitle, titleLineSpacing, subtitleLineSpacing,
    titleLetterSpacing, subtitleLetterSpacing,
    backgroundImage, masterVolume, sfxVolume, musicVolume,
    titleColor, subtitleColor, titleFont, subtitleFont,
    titleFontSize, subtitleFontSize, drawMode,
    displayFont, displayFontSize, displayLineHeight, displayLetterSpacing,
    displayBoxWidth, displayBoxHeight
  };

  useSessionStorage('lucky-draw-autosave', appState);

  // --- SESSION MANAGEMENT ---

  const restoreSession = (data) => {
    try {
        if (!isValidSessionData(data)) {
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
        setTitleLetterSpacing(data.titleLetterSpacing ?? 0);
        setSubtitleLetterSpacing(data.subtitleLetterSpacing ?? 0);
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
        setDisplayFont(data.displayFont || "'Roboto Mono', 'Noto Sans Myanmar', monospace");
        setDisplayFontSize(data.displayFontSize || 92);
        setDisplayLineHeight(data.displayLineHeight || 1.02);
        setDisplayLetterSpacing(data.displayLetterSpacing ?? 0.1);
        setDisplayBoxWidth(data.displayBoxWidth || 480);
        setDisplayBoxHeight(data.displayBoxHeight || 180);
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
  useAudioEngine({ scriptsLoaded, setScriptsLoaded, setError });

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
        whistleSynth.current = new window.Tone.Synth({ oscillator: { type: 'triangle8' }, envelope: { attack: 0.01, decay: 0.15, sustain: 0.05, release: 0.2 } }).connect(sfxVolumeNode.current);
        wowSynth.current = new window.Tone.FMSynth({ harmonicity: 2, modulationIndex: 8, envelope: { attack: 0.03, decay: 0.2, sustain: 0.08, release: 0.4 } }).connect(sfxVolumeNode.current);
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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (settingsTab === 'jumbotron' && scriptsLoaded.qrcode && qrCodeRef.current) {
        qrCodeRef.current.innerHTML = '';
        new window.QRCode(qrCodeRef.current, {
            text: window.location.href + '?view=public',
            width: 192,
            height: 192,
            colorDark: themes[theme]['--text-color'],
            colorLight: themes[theme]['--bg-color'],
        });
    }
  }, [settingsTab, scriptsLoaded.qrcode, theme]);

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
    const { entries = [], error: parseError } = parseEntries(inputValue, drawMode);
    if (parseError) { setError(parseError); return; }
    if (entries.length < 1) { setError('Please provide at least one valid entry.'); return; }
    if (entries.length > 40000) { setError('Too many entries. Please provide 40,000 or less.'); return; }
    processEntries(entries);
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
        titleLetterSpacing, subtitleLetterSpacing,
        titleFontSize, subtitleFontSize,
        backgroundImage, masterVolume, sfxVolume, musicVolume,
        titleColor, subtitleColor, titleFont, subtitleFont, drawMode,
        displayFont, displayFontSize, displayLineHeight, displayLetterSpacing,
        displayBoxWidth, displayBoxHeight
    };
    downloadJson('lucky-draw-session.json', appState);
  };
  
  const handleLoadSession = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            restoreSession(JSON.parse(event.target.result));
        } catch (err) {
            setError('Invalid or corrupted session file.');
            setTimeout(() => setError(''), 3000);
        }
    };
    reader.readAsText(file);
    e.target.value = null;
  };
  
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

  const playCelebration = () => {
    const now = window.Tone?.now?.() ?? 0;
    if (whistleSynth.current) {
      whistleSynth.current.triggerAttackRelease('A5', '16n', now);
      whistleSynth.current.triggerAttackRelease('C6', '8n', now + 0.12);
    }
    if (wowSynth.current) {
      wowSynth.current.triggerAttackRelease('F3', '8n', now + 0.25);
      wowSynth.current.triggerAttackRelease('A3', '8n', now + 0.35);
    }
    playApplause();
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
        let finished = false;

        const finishAnimation = () => {
            if (finished) return;
            finished = true;
            clearTimeout(timeoutRef.current);
            resolve();
        };

        // Safety net for intermittent timer drift issues that could keep the final draw hanging.
        timeoutRef.current = setTimeout(() => {
            setDisplayValue(String(winnerEntry));
            finishAnimation();
        }, slowMoDuration + 5000);
        
        const animationStart = Date.now();
        
        if (drawMode === 'names') {
            const nameAnimationLoop = () => {
                const elapsed = Date.now() - animationStart;
                if (elapsed >= slowMoDuration) {
                    setDisplayValue(winnerEntry);
                    finishAnimation();
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
            const reelConfigs = winnerDigits.map((_, index) => {
                const start = index * 550;
                const duration = isFinalPrize && isFinalWinnerOfBatch
                    ? 2800 + index * 650
                    : 1300 + index * 350;
                return { start, duration };
            });
            const animationTotalDuration = reelConfigs.reduce(
                (maxDuration, reel) => Math.max(maxDuration, reel.start + reel.duration),
                0,
            );
            
            const animationLoop = () => {
                const elapsed = Date.now() - animationStart;
                let nextDelay = 75;

                if (elapsed >= animationTotalDuration + (isFinalPrize ? 700 : 300)) {
                    setDisplayValue(winnerDigits.join(''));
                    finishAnimation();
                    return;
                }

                const newDisplayDigits = winnerDigits.map((digit, index) => {
                    const reel = reelConfigs[index];

                    if (elapsed < reel.start) return Math.floor(Math.random() * 10);

                    const reelElapsed = elapsed - reel.start;
                    if (reelElapsed >= reel.duration) return digit;

                    const progress = reelElapsed / reel.duration;
                    const easing = 1 - Math.pow(1 - progress, 3);
                    const totalSteps = isFinalPrize ? 24 : 14;
                    const currentStep = Math.floor(easing * totalSteps);
                    const finalDigit = parseInt(digit, 10);
                    return Number.isNaN(finalDigit)
                        ? digit
                        : (finalDigit + totalSteps - currentStep) % 10;
                });

                if (isFinalPrize && !almostTriggered.current && elapsed >= animationTotalDuration - 1100) {
                    almostTriggered.current = true;
                    const finalDigitIndex = maxDigits - 1;
                    const finalDigit = parseInt(winnerDigits[finalDigitIndex], 10);
                    if (!Number.isNaN(finalDigit)) {
                        newDisplayDigits[finalDigitIndex] = (finalDigit + 1) % 10;
                    }
                    setDisplayValue(newDisplayDigits.join(''));
                    timeoutRef.current = setTimeout(animationLoop, 550);
                    return;
                }

                setDisplayValue(newDisplayDigits.join(''));
                if (tickSynth.current) tickSynth.current.triggerAttackRelease("C1", "16n");

                const globalProgress = Math.min(1, elapsed / animationTotalDuration);
                nextDelay = 40 + globalProgress * 170;
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
                    playCelebration();
                } else {
                    winSynth.current.triggerAttackRelease(["C4", "E4", "G4"], "1s");
                    playCelebration();
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

  drawActionRef.current = drawNextWinner;

  const handleShortcuts = (event) => {
    if (showSettings || event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
    if (event.code === 'Space') {
      event.preventDefault();
      drawActionRef.current();
    }
    if (event.key.toLowerCase() === 's') {
      setShowSettings(true);
    }
    if (event.key.toLowerCase() === 'f') {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    }
  };

  useKeyboardShortcuts(handleShortcuts);

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
  const drawProgress = initialEntries.length ? Math.round((winnersHistory.reduce((sum, group) => sum + group.tickets.length, 0) / initialEntries.length) * 100) : 0;
  const canDraw = !drawing && remainingEntries.length > 0 && winnersHistory.length < prizes.length;
  const quickStatus = canDraw ? 'Ready for next draw' : drawing ? 'Drawing in progress...' : 'Draw completed';
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
      {showConfetti && Array.from({ length: 70 }).map((_, i) => <ConfettiParticle key={i} colors={currentTheme['--confetti-colors']} />)}
      
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

      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-[min(900px,95vw)] rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/85 backdrop-blur-md px-4 py-3 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <p className="font-semibold">{quickStatus}</p>
            <p style={{ color: 'var(--text-muted)' }}>Current prize: <span className="font-semibold" style={{ color: 'var(--title-color)' }}>{getPrizeName()}</span></p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums">{currentTime.toLocaleTimeString()}</p>
            <p style={{ color: 'var(--text-muted)' }}>Shortcut: Space draw · S settings · F fullscreen</p>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full" style={{ backgroundColor: 'var(--panel-border)' }}>
          <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${drawProgress}%`, backgroundColor: 'var(--button-action-bg)' }} />
        </div>
      </div>

      <AnimatePresence>
        {showSettings && (
          <SettingsPanel
            showSettings={showSettings}
            onClose={() => setShowSettings(false)}
            settingsTab={settingsTab}
            setSettingsTab={setSettingsTab}
          >
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
                                        <Input type="range" value={titleFontSize} onChange={e => setTitleFontSize(parseInt(e.target.value, 10) || 16)} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" />
                                    </div>
                                    <div>
                                        <label className="text-xs mt-1 block">Line Spacing</label>
                                        <Input type="range" min="0.9" max="2.2" step="0.05" value={titleLineSpacing} onChange={e => setTitleLineSpacing(parseFloat(e.target.value))} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" />
                                    </div>
                                    <div>
                                        <label className="text-xs mt-1 block">Kerning / Letter Spacing (px)</label>
                                        <Input type="range" min="-1" max="6" step="0.1" value={titleLetterSpacing} onChange={e => setTitleLetterSpacing(parseFloat(e.target.value))} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" />
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
                                        <Input type="range" value={subtitleFontSize} onChange={e => setSubtitleFontSize(parseInt(e.target.value, 10) || 16)} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" />
                                    </div>
                                    <div>
                                        <label className="text-xs mt-1 block">Line Spacing</label>
                                        <Input type="range" min="1" max="2.5" step="0.05" value={subtitleLineSpacing} onChange={e => setSubtitleLineSpacing(parseFloat(e.target.value))} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" />
                                    </div>
                                    <div>
                                        <label className="text-xs mt-1 block">Kerning / Letter Spacing (px)</label>
                                        <Input type="range" min="-1" max="4" step="0.1" value={subtitleLetterSpacing} onChange={e => setSubtitleLetterSpacing(parseFloat(e.target.value))} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="font-semibold text-sm mb-1 block">Drawing Box & Winner Text</label>
                                <label className="text-xs mt-1 block">Display Font</label>
                                <select value={displayFont} onChange={e => setDisplayFont(e.target.value)} className="w-full p-2 rounded-lg bg-[var(--input-bg)] border border-[var(--panel-border)] text-sm">
                                    {Object.keys(fonts).map(fontName => (<option key={fontName} value={fonts[fontName]}>{fontName}</option>))}
                                </select>
                                <div className="grid grid-cols-2 gap-4 mt-2">
                                    <div>
                                        <label className="text-xs mt-1 block">Box Width (px)</label>
                                        <Input type="range" min="260" max="700" step="10" value={displayBoxWidth} onChange={e => setDisplayBoxWidth(parseInt(e.target.value, 10))} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" />
                                    </div>
                                    <div>
                                        <label className="text-xs mt-1 block">Box Height (px)</label>
                                        <Input type="range" min="120" max="280" step="10" value={displayBoxHeight} onChange={e => setDisplayBoxHeight(parseInt(e.target.value, 10))} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" />
                                    </div>
                                    <div>
                                        <label className="text-xs mt-1 block">Display Font Size (px)</label>
                                        <Input type="range" min="44" max="140" step="2" value={displayFontSize} onChange={e => setDisplayFontSize(parseInt(e.target.value, 10))} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" />
                                    </div>
                                    <div>
                                        <label className="text-xs mt-1 block">Display Line Height</label>
                                        <Input type="range" min="0.85" max="1.5" step="0.01" value={displayLineHeight} onChange={e => setDisplayLineHeight(parseFloat(e.target.value))} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs mt-1 block">Display Letter Spacing (px)</label>
                                        <Input type="range" min="-2" max="16" step="0.1" value={displayLetterSpacing} onChange={e => setDisplayLetterSpacing(parseFloat(e.target.value))} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" />
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
                            <PrizeEditor
                                prizes={prizes}
                                setPrizes={setPrizes}
                                winnersPerPrize={winnersPerPrize}
                                setWinnersPerPrize={setWinnersPerPrize}
                                drawing={drawing}
                            />
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
                                <input type="file" ref={sessionInputRef} onChange={handleLoadSession} accept=".json" className="hidden" />
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
                                    <Button onClick={playCelebration} disabled={drawing} style={{backgroundColor: 'var(--button-primary-bg)'}}>Whistle + Applause + Wow</Button>
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
                
          </SettingsPanel>
        )}
      </AnimatePresence>
      
      <div className="text-center z-10" style={{textShadow: '0 2px 4px rgba(0,0,0,0.5)'}}>
        <h1 className="font-bold" style={{color: titleColor || 'var(--title-color)', lineHeight: titleLineSpacing, letterSpacing: `${titleLetterSpacing}px`, fontKerning: 'normal', fontFamily: titleFont, fontSize: `${titleFontSize}px`, textRendering: 'optimizeLegibility'}}>{title}</h1>
        <p className="mt-2" style={{color: subtitleColor || 'var(--text-muted)', lineHeight: subtitleLineSpacing, letterSpacing: `${subtitleLetterSpacing}px`, fontKerning: 'normal', fontFamily: subtitleFont, fontSize: `${subtitleFontSize}px`, textRendering: 'optimizeLegibility'}}>{subtitle}</p>
      </div>

      <DrawDisplay
        drawing={drawing}
        currentPrize={currentPrize}
        displayRef={displayRef}
        displayBoxWidth={displayBoxWidth}
        displayBoxHeight={displayBoxHeight}
        pulse={pulse}
        setPulse={setPulse}
        drawMode={drawMode}
        currentTheme={currentTheme}
        displayFont={displayFont}
        displayFontSize={displayFontSize}
        displayLineHeight={displayLineHeight}
        displayLetterSpacing={displayLetterSpacing}
        getDigits={getDigits}
        displayValue={displayValue}
      />

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
      
      <aside className="fixed right-4 top-24 bottom-4 w-[min(360px,92vw)] bg-[var(--panel-bg)]/90 backdrop-blur-md p-4 rounded-xl shadow-2xl z-20 border border-[var(--panel-border)] flex flex-col">
        <h2 className="text-2xl font-bold text-center mb-3" style={{color: 'var(--title-color)'}}>Draw History</h2>
        {winnersHistory.length > 0 ? (
          <ul className="space-y-2 overflow-y-auto pr-1 flex-1">
              {winnersHistory.slice().reverse().map((winnerGroup) => (
                  <li key={winnerGroup.prize} className="p-3 rounded-lg" style={{backgroundColor: 'var(--display-bg)'}}>
                      <span className="font-bold text-lg">{winnerGroup.prize}:</span>
                      <div className="pl-4 mt-1 space-y-1">
                        {winnerGroup.tickets.map(ticket => (
                            <div key={ticket} className="flex justify-between items-center gap-3">
                                <span className="font-mono" style={{color: 'var(--display-text)'}}>{ticket}</span>
                                <Button onClick={() => setWinnerToExport({prize: winnerGroup.prize, ticket})} disabled={!scriptsLoaded.htmlToImage} className="text-xs py-1 px-2 shrink-0" style={{backgroundColor: 'var(--button-primary-bg)'}}>
                                    {scriptsLoaded.htmlToImage ? 'Export' : '...'}
                                </Button>
                            </div>
                        ))}
                      </div>
                  </li>
              ))}
          </ul>
        ) : (
          <p className="text-sm text-center mt-3" style={{color: 'var(--text-muted)'}}>No winners yet. Start drawing to populate this sidebar.</p>
        )}
        <div className="grid grid-cols-1 gap-2 mt-3">
          <Button onClick={handleUndo} disabled={drawing || winnersHistory.length === 0} className="!bg-red-600 hover:!bg-red-700">Undo Last Draw</Button>
          <Button onClick={() => setExportAllTrigger(true)} disabled={drawing || winnersHistory.length === 0} className="!bg-green-600 hover:!bg-green-700">Export All</Button>
          <Button onClick={() => resetDraw()} disabled={drawing} style={{backgroundColor: 'var(--button-primary-bg)'}}>Reset Draw</Button>
        </div>
      </aside>

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

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Tone from 'tone';
import * as htmlToImage from 'html-to-image';
import QRCode from 'qrcodejs2';
import { themes, fonts } from '../utils/themeConfig';
import { Button, Input, ConfettiParticle } from './ui';
import { useSessionStorage } from '../hooks/useSessionStorage';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { parseEntries, parseEntriesFromCsv } from '../utils/parseEntries';
import { downloadJson, downloadCsv, buildWinnersCsvRows, buildAuditLogCsvRows } from '../utils/exportUtils';
import { isValidSessionData, parseSessionJson } from '../utils/validation';
import { sessionTemplates } from '../utils/sessionTemplates';
import { getPaddedDigits } from '../hooks/useDrawEngine';
import { assignRoles, createAuditEntry, divideIntoTeams, getNoRepeatSet } from '../utils/drawModes';

const DISPLAY_DEFAULTS = {
  titleFont: 'sans-serif',
  titleFontSize: 48,
  titleLineSpacing: 1.2,
  titleLetterSpacing: 0,
  subtitleFont: 'sans-serif',
  subtitleFontSize: 16,
  subtitleLineSpacing: 1.5,
  subtitleLetterSpacing: 0,
  displayFont: "'Roboto Mono', 'Noto Sans Myanmar', monospace",
  displayFontSize: 92,
  displayLineHeight: 1.02,
  displayLetterSpacing: 0.1,
  displayBoxWidth: 480,
  displayBoxHeight: 180,
};

const AUDIO_DEFAULTS = { masterVolume: 0, sfxVolume: -6, musicVolume: 0 };

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
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [blankEntriesRemoved, setBlankEntriesRemoved] = useState(0);
  const [participantSearch, setParticipantSearch] = useState('');
  const [operationMode, setOperationMode] = useState('standard');
  const [teamCount, setTeamCount] = useState(2);
  const [roleConfigText, setRoleConfigText] = useState('Host:1\nJudge:2');
  const [allowMultipleRoles, setAllowMultipleRoles] = useState(false);
  const [winnerEligibilityMode, setWinnerEligibilityMode] = useState('remove');
  const [noRepeatAcrossPrizes, setNoRepeatAcrossPrizes] = useState(false);
  const [auditLog, setAuditLog] = useState([]);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const [assignmentHistory, setAssignmentHistory] = useState([]);
  const [assignmentToExport, setAssignmentToExport] = useState(null);

  // Refs
  const timeoutRef = useRef(null);
  const chargeIntervalRef = useRef(null);
  const displayRef = useRef(null);
  const fileInputRef = useRef(null);
  const sessionInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const bgImageInputRef = useRef(null);
  const exportRef = useRef(null);
  const exportAllRef = useRef(null);
  const assignmentExportRef = useRef(null);
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
    displayBoxWidth, displayBoxHeight,
    operationMode, teamCount, roleConfigText, allowMultipleRoles,
    winnerEligibilityMode, noRepeatAcrossPrizes, auditLog, assignmentHistory
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
        setOperationMode(data.operationMode || 'standard');
        setTeamCount(data.teamCount || 2);
        setRoleConfigText(data.roleConfigText || 'Host:1\nJudge:2');
        setAllowMultipleRoles(Boolean(data.allowMultipleRoles));
        setWinnerEligibilityMode(data.winnerEligibilityMode || 'remove');
        setNoRepeatAcrossPrizes(Boolean(data.noRepeatAcrossPrizes));
        setAuditLog(Array.isArray(data.auditLog) ? data.auditLog : []);
        setAssignmentHistory(Array.isArray(data.assignmentHistory) ? data.assignmentHistory : []);
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
  useAudioEngine({ setScriptsLoaded });

  useEffect(() => {
    if (scriptsLoaded.tone && !tickSynth.current) {
        sfxVolumeNode.current = new Tone.Volume(sfxVolume).toDestination();
        musicVolumeNode.current = new Tone.Volume(musicVolume).toDestination();

        tickSynth.current = new Tone.MembraneSynth().connect(sfxVolumeNode.current);
        fireworkWhoosh.current = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.005, decay: 0.3, sustain: 0 } }).connect(sfxVolumeNode.current);
        fireworkCrackle.current = new Tone.MetalSynth({ frequency: 200, envelope: { attack: 0.001, decay: 0.1, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).connect(sfxVolumeNode.current);
        drumrollSynth.current = new Tone.MembraneSynth({ pitchDecay: 0.01, octaves: 2, envelope: { attack: 0.001, decay: 0.1, sustain: 0 } }).connect(sfxVolumeNode.current);

        winSynth.current = new Tone.PolySynth(Tone.Synth).connect(musicVolumeNode.current);
        applauseSynth.current = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0 }}).connect(sfxVolumeNode.current);
        whistleSynth.current = new Tone.Synth({ oscillator: { type: 'triangle8' }, envelope: { attack: 0.01, decay: 0.15, sustain: 0.05, release: 0.2 } }).connect(sfxVolumeNode.current);
        wowSynth.current = new Tone.FMSynth({ harmonicity: 2, modulationIndex: 8, envelope: { attack: 0.03, decay: 0.2, sustain: 0.08, release: 0.4 } }).connect(sfxVolumeNode.current);
    }
  }, [scriptsLoaded.tone, sfxVolume, musicVolume]);

  useEffect(() => {
    Tone.Destination.volume.value = masterVolume;
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
        new QRCode(qrCodeRef.current, {
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

  const processEntries = (entries, { duplicateGroups: duplicates = [], blankCount = 0 } = {}) => {
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

    setDuplicateGroups(duplicates);
    setBlankEntriesRemoved(blankCount);
  };

  const updateEntries = () => {
    setError('');
    const { entries = [], error: parseError, duplicateGroups: duplicates = [], blankCount = 0 } = parseEntries(inputValue, drawMode);
    if (parseError) { setError(parseError); return; }
    if (entries.length < 1) { setError('Please provide at least one valid entry.'); return; }
    if (entries.length > 40000) { setError('Too many entries. Please provide 40,000 or less.'); return; }
    processEntries(entries, { duplicateGroups: duplicates, blankCount });
  };

  const resetDraw = (entriesToUse = initialEntries, newMaxDigits = maxDigits) => {
    setRemainingEntries(entriesToUse);
    setWinnersHistory([]);
    const firstEntry = entriesToUse[0] || (drawMode === 'numbers' ? '1' : 'Winner');
    setAuditLog([]);
    setAssignmentHistory([]);
    setDisplayValue(firstEntry);
    setError('');
    setShowConfetti(false);
  };
  
  const handleUndo = () => {
    if (auditLog.length === 0 || drawing) return;
    const lastEntry = auditLog[auditLog.length - 1];
    setAuditLog(auditLog.slice(0, -1));

    if (lastEntry.mode === 'standard') {
      const lastWinnerGroup = winnersHistory[winnersHistory.length - 1];
      if (!lastWinnerGroup) return;
      setWinnersHistory(winnersHistory.slice(0, -1));
      const restored = [...remainingEntries, ...lastWinnerGroup.tickets];
      setRemainingEntries(Array.from(new Set(restored)).sort());
      setDisplayValue(lastWinnerGroup.tickets[0]);
    } else {
      setDisplayValue(initialEntries[0] || 'Ready');
    }

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
        displayBoxWidth, displayBoxHeight,
        operationMode, teamCount, roleConfigText, allowMultipleRoles,
        winnerEligibilityMode, noRepeatAcrossPrizes, auditLog
    };
    downloadJson('lucky-draw-session.json', appState);
  };
  
  const handleExportWinnersCsv = () => {
    downloadCsv(`${title.replace(/\s+/g, '-')}-winners.csv`, buildWinnersCsvRows(winnersHistory));
  };

  const handleExportAuditLogCsv = () => {
    downloadCsv(`${title.replace(/\s+/g, '-')}-audit-log.csv`, buildAuditLogCsvRows(auditLog));
  };

  const handleExportAuditLogJson = () => {
    downloadJson(`${title.replace(/\s+/g, '-')}-audit-log.json`, auditLog);
  };

  const handleExportAssignmentCsv = (assignment) => {
    const rows = assignment.type === 'team-divider'
      ? [['Team', 'Members'], ...assignment.data.map((t) => [t.teamName, t.members.join(', ')])]
      : [['Role', 'Participants'], ...assignment.data.map((r) => [r.role, r.participants.join(', ')])];
    downloadCsv(`${title.replace(/\s+/g, '-')}-${assignment.type}.csv`, rows);
  };

  const applyTemplate = (template) => {
    const s = template.settings;
    if (s.title !== undefined) setTitle(s.title);
    if (s.subtitle !== undefined) setSubtitle(s.subtitle);
    if (s.drawMode !== undefined) setDrawMode(s.drawMode);
    if (s.operationMode !== undefined) setOperationMode(s.operationMode);
    if (s.prizes !== undefined) setPrizes(s.prizes.map((p, i) => ({ ...p, id: Date.now() + i })));
    if (s.winnersPerPrize !== undefined) setWinnersPerPrize(s.winnersPerPrize);
    if (s.winnerEligibilityMode !== undefined) setWinnerEligibilityMode(s.winnerEligibilityMode);
    if (s.noRepeatAcrossPrizes !== undefined) setNoRepeatAcrossPrizes(s.noRepeatAcrossPrizes);
    if (s.theme !== undefined) setTheme(s.theme);
    if (s.teamCount !== undefined) setTeamCount(s.teamCount);
    if (s.roleConfigText !== undefined) setRoleConfigText(s.roleConfigText);
    if (s.allowMultipleRoles !== undefined) setAllowMultipleRoles(s.allowMultipleRoles);
    setSuccessMessage(`Template "${template.label}" loaded!`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const resetDisplaySettings = () => {
    setTitleFont(DISPLAY_DEFAULTS.titleFont);
    setTitleFontSize(DISPLAY_DEFAULTS.titleFontSize);
    setTitleLineSpacing(DISPLAY_DEFAULTS.titleLineSpacing);
    setTitleLetterSpacing(DISPLAY_DEFAULTS.titleLetterSpacing);
    setTitleColor('');
    setSubtitleFont(DISPLAY_DEFAULTS.subtitleFont);
    setSubtitleFontSize(DISPLAY_DEFAULTS.subtitleFontSize);
    setSubtitleLineSpacing(DISPLAY_DEFAULTS.subtitleLineSpacing);
    setSubtitleLetterSpacing(DISPLAY_DEFAULTS.subtitleLetterSpacing);
    setSubtitleColor('');
    setDisplayFont(DISPLAY_DEFAULTS.displayFont);
    setDisplayFontSize(DISPLAY_DEFAULTS.displayFontSize);
    setDisplayLineHeight(DISPLAY_DEFAULTS.displayLineHeight);
    setDisplayLetterSpacing(DISPLAY_DEFAULTS.displayLetterSpacing);
    setDisplayBoxWidth(DISPLAY_DEFAULTS.displayBoxWidth);
    setDisplayBoxHeight(DISPLAY_DEFAULTS.displayBoxHeight);
  };

  const resetAudioSettings = () => {
    setMasterVolume(AUDIO_DEFAULTS.masterVolume);
    setSfxVolume(AUDIO_DEFAULTS.sfxVolume);
    setMusicVolume(AUDIO_DEFAULTS.musicVolume);
  };

  const handleLoadSession = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const { data, error: parseError } = parseSessionJson(event.target.result);
      if (parseError) {
        setError(parseError);
        setTimeout(() => setError(''), 4000);
      } else {
        restoreSession(data);
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
        const parsed = parseEntries(event.target.result, drawMode);
        if (parsed.error) {
            setError(parsed.error);
            return;
        }

        setInputValue(parsed.entries.join(', '));
        processEntries(parsed.entries, { duplicateGroups: parsed.duplicateGroups, blankCount: parsed.blankCount });
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const handleCsvImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = (event) => {
      const parsed = parseEntriesFromCsv(event.target.result, drawMode);
      if (parsed.entries.length < 1) {
        setError('CSV file does not contain valid entries.');
        return;
      }

      if (parsed.entries.length > 40000) {
        setError('Too many entries. Please provide 40,000 or less.');
        return;
      }

      setInputValue(parsed.entries.join(', '));
      processEntries(parsed.entries, { duplicateGroups: parsed.duplicateGroups, blankCount: parsed.blankCount });
    };

    reader.readAsText(file);
    e.target.value = null;
  };

  const filteredEntries = initialEntries.filter((entry) =>
    entry.toLocaleLowerCase().includes(participantSearch.toLocaleLowerCase().trim())
  );

  const updateEntryAt = (indexToUpdate, value) => {
    const nextValue = value.trim();
    if (!nextValue) return;

    const nextEntries = initialEntries.map((entry, idx) => (idx === indexToUpdate ? nextValue : entry));
    const normalized = parseEntries(nextEntries.join(', '), drawMode);
    setInputValue(nextEntries.join(', '));
    processEntries(normalized.entries, { duplicateGroups: normalized.duplicateGroups, blankCount: normalized.blankCount });
  };

  const removeEntryAt = (indexToRemove) => {
    const nextEntries = initialEntries.filter((_, idx) => idx !== indexToRemove);
    setInputValue(nextEntries.join(', '));

    if (nextEntries.length === 0) {
      setInitialEntries([]);
      setRemainingEntries([]);
      setDisplayValue(drawMode === 'numbers' ? '1' : 'Winner');
      setDuplicateGroups([]);
      return;
    }

    processEntries(nextEntries);
  };

  const removeDuplicateGroup = (kept) => {
    const nextEntries = initialEntries.filter((entry) => entry !== kept);
    setInputValue(nextEntries.join(', '));

    if (nextEntries.length === 0) {
      setInitialEntries([]);
      setRemainingEntries([]);
      setDisplayValue(drawMode === 'numbers' ? '1' : 'Winner');
      setDuplicateGroups([]);
      return;
    }

    processEntries(nextEntries);
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
        const now = Tone.now();
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
    const now = Tone.now();
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

  const ensureAudioStarted = async () => {
    if (scriptsLoaded.tone && !audioStarted.current) {
      await Tone.start();
      audioStarted.current = true;
    }
  };

  const startCharging = async () => {
    if (drawing || isCharging || remainingEntries.length === 0 || winnersHistory.length >= prizes.length) return;

    await ensureAudioStarted();

    clearInterval(chargeIntervalRef.current);

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

  const parseRoleRules = () => roleConfigText
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, count] = line.split(':');
      return { name: (name || '').trim(), count: Number.parseInt((count || '').trim(), 10) || 0 };
    })
    .filter((role) => role.name && role.count > 0);

  const drawNextWinner = async () => {
    await ensureAudioStarted();

    if (operationMode !== 'standard') {
      const blocked = noRepeatAcrossPrizes ? getNoRepeatSet(auditLog) : new Set();
      const eligible = initialEntries.filter((entry) => !blocked.has(entry));
      if (eligible.length === 0) {
        setError('No eligible participants left for this mode.');
        return;
      }

      if (operationMode === 'team-divider') {
        const teams = divideIntoTeams(eligible, teamCount);
        const selected = teams.flatMap((team) => team.members);
        setAuditLog((prev) => [...prev, createAuditEntry({ mode: 'team-divider', context: `${teams.length} teams`, selected, remainingCount: eligible.length })]);
        setCurrentPrize(`Team Divider (${teams.length} teams)`);
        setDrawing(true);
        for (let i = 0; i < teams.length; i++) {
          setDisplayValue(`${teams[i].teamName}: ${teams[i].members.join(', ')}`);
          setPulse(true);
          if (i < teams.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 2500));
          }
        }
        setAssignmentHistory((prev) => [...prev, { id: Date.now(), type: 'team-divider', data: teams, timestamp: new Date().toISOString() }]);
        setDrawing(false);
        return;
      }

      const roleRules = parseRoleRules();
      if (roleRules.length === 0) {
        setError('Add at least one valid role in Role:Count format.');
        return;
      }
      const assignments = assignRoles(eligible, roleRules, { allowMultipleRoles });
      const selected = assignments.flatMap((role) => role.participants);
      setAuditLog((prev) => [...prev, createAuditEntry({ mode: 'role-selector', context: `${assignments.length} roles`, selected, remainingCount: eligible.length })]);
      setCurrentPrize('Role Selector');
      setDrawing(true);
      for (let i = 0; i < assignments.length; i++) {
        setDisplayValue(`${assignments[i].role}: ${assignments[i].participants.join(', ')}`);
        setPulse(true);
        if (i < assignments.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2500));
        }
      }
      setAssignmentHistory((prev) => [...prev, { id: Date.now(), type: 'role-selector', data: assignments, timestamp: new Date().toISOString() }]);
      setDrawing(false);
      return;
    }

    const blocked = noRepeatAcrossPrizes ? getNoRepeatSet(auditLog) : new Set();
    const sourcePool = remainingEntries.filter((entry) => !blocked.has(entry));
    const numToDraw = Math.min(winnersPerPrize, sourcePool.length);
    if (drawing || numToDraw === 0 || winnersHistory.length >= prizes.length) {
        if (sourcePool.length === 0) setError('All entries have been drawn!');
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
    let tempPool = [...sourcePool];
    for(let i = 0; i < numToDraw; i++) {
        const winnerIndex = Math.floor(Math.random() * tempPool.length);
        drawnTickets.push(tempPool.splice(winnerIndex, 1)[0]);
    }

    for (let i = 0; i < drawnTickets.length; i++) {
        const ticket = drawnTickets[i];
        const isFinalWinnerOfBatch = i === drawnTickets.length - 1;
        await runSingleWinnerAnimation(ticket, isFinalWinnerOfBatch);
    }

    const newHistory = [...winnersHistory, { prize: currentPrizeName, tickets: drawnTickets }];
    setWinnersHistory(newHistory);

    const nextRemaining = winnerEligibilityMode === 'keep'
      ? remainingEntries
      : remainingEntries.filter((entry) => !drawnTickets.includes(entry));

    setRemainingEntries(nextRemaining);
    setAuditLog((prev) => [...prev, createAuditEntry({ mode: 'standard', context: currentPrizeName, selected: drawnTickets, remainingCount: nextRemaining.length })]);
    setShowConfetti(true);
    playCelebration();
    setTimeout(() => setShowConfetti(false), 5000);
    setDrawing(false);
  };

  drawActionRef.current = drawNextWinner;

  useEffect(() => {
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

    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [showSettings]);

  useEffect(() => {
    if (winnerToExport && exportRef.current) {
        const exportImage = async () => {
            try {
                const dataUrl = await htmlToImage.toPng(exportRef.current, {
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
    if (exportAllTrigger && exportAllRef.current) {
        const exportAllImage = async () => {
             try {
                const dataUrl = await htmlToImage.toPng(exportAllRef.current, {
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
    if (assignmentToExport && assignmentExportRef.current) {
      const doExport = async () => {
        try {
          const dataUrl = await htmlToImage.toPng(assignmentExportRef.current, {
            quality: 0.95,
            backgroundColor: themes[theme]['--bg-color'],
          });
          const link = document.createElement('a');
          link.download = `${title.replace(/\s+/g, '-')}-${assignmentToExport.type}.png`;
          link.href = dataUrl;
          link.click();
        } catch (err) {
          console.error('Failed to export assignment image', err);
        } finally {
          setAssignmentToExport(null);
        }
      };
      doExport();
    }
  }, [assignmentToExport, theme, title, logo]);

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

      <Button onClick={() => setShowSettings(true)} className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30 !bg-gray-700 hover:!bg-gray-600 !p-2 sm:!p-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2.73l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2.73l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
      </Button>

      <div className="fixed bottom-3 right-3 sm:absolute sm:top-4 sm:left-1/2 sm:bottom-auto sm:right-auto sm:-translate-x-1/2 z-30 w-[min(78vw,320px)] sm:w-[min(900px,95vw)] rounded-xl sm:rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/85 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-3 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs sm:text-sm">
          <div>
            <p className="font-semibold">{quickStatus}</p>
            <p style={{ color: 'var(--text-muted)' }} className="text-[10px] sm:text-sm">Current prize: <span className="font-semibold" style={{ color: 'var(--title-color)' }}>{getPrizeName()}</span></p>
          </div>
          <div className="text-right">
            <p className="text-sm sm:text-lg font-semibold tabular-nums">{currentTime.toLocaleTimeString()}</p>
            <p style={{ color: 'var(--text-muted)' }} className="hidden sm:block">Shortcut: Space draw · S settings · F fullscreen</p>
          </div>
        </div>
        <div className="mt-2 sm:mt-3 h-1.5 sm:h-2 rounded-full" style={{ backgroundColor: 'var(--panel-border)' }}>
          <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${drawProgress}%`, backgroundColor: 'var(--button-action-bg)' }} />
        </div>
      </div>

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
                        <button className={`py-2 px-4 ${settingsTab === 'templates' ? 'border-b-2 border-[var(--title-color)] text-[var(--title-color)]' : 'text-[var(--text-muted)]'}`} onClick={() => setSettingsTab('templates')}>Templates</button>
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
                            <div className="flex items-center justify-between pt-2 border-t border-[var(--panel-border)]">
                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Display Typography</p>
                                <button onClick={resetDisplaySettings} className="text-xs px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--panel-border)] hover:opacity-80">Reset defaults</button>
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
                            <div className="pt-2 border-t border-[var(--panel-border)]">
                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Participants & Draw Mode</p>
                            </div>
                            <div>
                                <label className="font-semibold text-sm mb-1 block">Participant Type</label>
                                <select value={drawMode} onChange={(e) => setDrawMode(e.target.value)} className="w-full p-2 rounded-lg bg-[var(--input-bg)] border border-[var(--panel-border)] text-sm mb-2">
                                    <option value="numbers">Numbers</option>
                                    <option value="names">Names</option>
                                </select>
                                <label className="font-semibold text-sm mb-1 block">Participants</label>
                                <div className="flex items-center gap-2">
                                    <Input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder={drawMode === 'numbers' ? 'e.g., 001-100, 001, 007 or mixed lines/commas' : 'e.g., Alice, Bob or one name per line'} className="flex-grow bg-[var(--input-bg)] border-[var(--panel-border)]" disabled={drawing} />
                                    <Button onClick={updateEntries} disabled={drawing} className="flex-shrink-0" style={{backgroundColor: 'var(--button-primary-bg)'}}>Set</Button>
                                </div>
                                <p className="text-xs mt-1 text-[var(--text-muted)]">Supports one per line, comma-separated, or mixed input. Blank items are ignored automatically.</p>
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <Button onClick={() => fileInputRef.current && fileInputRef.current.click()} disabled={drawing} className="w-full text-sm !bg-gray-600 hover:!bg-gray-700">Import Text</Button>
                                    <Button onClick={() => csvInputRef.current && csvInputRef.current.click()} disabled={drawing} className="w-full text-sm !bg-gray-600 hover:!bg-gray-700">Import CSV</Button>
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".txt" className="hidden" />
                                <input type="file" ref={csvInputRef} onChange={handleCsvImport} accept=".csv,text/csv" className="hidden" />

                                <div className="mt-3 p-3 rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)]/40">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-sm font-semibold">Participant Editor</p>
                                      <p className="text-xs text-[var(--text-muted)]">Total: {initialEntries.length}</p>
                                    </div>
                                    <Input type="text" value={participantSearch} onChange={(e) => setParticipantSearch(e.target.value)} placeholder="Search participants..." className="bg-[var(--input-bg)] border-[var(--panel-border)]" />
                                    <div className="mt-2 max-h-40 overflow-y-auto space-y-2 pr-1">
                                      {filteredEntries.map((entry) => {
                                        const index = initialEntries.indexOf(entry);
                                        return (
                                          <div key={`${entry}-${index}`} className="flex items-center gap-2">
                                            <Input
                                              type="text"
                                              defaultValue={entry}
                                              onBlur={(e) => updateEntryAt(index, e.target.value)}
                                              className="bg-[var(--input-bg)] border-[var(--panel-border)]"
                                              disabled={drawing}
                                            />
                                            <Button onClick={() => removeEntryAt(index)} disabled={drawing} className="!bg-red-600 text-xs !py-2 !px-3">Remove</Button>
                                          </div>
                                        );
                                      })}
                                      {filteredEntries.length === 0 && (
                                        <p className="text-xs text-[var(--text-muted)]">No matching participants.</p>
                                      )}
                                    </div>
                                  </div>

                                  {(blankEntriesRemoved > 0 || duplicateGroups.length > 0) && (
                                    <div className="mt-3 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 space-y-2">
                                      <p className="text-sm font-semibold">Cleanup Summary</p>
                                      {blankEntriesRemoved > 0 && <p className="text-xs text-[var(--text-muted)]">Removed blank entries: {blankEntriesRemoved}</p>}
                                      {duplicateGroups.length > 0 && (
                                        <div className="space-y-2">
                                          <p className="text-xs text-[var(--text-muted)]">Duplicate groups: {duplicateGroups.length}</p>
                                          {duplicateGroups.map((group) => (
                                            <div key={group.kept} className="flex items-center justify-between gap-2 text-xs border border-[var(--panel-border)] rounded-md p-2">
                                              <span>Keeping <strong>{group.kept}</strong> · Removed {group.removed.length}</span>
                                              <Button onClick={() => removeDuplicateGroup(group.kept)} disabled={drawing} className="!bg-red-600 !px-2 !py-1 text-xs">Remove kept</Button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                            </div>
                            <div className="p-3 rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)]/30 space-y-3">
                                <label className="font-semibold text-sm mb-1 block">Operation Mode</label>
                                <select value={operationMode} onChange={(e) => setOperationMode(e.target.value)} className="w-full p-2 rounded-lg bg-[var(--input-bg)] border border-[var(--panel-border)] text-sm">
                                    <option value="standard">Standard Draw</option>
                                    <option value="team-divider">Team Divider</option>
                                    <option value="role-selector">Role Selector</option>
                                </select>
                                {operationMode === 'team-divider' && (
                                  <div>
                                    <label className="text-xs mt-1 block">Number of Teams</label>
                                    <Input type="number" min="2" value={teamCount} onChange={(e) => setTeamCount(Math.max(2, parseInt(e.target.value, 10) || 2))} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" />
                                  </div>
                                )}
                                {operationMode === 'role-selector' && (
                                  <div className="space-y-2">
                                    <label className="text-xs mt-1 block">Roles (one per line: Role:Count)</label>
                                    <textarea value={roleConfigText} onChange={(e) => setRoleConfigText(e.target.value)} rows={4} className="w-full p-2 rounded-lg bg-[var(--input-bg)] border border-[var(--panel-border)] text-sm" />
                                    <label className="flex items-center gap-2 text-xs">
                                      <input type="checkbox" checked={allowMultipleRoles} onChange={(e) => setAllowMultipleRoles(e.target.checked)} />
                                      Allow same participant to receive multiple roles
                                    </label>
                                  </div>
                                )}
                                <div className="pt-2 border-t border-[var(--panel-border)] space-y-2">
                                  <p className="text-xs font-semibold">Fairness Controls</p>
                                  <label className="flex items-center gap-2 text-xs">
                                    <input type="radio" name="eligibility" checked={winnerEligibilityMode === 'remove'} onChange={() => setWinnerEligibilityMode('remove')} />
                                    Remove winner from future rounds
                                  </label>
                                  <label className="flex items-center gap-2 text-xs">
                                    <input type="radio" name="eligibility" checked={winnerEligibilityMode === 'keep'} onChange={() => setWinnerEligibilityMode('keep')} />
                                    Keep winner eligible
                                  </label>
                                  <label className="flex items-center gap-2 text-xs">
                                    <input type="checkbox" checked={noRepeatAcrossPrizes} onChange={(e) => setNoRepeatAcrossPrizes(e.target.checked)} />
                                    No repeat across prizes/modes
                                  </label>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-[var(--panel-border)]">
                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Prizes</p>
                            </div>
                            <div>
                                <label className="font-semibold text-sm mb-1 block">Prize List</label>
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
                            <div className="pt-2 border-t border-[var(--panel-border)]">
                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Branding & Media</p>
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
                                <input type="file" ref={sessionInputRef} onChange={handleLoadSession} accept=".json" className="hidden" />
                            </div>
                        </div>
                    )}
                    {settingsTab === 'sound' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Volume Controls</p>
                                <button onClick={resetAudioSettings} className="text-xs px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--panel-border)] hover:opacity-80">Reset defaults</button>
                            </div>
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
                    {settingsTab === 'templates' && (
                        <div className="space-y-4">
                            <p className="text-sm text-[var(--text-muted)]">Load a preset to quickly configure the app for a specific event type. This updates the title, prizes, draw mode, operation mode, and theme — your participant list is untouched.</p>
                            {sessionTemplates.map(template => (
                                <div key={template.id} className="p-3 rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)]/30">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-sm">{template.label}</p>
                                            <p className="text-xs text-[var(--text-muted)] mt-1">{template.description}</p>
                                        </div>
                                        <Button onClick={() => applyTemplate(template)} disabled={drawing} className="flex-shrink-0 text-sm !bg-blue-600 hover:!bg-blue-700">Load</Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {settingsTab === 'about' && (
                        <div className="space-y-4 text-[var(--text-muted)]">
                            <h3 className="text-xl font-bold text-[var(--text-color)]">Lucky Draw Pro</h3>
                            <p>Version 2.0.0</p>
                            <p>A fully customizable application for running exciting live lucky draws for any event. This tool is designed for reliability and high audience engagement.</p>
                            <p className="pt-4">Created by: <span className="font-bold text-[var(--text-color)]">Tao Mon Lae</span></p>
                        </div>
                    )}
                </div>
            </motion.div>
        )}
              </AnimatePresence>
      
      <div className="text-center z-10" style={{textShadow: '0 2px 4px rgba(0,0,0,0.5)'}}>
        <h1 className="font-bold" style={{color: titleColor || 'var(--title-color)', lineHeight: titleLineSpacing, letterSpacing: `${titleLetterSpacing}px`, fontKerning: 'normal', fontFamily: titleFont, fontSize: `${titleFontSize}px`, textRendering: 'optimizeLegibility'}}>{title}</h1>
        <p className="mt-2" style={{color: subtitleColor || 'var(--text-muted)', lineHeight: subtitleLineSpacing, letterSpacing: `${subtitleLetterSpacing}px`, fontKerning: 'normal', fontFamily: subtitleFont, fontSize: `${subtitleFontSize}px`, textRendering: 'optimizeLegibility'}}>{subtitle}</p>
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
            className="rounded-2xl shadow-inner flex items-center justify-center p-4 border-4"
            style={{
                backgroundColor: 'var(--display-bg)',
                borderColor: 'var(--display-border)',
                width: `min(${displayBoxWidth}px, 95vw)`,
                minHeight: `${displayBoxHeight}px`,
                height: 'auto',
            }}
            animate={pulse ? {boxShadow: ['0 0 0px #fff', '0 0 40px #fff', '0 0 0px #fff']} : {}}
            transition={pulse ? {duration: 0.8, ease: 'easeInOut'} : {}}
            onAnimationComplete={() => setPulse(false)}
        >
            {operationMode === 'standard' && drawMode === 'numbers' ? (
                <div className="flex items-center font-bold" style={{color: 'var(--display-text)', textShadow: `0 0 20px ${currentTheme['--display-shadow']}`, fontFamily: displayFont, fontSize: `clamp(2.25rem, ${displayFontSize / 16}rem, 8.5rem)`, lineHeight: displayLineHeight, letterSpacing: `${displayLetterSpacing}px`, fontVariantNumeric: 'tabular-nums lining-nums'}}>
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
                 <div className="font-bold px-4 text-center w-full" style={{color: 'var(--display-text)', textShadow: `0 0 20px ${currentTheme['--display-shadow']}`, fontFamily: displayFont, fontSize: `clamp(2rem, ${Math.max(38, displayFontSize * 0.7) / 16}rem, 6rem)`, lineHeight: displayLineHeight, letterSpacing: `${displayLetterSpacing}px`, wordBreak: 'break-word', overflowWrap: 'break-word'}}>
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
                onPointerDown={operationMode === 'standard' ? startCharging : undefined}
                onPointerUp={operationMode === 'standard' ? stopCharging : undefined}
                onPointerLeave={operationMode === 'standard' ? stopCharging : undefined}
                onPointerCancel={operationMode === 'standard' ? stopCharging : undefined}
                onContextMenu={(event) => event.preventDefault()}
                onClick={operationMode === 'standard' ? undefined : drawNextWinner}
                disabled={drawing || (operationMode === 'standard' && remainingEntries.length === 0) || (operationMode === 'standard' && winnersHistory.length >= prizes.length)} 
                className="w-full px-6 py-3 sm:px-10 sm:py-4 text-base sm:text-xl text-black" 
                style={{backgroundColor: 'var(--button-action-bg)', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none'}}
            >
              {operationMode === 'standard' ? (isCharging ? "Charging..." : "Hold to Draw") : 'Run Assignment'}
            </Button>
        </div>
      </div>
      
      {/* Floating button to re-open history panel when minimized */}
      {!historyPanelOpen && (
        <button
          onClick={() => setHistoryPanelOpen(true)}
          className="fixed left-3 top-28 z-20 flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-lg shadow-lg text-xs font-bold"
          style={{ backgroundColor: 'var(--panel-bg)', color: 'var(--title-color)', border: '1px solid var(--panel-border)' }}
          title="Show History & Audit"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', fontSize: '10px' }}>History</span>
        </button>
      )}

      <aside className={`fixed left-2 sm:left-4 top-24 bottom-4 w-[min(360px,92vw)] bg-[var(--panel-bg)]/90 backdrop-blur-md p-3 sm:p-4 rounded-xl shadow-2xl z-20 border border-[var(--panel-border)] flex flex-col transition-transform duration-300 ${historyPanelOpen ? 'translate-x-0' : '-translate-x-full pointer-events-none'}`}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-lg sm:text-2xl font-bold" style={{color: 'var(--title-color)'}}>History & Audit</h2>
          <button
            onClick={() => setHistoryPanelOpen(false)}
            className="flex items-center justify-center w-7 h-7 rounded-md hover:opacity-80 transition-opacity"
            style={{ backgroundColor: 'var(--display-bg)', color: 'var(--text-muted)' }}
            title="Minimize"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pr-1 space-y-2">
          {auditLog.length > 0 ? auditLog.slice().reverse().map((entry) => (
            <details key={entry.id} className="p-2 rounded-lg" style={{backgroundColor: 'var(--display-bg)'}}>
              <summary className="cursor-pointer text-sm font-semibold">
                {entry.mode} · {entry.context}
              </summary>
              <p className="text-xs mt-1" style={{color: 'var(--text-muted)'}}>{new Date(entry.timestamp).toLocaleString()}</p>
              <p className="text-xs mt-1">Selected: {entry.selected.join(', ') || 'None'}</p>
              {typeof entry.remainingCount === 'number' && <p className="text-xs">Remaining: {entry.remainingCount}</p>}
            </details>
          )) : <p className="text-xs sm:text-sm text-center mt-3" style={{color: 'var(--text-muted)'}}>No history yet.</p>}

          {winnersHistory.length > 0 && (
            <div className="pt-2 space-y-2 border-t border-[var(--panel-border)]">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Winner PNG Export</p>
              {winnersHistory.flatMap((group) => group.tickets.map((ticket) => ({ prize: group.prize, ticket }))).map((winner, index) => (
                <Button
                  key={`${winner.prize}-${winner.ticket}-${index}`}
                  onClick={() => setWinnerToExport(winner)}
                  disabled={drawing}
                  className="w-full !bg-sky-700 hover:!bg-sky-800 text-xs sm:text-sm"
                >
                  Export {winner.prize}: {winner.ticket}
                </Button>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 mt-3">
          <Button onClick={handleUndo} disabled={drawing || auditLog.length === 0} className="!bg-red-600 hover:!bg-red-700">Undo Last</Button>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mt-1">Export Winners</p>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setExportAllTrigger(true)} disabled={drawing || winnersHistory.length === 0} className="!bg-green-600 hover:!bg-green-700 text-sm">Image (PNG)</Button>
            <Button onClick={handleExportWinnersCsv} disabled={drawing || winnersHistory.length === 0} className="!bg-teal-600 hover:!bg-teal-700 text-sm">Winners CSV</Button>
          </div>
          {assignmentHistory.length > 0 && (
            <>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mt-1">Export Assignments</p>
              {assignmentHistory.slice().reverse().map((assignment) => (
                <div key={assignment.id} className="rounded-lg p-2 space-y-1" style={{ backgroundColor: 'var(--display-bg)' }}>
                  <p className="text-xs font-semibold" style={{ color: 'var(--title-color)' }}>
                    {assignment.type === 'team-divider' ? `Teams (${assignment.data.length})` : `Roles (${assignment.data.length})`}
                    <span className="ml-1 font-normal" style={{ color: 'var(--text-muted)' }}>{new Date(assignment.timestamp).toLocaleTimeString()}</span>
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    <Button onClick={() => setAssignmentToExport(assignment)} disabled={drawing} className="!bg-sky-700 hover:!bg-sky-800 text-xs">PNG</Button>
                    <Button onClick={() => handleExportAssignmentCsv(assignment)} disabled={drawing} className="!bg-teal-600 hover:!bg-teal-700 text-xs">CSV</Button>
                  </div>
                </div>
              ))}
            </>
          )}
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mt-1">Export Audit Log</p>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handleExportAuditLogCsv} disabled={drawing || auditLog.length === 0} className="!bg-teal-700 hover:!bg-teal-800 text-sm">Log CSV</Button>
            <Button onClick={handleExportAuditLogJson} disabled={drawing || auditLog.length === 0} className="!bg-indigo-600 hover:!bg-indigo-700 text-sm">Log JSON</Button>
          </div>
          <Button onClick={() => resetDraw()} disabled={drawing} style={{backgroundColor: 'var(--button-primary-bg)'}}>Reset Draw</Button>
        </div>
      </aside>

      {/* Hidden components for PNG export — positioned far off-screen so layout renders at full size */}
      <div style={{ position: 'fixed', top: '-9999px', left: '-9999px', pointerEvents: 'none' }}>
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
                 <div style={{ width: 900, padding: 40, boxSizing: 'border-box', ...themes[theme] }}>
                     {logo && <img src={logo} alt="Logo" style={{ height: 80, width: 'auto', marginBottom: 24 }} />}
                     <h2 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 24, color: themes[theme]['--title-color'] }}>{title} - Winners</h2>
                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px 32px' }}>
                        {winnersHistory.map(group => (
                            <div key={group.prize}>
                                <h3 style={{ fontSize: 22, fontWeight: 'bold', borderBottom: `2px solid ${themes[theme]['--panel-border']}`, paddingBottom: 4, marginBottom: 8, color: themes[theme]['--title-color'] }}>{group.prize}</h3>
                                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                                    {group.tickets.map(ticket => (
                                      <li key={ticket} style={{ fontFamily: 'monospace', fontSize: 18, marginBottom: 4, color: themes[theme]['--display-text'] }}>{ticket}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                     </div>
                 </div>
            )}
         </div>
         <div ref={assignmentExportRef}>
            {assignmentToExport && (
              <div style={{ width: 900, padding: 40, boxSizing: 'border-box', ...themes[theme] }}>
                {logo && <img src={logo} alt="Logo" style={{ height: 80, width: 'auto', marginBottom: 24 }} />}
                <h2 style={{ fontSize: 32, fontWeight: 'bold', marginBottom: 8, color: themes[theme]['--title-color'] }}>{title}</h2>
                <h3 style={{ fontSize: 20, fontWeight: '600', marginBottom: 24, color: themes[theme]['--text-muted'] }}>
                  {assignmentToExport.type === 'team-divider' ? 'Team Assignments' : 'Role Assignments'}
                  {' · '}{new Date(assignmentToExport.timestamp).toLocaleString()}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px 32px' }}>
                  {assignmentToExport.type === 'team-divider'
                    ? assignmentToExport.data.map((team) => (
                      <div key={team.teamName}>
                        <h4 style={{ fontSize: 20, fontWeight: 'bold', borderBottom: `2px solid ${themes[theme]['--panel-border']}`, paddingBottom: 4, marginBottom: 8, color: themes[theme]['--title-color'] }}>{team.teamName}</h4>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                          {team.members.map((m) => <li key={m} style={{ fontSize: 16, marginBottom: 4, color: themes[theme]['--display-text'] }}>{m}</li>)}
                        </ul>
                      </div>
                    ))
                    : assignmentToExport.data.map((role) => (
                      <div key={role.role}>
                        <h4 style={{ fontSize: 20, fontWeight: 'bold', borderBottom: `2px solid ${themes[theme]['--panel-border']}`, paddingBottom: 4, marginBottom: 8, color: themes[theme]['--title-color'] }}>{role.role}</h4>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                          {role.participants.map((p) => <li key={p} style={{ fontSize: 16, marginBottom: 4, color: themes[theme]['--display-text'] }}>{p}</li>)}
                        </ul>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
         </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Tone from 'tone';
import * as htmlToImage from 'html-to-image';
import { themes, fonts } from '../utils/themeConfig';
import { Button, Input, ConfettiParticle } from './ui';
import { useSessionStorage } from '../hooks/useSessionStorage';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { MAX_ENTRIES, parseEntries, parseEntriesFromCsv } from '../utils/parseEntries';
import { downloadJson, downloadCsv, buildWinnersCsvRows, buildAuditLogCsvRows, buildAssignmentCsvRows } from '../utils/exportUtils';
import { isValidSessionData, parseSessionJson } from '../utils/validation';
import { sessionTemplates } from '../utils/sessionTemplates';
import {
  GRAND_FINALE_DRAW_DURATION_MS,
  REGULAR_NAME_DRAW_DURATION_MS,
  getNumericReelConfigs,
  getPaddedDigits,
  getWinnerAnimationDurationMs,
  isGrandPrizeDraw,
} from '../hooks/useDrawEngine';
import { assignRoles, createAuditEntry, divideIntoTeams, getNoRepeatSet, parseRoleRules } from '../utils/drawModes';
import { buildPublicViewUrl } from '../utils/publicViewUrl';
import { useRealtimePublisher } from '../hooks/useRealtimePublisher';
import { usePublicBroadcast } from '../hooks/usePublicBroadcast';
import { useRemoteDrawController } from '../hooks/useRemoteDrawController';
import { useFinaleModeReset } from '../hooks/useFinaleModeReset';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { clearRoomCredentials, createRoomCredentials, loadRoomCredentials, saveRoomCredentials } from '../utils/realtimeRoom';
import { buildRemoteControlUrl, clearRemoteControlCredentials, createRemoteControlCredentials, isHostReadyForRemoteDraw, loadRemoteControlCredentials, saveRemoteControlCredentials } from '../utils/remoteControl';
import { getTypographyProps } from '../utils/typography';
import LetterGlitch from './LetterGlitch';
import GrandFinale from './GrandFinale';
import WinnerCarousel from './WinnerCarousel';
import AboutPanel from './AboutPanel';
import { updatePrizeName } from '../utils/prizes';
import { selectRandomEntries } from '../utils/secureRandom';

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
const MAX_EMBEDDED_IMAGE_CHARS = 4_000_000;
const LETTER_GLITCH_COLORS = ['#123044', '#06b6d4', '#facc15'];
const MAGNIFIC_AUDIO = {
  applauseOnly: `${process.env.PUBLIC_URL || ''}/audio/magnific-applause-only.mp3`,
  cinematicReveal: `${process.env.PUBLIC_URL || ''}/audio/magnific-cinematic-reveal.mp3`,
};
const LIVE_SYNC_LABELS = {
  unconfigured: 'Setup required',
  idle: 'Not connected',
  connecting: 'Connecting…',
  syncing: 'Updating…',
  live: 'Live',
  error: 'Sync error',
};
const REMOTE_LISTENER_LABELS = {
  unconfigured: 'Setup required',
  idle: 'Disabled',
  connecting: 'Connecting…',
  listening: 'Listening',
  error: 'Listener error',
};
const SETTINGS_SECTIONS = [
  { id: 'event', icon: '✦', label: 'Event', description: 'Branding, typography, and display' },
  { id: 'draw', icon: '◎', label: 'Draw', description: 'Participants, fairness, and prizes' },
  { id: 'sound', icon: '♫', label: 'Sound', description: 'Volume and cue previews' },
  { id: 'public', icon: '↗', label: 'Audience', description: 'Public display and live sharing' },
  { id: 'templates', icon: '▦', label: 'Presets', description: 'Quick event configurations' },
  { id: 'about', icon: 'i', label: 'About', description: 'Application information' },
];

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
  const [publicDisplayValue, setPublicDisplayValue] = useState("01");
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [prizes, setPrizes] = useState([
    { id: 1, name: '3rd Prize' },
    { id: 2, name: '2nd Prize' },
    { id: 3, name: '1st Prize' },
  ]);
  const [winnersPerPrize, setWinnersPerPrize] = useState(1);
  const [drawMode, setDrawMode] = useState('numbers');
  const [scriptsLoaded, setScriptsLoaded] = useState({ tone: false });
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
  const [settingsTab, setSettingsTab] = useState('event');
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
  const [lastAssignmentResult, setLastAssignmentResult] = useState(null);
  const [exportAssignmentTrigger, setExportAssignmentTrigger] = useState(false);
  const [autosaveReady, setAutosaveReady] = useState(false);
  const [liveRoom, setLiveRoom] = useState(() => loadRoomCredentials());
  const [remoteControl, setRemoteControl] = useState(() => loadRemoteControlCredentials());
  const [roomActionPending, setRoomActionPending] = useState(false);
  const [grandFinalePhase, setGrandFinalePhase] = useState('idle');

  // Refs
  const animationTimersRef = useRef(new Set());
  const finaleTimeoutRef = useRef(null);
  const chargeIntervalRef = useRef(null);
  const chargeLockRef = useRef(false);
  const displayRef = useRef(null);
  const fileInputRef = useRef(null);
  const sessionInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const bgImageInputRef = useRef(null);
  const settingsButtonRef = useRef(null);
  const settingsDialogRef = useRef(null);
  const historyPanelRef = useRef(null);
  const exportRef = useRef(null);
  const exportAllRef = useRef(null);
  const exportAssignmentRef = useRef(null);
  const drawActionRef = useRef(() => {});
  const drawLockRef = useRef(false);
  const audioStarted = useRef(false);
  const displayValueRef = useRef(displayValue);
  const almostTriggered = useRef(false);
  const sfxVolumeNode = useRef(null);
  const musicVolumeNode = useRef(null);
  const applauseFilterNode = useRef(null);
  const tickSynth = useRef(null);
  const drumrollSynth = useRef(null);
  const applauseSynth = useRef(null);
  const grandRiserSynth = useRef(null);
  const grandImpactSynth = useRef(null);
  const regularRiserSynth = useRef(null);
  const magnificApplausePlayer = useRef(null);
  const magnificRevealPlayer = useRef(null);

  const appState = useMemo(() => ({
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
    winnerEligibilityMode, noRepeatAcrossPrizes, auditLog,
    lastAssignmentResult
  }), [
    initialEntries, remainingEntries, winnersHistory, prizes, winnersPerPrize,
    inputValue, maxDigits, theme, logo, title, subtitle, titleLineSpacing,
    subtitleLineSpacing, titleLetterSpacing, subtitleLetterSpacing, backgroundImage,
    masterVolume, sfxVolume, musicVolume, titleColor, subtitleColor, titleFont,
    subtitleFont, titleFontSize, subtitleFontSize, drawMode, displayFont,
    displayFontSize, displayLineHeight, displayLetterSpacing, displayBoxWidth,
    displayBoxHeight, operationMode, teamCount, roleConfigText, allowMultipleRoles,
    winnerEligibilityMode, noRepeatAcrossPrizes, auditLog, lastAssignmentResult
  ]);

  const publicRemainingEntriesCount = useMemo(() => {
    const activeEntries = operationMode === 'standard' ? remainingEntries : initialEntries;
    if (!noRepeatAcrossPrizes) return activeEntries.length;
    const blockedEntries = getNoRepeatSet(auditLog);
    return activeEntries.filter((entry) => !blockedEntries.has(entry)).length;
  }, [auditLog, initialEntries, noRepeatAcrossPrizes, operationMode, remainingEntries]);

  const publicLiveState = useMemo(() => ({
    ...appState,
    drawing,
    currentPrize: drawing || showConfetti || grandFinalePhase !== 'idle'
      ? currentPrize
      : prizes[winnersHistory.length]?.name || currentPrize,
    publicDisplayValue,
    grandFinalePhase,
    showConfetti,
    remoteControlReady: Boolean(remoteControl && liveRoom && remoteControl.roomId === liveRoom.roomId) && isHostReadyForRemoteDraw({
      drawing,
      isCharging,
      remainingEntriesCount: publicRemainingEntriesCount,
      operationMode,
      completedPrizeCount: winnersHistory.length,
      prizeCount: prizes.length,
    }),
    completedPrizeCount: winnersHistory.length,
    prizeCount: prizes.length,
    totalEntries: initialEntries.length,
    remainingEntriesCount: publicRemainingEntriesCount,
  }), [
    appState, drawing, currentPrize, publicDisplayValue, grandFinalePhase,
    showConfetti, isCharging, operationMode, winnersHistory.length,
    prizes, initialEntries.length, publicRemainingEntriesCount, liveRoom, remoteControl,
  ]);

  // --- SESSION MANAGEMENT ---

  const restoreSession = (data, { announce = true } = {}) => {
    try {
        if (!isValidSessionData(data)) {
            throw new Error("Invalid session data structure.");
        }
        setInitialEntries(data.initialEntries ?? []);
        setRemainingEntries(data.remainingEntries ?? data.initialEntries ?? []);
        setWinnersHistory(data.winnersHistory ?? []);
        setPrizes(data.prizes ?? [{ id: 1, name: '3rd Prize' }, { id: 2, name: '2nd Prize' }, { id: 3, name: '1st Prize' }]);
        setInputValue(data.inputValue ?? data.initialEntries.join(', '));
        const restoredMaxDigits = data.maxDigits ?? 2;
        setMaxDigits(restoredMaxDigits);
        setTitle(data.title ?? 'Live Lucky Draw');
        setSubtitle(data.subtitle ?? 'The most exciting draw on the web!');
        setTitleLineSpacing(data.titleLineSpacing ?? 1.2);
        setSubtitleLineSpacing(data.subtitleLineSpacing ?? 1.5);
        setTitleLetterSpacing(data.titleLetterSpacing ?? 0);
        setSubtitleLetterSpacing(data.subtitleLetterSpacing ?? 0);
        setTitleFontSize(data.titleFontSize ?? 48);
        setSubtitleFontSize(data.subtitleFontSize ?? 16);
        setWinnersPerPrize(data.winnersPerPrize ?? 1);
        setTheme(data.theme ?? 'Event Night');
        setLogo(data.logo ?? null);
        setBackgroundImage(data.backgroundImage ?? '');
        setMasterVolume(Number(data.masterVolume ?? 0));
        setSfxVolume(Number(data.sfxVolume ?? -6));
        setMusicVolume(Number(data.musicVolume ?? 0));
        setTitleColor(data.titleColor ?? '');
        setSubtitleColor(data.subtitleColor ?? '');
        setTitleFont(data.titleFont ?? 'sans-serif');
        setSubtitleFont(data.subtitleFont ?? 'sans-serif');
        setDisplayFont(data.displayFont ?? "'Roboto Mono', 'Noto Sans Myanmar', monospace");
        setDisplayFontSize(data.displayFontSize ?? 92);
        setDisplayLineHeight(data.displayLineHeight ?? 1.02);
        setDisplayLetterSpacing(data.displayLetterSpacing ?? 0.1);
        setDisplayBoxWidth(data.displayBoxWidth ?? 480);
        setDisplayBoxHeight(data.displayBoxHeight ?? 180);
        setDrawMode(data.drawMode ?? 'numbers');
        setOperationMode(data.operationMode ?? 'standard');
        setTeamCount(data.teamCount ?? 2);
        setRoleConfigText(data.roleConfigText ?? 'Host:1\nJudge:2');
        setAllowMultipleRoles(Boolean(data.allowMultipleRoles));
        setWinnerEligibilityMode(data.winnerEligibilityMode ?? 'remove');
        setNoRepeatAcrossPrizes(Boolean(data.noRepeatAcrossPrizes));
        setAuditLog(Array.isArray(data.auditLog) ? data.auditLog : []);
        setLastAssignmentResult(data.lastAssignmentResult || null);
        const firstEntry = (data.remainingEntries && data.remainingEntries[0]) || (data.initialEntries && data.initialEntries[0]) || '1';
        setDisplayValue(firstEntry);
        if (announce) {
            setSuccessMessage('Session restored successfully!');
            setTimeout(() => setSuccessMessage(''), 3000);
        }
    } catch (err) {
        setError('Invalid or corrupted session file.');
        setTimeout(() => setError(''), 3000);
    }
  };

  useEffect(() => {
    try {
      const savedState = localStorage.getItem('lucky-draw-autosave');
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        if (isValidSessionData(parsedState)) {
          restoreSession(parsedState, { announce: false });
        }
      }
    } catch (err) {
      console.error('Failed to restore autosaved session', err);
    } finally {
      setAutosaveReady(true);
    }
  // Restore only once before autosave is enabled.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useSessionStorage('lucky-draw-autosave', appState, autosaveReady);
  usePublicBroadcast('lucky-draw-autosave', publicLiveState, autosaveReady);

  const liveSync = useRealtimePublisher({
    roomId: liveRoom?.roomId || '',
    writeKey: liveRoom?.writeKey || '',
    appState: publicLiveState,
    enabled: autosaveReady && Boolean(liveRoom) && !roomActionPending,
  });
  const remoteListener = useRemoteDrawController({
    roomId: liveRoom?.roomId || '',
    writeKey: liveRoom?.writeKey || '',
    enabled: autosaveReady && Boolean(liveRoom) && Boolean(remoteControl) && !roomActionPending,
    onDraw: () => {
      setShowSettings(false);
      setHistoryPanelOpen(false);
      return drawActionRef.current();
    },
  });
  const publicViewUrl = buildPublicViewUrl(window.location.href, liveRoom?.roomId || '');
  const remoteControlUrl = remoteControl?.roomId === liveRoom?.roomId
    ? buildRemoteControlUrl(window.location.href, remoteControl)
    : '';

  useEffect(() => {
    if (remoteControl && (!liveRoom || remoteControl.roomId !== liveRoom.roomId)) {
      clearRemoteControlCredentials();
      setRemoteControl(null);
    }
  }, [liveRoom, remoteControl]);

  // Script and Audio Setup
  useAudioEngine({ setScriptsLoaded });

  useEffect(() => {
    if (!scriptsLoaded.tone || tickSynth.current) return undefined;

    sfxVolumeNode.current = new Tone.Volume(0).toDestination();
    musicVolumeNode.current = new Tone.Volume(0).toDestination();
    applauseFilterNode.current = new Tone.Filter({ frequency: 7200, type: 'lowpass', rolloff: -12 }).connect(musicVolumeNode.current);

    tickSynth.current = new Tone.MembraneSynth().connect(sfxVolumeNode.current);
    drumrollSynth.current = new Tone.MembraneSynth({ pitchDecay: 0.015, octaves: 3, envelope: { attack: 0.001, decay: 0.16, sustain: 0 } }).connect(sfxVolumeNode.current);
    applauseSynth.current = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0 }}).connect(musicVolumeNode.current);
    regularRiserSynth.current = new Tone.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 1.5, decay: 1, sustain: 0.03, release: 0.25 } }).connect(sfxVolumeNode.current);
    grandRiserSynth.current = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 3.5, decay: 4.5, sustain: 0.08, release: 0.6 } }).connect(sfxVolumeNode.current);
    grandImpactSynth.current = new Tone.MembraneSynth({ pitchDecay: 0.12, octaves: 8, envelope: { attack: 0.001, decay: 1.8, sustain: 0, release: 0.2 } }).connect(sfxVolumeNode.current);
    magnificApplausePlayer.current = new Tone.Player({ url: MAGNIFIC_AUDIO.applauseOnly, fadeIn: 0.04, fadeOut: 0.5 }).connect(applauseFilterNode.current);
    magnificRevealPlayer.current = new Tone.Player({ url: MAGNIFIC_AUDIO.cinematicReveal, fadeIn: 0.01, fadeOut: 0.12 }).connect(sfxVolumeNode.current);

    regularRiserSynth.current.volume.value = -20;
    grandRiserSynth.current.volume.value = -15;
    grandImpactSynth.current.volume.value = -3;
    magnificApplausePlayer.current.volume.value = -8;
    magnificRevealPlayer.current.volume.value = -4;

    return () => {
      [tickSynth, drumrollSynth, applauseSynth, regularRiserSynth, grandRiserSynth, grandImpactSynth, magnificApplausePlayer, magnificRevealPlayer].forEach((ref) => {
        ref.current?.dispose();
        ref.current = null;
      });
      [applauseFilterNode, sfxVolumeNode, musicVolumeNode].forEach((ref) => {
        ref.current?.dispose();
        ref.current = null;
      });
    };
  }, [scriptsLoaded.tone]);

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
    displayValueRef.current = String(displayValue ?? '');
    if (!drawing) setPublicDisplayValue(displayValueRef.current);
  }, [displayValue, drawing]);

  useEffect(() => {
    if (!drawing) return undefined;
    setPublicDisplayValue(displayValueRef.current);
    const publicDisplayTimer = setInterval(() => {
      setPublicDisplayValue(displayValueRef.current);
    }, 300);
    return () => clearInterval(publicDisplayTimer);
  }, [drawing]);

  useEffect(() => {
    if (!showSettings || !settingsDialogRef.current) return undefined;

    const dialog = settingsDialogRef.current;
    const settingsButton = settingsButtonRef.current;
    const focusableSelector = 'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements = () => Array.from(dialog.querySelectorAll(focusableSelector));
    focusableElements()[0]?.focus();

    const trapFocus = (event) => {
      if (event.key !== 'Tab') return;
      const elements = focusableElements();
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener('keydown', trapFocus);
    return () => {
      dialog.removeEventListener('keydown', trapFocus);
      settingsButton?.focus();
    };
  }, [showSettings]);

  useEffect(() => {
    if (!showSettings && !historyPanelOpen) return undefined;

    const closeSurfaceOnOutsideClick = (event) => {
      if (showSettings && settingsDialogRef.current && !settingsDialogRef.current.contains(event.target)) {
        setShowSettings(false);
      }
      if (historyPanelOpen && historyPanelRef.current && !historyPanelRef.current.contains(event.target)) {
        setHistoryPanelOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeSurfaceOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeSurfaceOnOutsideClick);
  }, [historyPanelOpen, showSettings]);

  useFinaleModeReset({ operationMode, finaleTimeoutRef, setGrandFinalePhase, setShowConfetti });

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
    if (entries.length > MAX_ENTRIES) { setError(`Too many entries. Please provide ${MAX_ENTRIES.toLocaleString()} or less.`); return; }
    processEntries(entries, { duplicateGroups: duplicates, blankCount });
  };

  const resetDraw = (entriesToUse = initialEntries, newMaxDigits = maxDigits) => {
    stopCelebrationAudio();
    setRemainingEntries(entriesToUse);
    setWinnersHistory([]);
    const firstEntry = entriesToUse[0] || (drawMode === 'numbers' ? '1' : 'Winner');
    setAuditLog([]);
    setDisplayValue(firstEntry);
    setCurrentPrize('');
    setError('');
    setShowConfetti(false);
    setGrandFinalePhase('idle');
    clearTimeout(finaleTimeoutRef.current);
    setLastAssignmentResult(null);
  };
  
  const handleUndo = () => {
    if (auditLog.length === 0 || drawing) return;
    stopCelebrationAudio();
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
      setLastAssignmentResult(null);
    }

    setError('');
    setShowConfetti(false);
    setGrandFinalePhase('idle');
    clearTimeout(finaleTimeoutRef.current);
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
        winnerEligibilityMode, noRepeatAcrossPrizes, auditLog,
        lastAssignmentResult
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

  const handleExportAssignmentCsv = () => {
    if (!lastAssignmentResult) return;
    const suffix = lastAssignmentResult.mode === 'team-divider' ? 'teams' : 'roles';
    downloadCsv(`${title.replace(/\s+/g, '-')}-${suffix}.csv`, buildAssignmentCsvRows(lastAssignmentResult));
  };

  const copyText = async (value) => {
    let copied = false;
    try {
      await navigator.clipboard.writeText(value);
      copied = true;
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = value;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      copied = document.execCommand('copy');
      textArea.remove();
    }

    return copied;
  };

  const handleCopyPublicViewUrl = async () => {
    const copied = await copyText(publicViewUrl);
    if (copied) {
      setSuccessMessage('Public view link copied!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } else {
      setError('Could not copy the link. Select the URL and copy it manually.');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleCopyRemoteControlUrl = async () => {
    const copied = await copyText(remoteControlUrl);
    if (copied) {
      setSuccessMessage('Private MC remote link copied!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } else {
      setError('Could not copy the remote link. Select the URL and copy it manually.');
      setTimeout(() => setError(''), 4000);
    }
  };

  const createAndActivateLiveRoom = async (message) => {
    const credentials = createRoomCredentials();
    const { error: createError } = await supabase.rpc('create_draw_room', {
      p_room_id: credentials.roomId,
      p_write_key: credentials.writeKey,
    });
    if (createError) throw createError;

    saveRoomCredentials(credentials);
    setLiveRoom(credentials);
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 3500);
  };

  const startLiveRoom = async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Add the two required environment variables and redeploy.');
      setTimeout(() => setError(''), 5000);
      return;
    }

    setRoomActionPending(true);
    try {
      await createAndActivateLiveRoom('Cross-device room started. Share the new public link.');
    } catch (roomError) {
      setError(roomError.message || 'Could not create a secure live room.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setRoomActionPending(false);
    }
  };

  const enableRemoteControl = async ({ rotated = false } = {}) => {
    if (!liveRoom || roomActionPending) return;
    setRoomActionPending(true);
    setError('');
    try {
      const credentials = createRemoteControlCredentials(liveRoom.roomId);
      const { error: remoteError } = await supabase.rpc('enable_draw_remote_control', {
        p_room_id: liveRoom.roomId,
        p_write_key: liveRoom.writeKey,
        p_remote_key: credentials.remoteKey,
      });
      if (remoteError) throw remoteError;
      saveRemoteControlCredentials(credentials);
      setRemoteControl(credentials);
      setSuccessMessage(rotated ? 'A new private MC remote link is ready.' : 'Secure MC remote control enabled.');
      setTimeout(() => setSuccessMessage(''), 3500);
    } catch (remoteError) {
      setError(remoteError.message || 'Could not enable secure remote control. Run the latest Supabase schema and try again.');
      setTimeout(() => setError(''), 6000);
    } finally {
      setRoomActionPending(false);
    }
  };

  const disableRemoteControl = async () => {
    if (!liveRoom || !remoteControl || roomActionPending) return;
    setRoomActionPending(true);
    setError('');
    try {
      const { error: remoteError } = await supabase.rpc('disable_draw_remote_control', {
        p_room_id: liveRoom.roomId,
        p_write_key: liveRoom.writeKey,
      });
      if (remoteError) throw remoteError;
      clearRemoteControlCredentials();
      setRemoteControl(null);
      setSuccessMessage('MC remote control disabled. The old link no longer works.');
      setTimeout(() => setSuccessMessage(''), 3500);
    } catch (remoteError) {
      setError(remoteError.message || 'Could not disable remote control.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setRoomActionPending(false);
    }
  };

  const stopLiveRoom = async ({ startAnother = false } = {}) => {
    if (!liveRoom || roomActionPending) return;
    let roomClosed = false;
    setRoomActionPending(true);
    setError('');

    try {
      const { error: closeError } = await supabase.rpc('close_draw_room', {
        p_room_id: liveRoom.roomId,
        p_write_key: liveRoom.writeKey,
      });
      if (closeError) throw closeError;
      roomClosed = true;

      clearRoomCredentials();
      clearRemoteControlCredentials();
      setLiveRoom(null);
      setRemoteControl(null);
      if (startAnother) {
        await createAndActivateLiveRoom('A new cross-device room is ready. Share the new link.');
      } else {
        setSuccessMessage('Cross-device sharing stopped and the public room was removed.');
        setTimeout(() => setSuccessMessage(''), 3500);
      }
    } catch (roomError) {
      setError(roomError.message || (roomClosed && startAnother
        ? 'The old room was closed, but a new room could not be created.'
        : 'Could not close the live room.'));
      setTimeout(() => setError(''), 5000);
    } finally {
      setRoomActionPending(false);
    }
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
    resetDraw(initialEntries);
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

        if (parsed.entries.length > MAX_ENTRIES) {
            setError(`Too many entries. Please provide ${MAX_ENTRIES.toLocaleString()} or less.`);
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
      if (parsed.error) {
        setError(parsed.error);
        return;
      }

      if (parsed.entries.length < 1) {
        setError('CSV file does not contain valid entries.');
        return;
      }

      if (parsed.entries.length > MAX_ENTRIES) {
        setError(`Too many entries. Please provide ${MAX_ENTRIES.toLocaleString()} or less.`);
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
  ).slice(0, 100);

  const updateEntryAt = (indexToUpdate, value) => {
    const nextValue = value.trim();
    if (!nextValue) return;

    const nextEntries = initialEntries.map((entry, idx) => (idx === indexToUpdate ? nextValue : entry));
    const normalized = parseEntries(nextEntries.join(', '), drawMode);
    if (normalized.error) {
      setError(normalized.error);
      return;
    }
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
            const nextLogo = event.target.result;
            if (nextLogo.length + backgroundImage.length > MAX_EMBEDDED_IMAGE_CHARS) {
                setError('Logo and background images are too large to autosave. Please use smaller image files.');
                return;
            }
            setLogo(nextLogo);
        };
        reader.readAsDataURL(file);
    }
    e.target.value = null;
  };
  
  const handleBgImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const nextBackgroundImage = event.target.result;
            if (nextBackgroundImage.length + (logo?.length || 0) > MAX_EMBEDDED_IMAGE_CHARS) {
                setError('Logo and background images are too large to autosave. Please use smaller image files.');
                return;
            }
            setBackgroundImage(nextBackgroundImage);
        };
        reader.readAsDataURL(file);
    }
    e.target.value = null;
  };
  
  const playMagnificPlayer = (playerRef, now, duration) => {
    const player = playerRef.current;
    if (!player?.loaded) return false;
    try {
      if (player.state === 'started') player.stop(now);
      player.start(now + 0.015, 0, duration);
      return true;
    } catch (error) {
      console.warn('Magnific audio layer could not play', error);
      return false;
    }
  };

  const stopCelebrationAudio = () => {
    const now = Tone.now();
    [magnificRevealPlayer, magnificApplausePlayer].forEach((playerRef) => {
      try {
        if (playerRef.current?.state === 'started') playerRef.current.stop(now);
      } catch (error) {
        console.warn('Celebration audio could not be stopped cleanly', error);
      }
    });
  };

  const playDrumroll = (prizeIndex = 0, prizeCount = 1) => {
    const now = Tone.now();
    const progress = prizeCount > 1 ? prizeIndex / (prizeCount - 1) : 0;
    regularRiserSynth.current?.triggerAttackRelease(2.5, now);
    if (drumrollSynth.current) {
      const hits = [0, 0.42, 0.78, 1.08, 1.34, 1.56, 1.74, 1.89, 2.02, 2.13];
      hits.forEach((offset, index) => {
        const pitch = index % 4 === 0 ? 'C2' : index % 2 === 0 ? 'G1' : 'C2';
        const velocity = Math.min(1, 0.42 + progress * 0.14 + index * 0.055);
        drumrollSynth.current.triggerAttackRelease(pitch, '32n', now + offset, velocity);
      });
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
    const hasCinematicReveal = playMagnificPlayer(magnificRevealPlayer, now, 2.05);
    const hasApplause = playMagnificPlayer(magnificApplausePlayer, now + 0.12, 4.5);

    if (!hasCinematicReveal) {
      grandImpactSynth.current?.triggerAttackRelease('C1', '8n', now);
    }
    if (!hasApplause) playApplause();
  };

  const playGrandFinaleBuild = (buildDurationMs = GRAND_FINALE_DRAW_DURATION_MS) => {
    const now = Tone.now();
    const buildDurationSeconds = Math.max(1, buildDurationMs / 1000);
    grandRiserSynth.current?.triggerAttackRelease(buildDurationSeconds, now);
    if (drumrollSynth.current) {
      let offset = 0;
      let gap = 0.72;
      let hitIndex = 0;
      while (offset < buildDurationSeconds - 0.25) {
        const pitch = hitIndex % 4 === 0 ? 'C2' : hitIndex % 2 === 0 ? 'G1' : 'C2';
        const velocity = Math.min(1, 0.46 + (offset / buildDurationSeconds) * 0.5);
        drumrollSynth.current.triggerAttackRelease(pitch, '32n', now + offset, velocity);
        offset += gap;
        gap = Math.max(0.25, gap * 0.92);
        hitIndex += 1;
      }
    }
  };

  const playGrandFinaleReveal = () => {
    const now = Tone.now();
    playMagnificPlayer(magnificRevealPlayer, now, 2.05);
    const hasApplause = playMagnificPlayer(magnificApplausePlayer, now + 0.1, 9.8);
    grandImpactSynth.current?.triggerAttackRelease('C1', '1n', now);
    if (!hasApplause) playApplause();
  };

  const ensureAudioStarted = async () => {
    if (scriptsLoaded.tone && !audioStarted.current) {
      await Tone.start();
      audioStarted.current = true;
    }
  };

  const startCharging = async () => {
    if (drawing || drawLockRef.current || chargeLockRef.current || isCharging || getEligibleEntries(remainingEntries).length === 0 || winnersHistory.length >= prizes.length) return;
    chargeLockRef.current = true;

    try {
      await ensureAudioStarted();
    } catch (err) {
      chargeLockRef.current = false;
      setError('Audio could not start. Please try again.');
      return;
    }

    clearInterval(chargeIntervalRef.current);

    setIsCharging(true);
    let nextCharge = 0;
    chargeIntervalRef.current = setInterval(() => {
        nextCharge = Math.min(100, nextCharge + 2);
        setCharge(nextCharge);
        if (tickSynth.current) {
            const pitch = 40 + (nextCharge * 1.5);
            tickSynth.current.triggerAttackRelease(pitch, "8n");
        }
        if (nextCharge >= 100) {
            clearInterval(chargeIntervalRef.current);
            chargeLockRef.current = false;
            setIsCharging(false);
            setCharge(0);
            drawNextWinner();
        }
    }, 30);
  };

  const stopCharging = () => {
    clearInterval(chargeIntervalRef.current);
    chargeLockRef.current = false;
    setIsCharging(false);
    setCharge(0);
  };

  const getEligibleEntries = (pool) => {
    if (!noRepeatAcrossPrizes) return pool;
    const blocked = getNoRepeatSet(auditLog);
    return pool.filter((entry) => !blocked.has(entry));
  };

  const runSingleWinnerAnimation = (winnerEntry, isFinalWinnerOfBatch) => {
    return new Promise((resolve) => {
        const isFinalPrize = isGrandPrizeDraw(winnersHistory.length, prizes.length);
        const isGrandFinal = isFinalPrize && isFinalWinnerOfBatch;
        const slowMoDuration = isGrandFinal
            ? GRAND_FINALE_DRAW_DURATION_MS
            : REGULAR_NAME_DRAW_DURATION_MS;
        let finished = false;
        const timers = animationTimersRef.current;

        timers.forEach((timerId) => clearTimeout(timerId));
        timers.clear();

        const schedule = (callback, delay) => {
            const timerId = setTimeout(() => {
                timers.delete(timerId);
                callback();
            }, delay);
            timers.add(timerId);
            return timerId;
        };

        const finishAnimation = () => {
            if (finished) return;
            finished = true;
            timers.forEach((timerId) => clearTimeout(timerId));
            timers.clear();
            resolve();
        };

        const animationStart = Date.now();
        
        if (drawMode === 'names') {
            // Safety net remains independent from the animation-loop timer.
            schedule(() => {
                setDisplayValue(String(winnerEntry));
                finishAnimation();
            }, slowMoDuration + 5000);

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
                schedule(nameAnimationLoop, nextDelay);
            };
            nameAnimationLoop();
        } else {
            const winnerDigits = getDigits(winnerEntry);
            const reelConfigs = getNumericReelConfigs(winnerDigits.length, isGrandFinal);
            const animationTotalDuration = reelConfigs.reduce(
                (maxDuration, reel) => Math.max(maxDuration, reel.start + reel.duration),
                0,
            );

            schedule(() => {
                setDisplayValue(String(winnerEntry));
                finishAnimation();
            }, animationTotalDuration + 5000);
            
            const animationLoop = () => {
                const elapsed = Date.now() - animationStart;
                let nextDelay = 75;

                if (elapsed >= animationTotalDuration + (isGrandFinal ? 700 : 300)) {
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
                    const totalSteps = isGrandFinal ? 24 : 14;
                    const currentStep = Math.floor(easing * totalSteps);
                    const finalDigit = parseInt(digit, 10);
                    return Number.isNaN(finalDigit)
                        ? digit
                        : (finalDigit + totalSteps - currentStep) % 10;
                });

                if (isGrandFinal && !almostTriggered.current && elapsed >= animationTotalDuration - 1100) {
                    almostTriggered.current = true;
                    const finalDigitIndex = maxDigits - 1;
                    const finalDigit = parseInt(winnerDigits[finalDigitIndex], 10);
                    if (!Number.isNaN(finalDigit)) {
                        newDisplayDigits[finalDigitIndex] = (finalDigit + 1) % 10;
                    }
                    setDisplayValue(newDisplayDigits.join(''));
                    schedule(animationLoop, 850);
                    return;
                }

                setDisplayValue(newDisplayDigits.join(''));
                if (tickSynth.current) tickSynth.current.triggerAttackRelease("C1", "16n");

                const globalProgress = Math.min(1, elapsed / animationTotalDuration);
                nextDelay = 40 + globalProgress * 170;
                schedule(animationLoop, nextDelay);
            };
            animationLoop();
        }
    });
  };

  const drawNextWinner = async () => {
    if (drawLockRef.current || drawing) return;
    drawLockRef.current = true;

    try {
      await ensureAudioStarted();

    if (operationMode !== 'standard') {
      const eligible = getEligibleEntries(initialEntries);
      if (eligible.length === 0) {
        setError('No eligible participants left for this mode.');
        return;
      }

      if (operationMode === 'team-divider') {
        const teams = divideIntoTeams(eligible, teamCount);
        const selected = teams.flatMap((team) => team.members);
        const remainingCount = noRepeatAcrossPrizes ? eligible.length - new Set(selected).size : eligible.length;
        setAuditLog((prev) => [...prev, createAuditEntry({ mode: 'team-divider', context: `${teams.length} teams`, selected, remainingCount })]);
        setLastAssignmentResult({ mode: 'team-divider', teams });
        setCurrentPrize(`Team Divider (${teams.length} teams)`);
        setDrawing(true);
        for (let i = 0; i < teams.length; i++) {
          setDisplayValue(`${teams[i].teamName}: ${teams[i].members.join(', ')}`);
          setPulse(true);
          if (i < teams.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 2500));
          }
        }
        return;
      }

      const { rules: roleRules, error: roleRulesError } = parseRoleRules(roleConfigText, MAX_ENTRIES);
      if (roleRulesError) {
        setError(roleRulesError);
        return;
      }
      const requestedRoleCount = roleRules.reduce((sum, role) => sum + role.count, 0);
      if (!allowMultipleRoles && requestedRoleCount > eligible.length) {
        setError(`Not enough eligible participants: ${requestedRoleCount} role slots requested for ${eligible.length} participants.`);
        return;
      }
      const assignments = assignRoles(eligible, roleRules, { allowMultipleRoles });
      const selected = assignments.flatMap((role) => role.participants);
      const remainingCount = noRepeatAcrossPrizes ? eligible.length - new Set(selected).size : eligible.length;
      setAuditLog((prev) => [...prev, createAuditEntry({ mode: 'role-selector', context: `${assignments.length} roles`, selected, remainingCount })]);
      setLastAssignmentResult({ mode: 'role-selector', assignments });
      setCurrentPrize('Role Selector');
      setDrawing(true);
      for (let i = 0; i < assignments.length; i++) {
        setDisplayValue(`${assignments[i].role}: ${assignments[i].participants.join(', ')}`);
        setPulse(true);
        if (i < assignments.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2500));
        }
      }
      return;
    }

    const sourcePool = getEligibleEntries(remainingEntries);
    const numToDraw = Math.min(winnersPerPrize, sourcePool.length);
    if (drawing || numToDraw === 0 || winnersHistory.length >= prizes.length) {
        if (sourcePool.length === 0) setError('All entries have been drawn!');
        if (winnersHistory.length >= prizes.length) setError('All prizes have been awarded!');
        return;
    }

    setDrawing(true);
    setError('');
    clearTimeout(finaleTimeoutRef.current);
    stopCelebrationAudio();
    setShowConfetti(false);
    setPulse(true);
    almostTriggered.current = false;

    const currentPrizeName = getPrizeName();
    const isGrandPrize = isGrandPrizeDraw(winnersHistory.length, prizes.length);
    setCurrentPrize(currentPrizeName);
    if (isGrandPrize) {
      setGrandFinalePhase('build');
      clearTimeout(finaleTimeoutRef.current);
      const regularWinnerDuration = getWinnerAnimationDurationMs({
        drawMode,
        digitCount: maxDigits,
        isGrandFinal: false,
      });
      const finalWinnerDuration = getWinnerAnimationDurationMs({
        drawMode,
        digitCount: maxDigits,
        isGrandFinal: true,
      });
      playGrandFinaleBuild(((numToDraw - 1) * regularWinnerDuration) + finalWinnerDuration);
    } else {
      setGrandFinalePhase('idle');
      playDrumroll(winnersHistory.length, prizes.length);
    }

    const drawnTickets = selectRandomEntries(sourcePool, numToDraw);

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
    const nextEligibleCount = noRepeatAcrossPrizes ? sourcePool.length - drawnTickets.length : nextRemaining.length;
    setAuditLog((prev) => [...prev, createAuditEntry({ mode: 'standard', context: currentPrizeName, selected: drawnTickets, remainingCount: nextEligibleCount })]);
    setShowConfetti(true);
    if (isGrandPrize) {
      setGrandFinalePhase('reveal');
      playGrandFinaleReveal();
      finaleTimeoutRef.current = setTimeout(() => {
        setShowConfetti(false);
        setGrandFinalePhase('carousel');
      }, 9000);
    } else {
      playCelebration();
      finaleTimeoutRef.current = setTimeout(() => setShowConfetti(false), 5000);
    }
    } catch (err) {
      console.error('Draw failed', err);
      setError('The draw could not be completed. Please try again.');
      setGrandFinalePhase('idle');
    } finally {
      drawLockRef.current = false;
      setDrawing(false);
    }
  };

  drawActionRef.current = drawNextWinner;

  useEffect(() => {
    const handleShortcuts = (event) => {
      if (showSettings) {
        if (event.key === 'Escape') setShowSettings(false);
        return;
      }
      if (event.key === 'Escape' && historyPanelOpen) {
        setHistoryPanelOpen(false);
        return;
      }
      if (event.key === 'Escape' && grandFinalePhase === 'carousel') {
        setGrandFinalePhase('idle');
        return;
      }
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') return;
      if (event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        drawActionRef.current();
      }
      if (event.key.toLowerCase() === 's') {
        setHistoryPanelOpen(false);
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
  }, [grandFinalePhase, historyPanelOpen, showSettings]);

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
    if (exportAssignmentTrigger && exportAssignmentRef.current && lastAssignmentResult) {
        const exportAssignmentImage = async () => {
            try {
                const dataUrl = await htmlToImage.toPng(exportAssignmentRef.current, {
                    quality: 0.95,
                    backgroundColor: themes[theme]['--bg-color'],
                });
                const suffix = lastAssignmentResult.mode === 'team-divider' ? 'teams' : 'roles';
                const link = document.createElement('a');
                link.download = `${title.replace(/\s/g, '-')}-${suffix}.png`;
                link.href = dataUrl;
                link.click();
            } catch (err) {
                console.error('Failed to export assignment image', err);
            } finally {
                setExportAssignmentTrigger(false);
            }
        };
        exportAssignmentImage();
    }
  }, [exportAssignmentTrigger, theme, title, lastAssignmentResult]);

  useEffect(() => {
    const animationTimers = animationTimersRef.current;
    return () => {
        animationTimers.forEach((timerId) => clearTimeout(timerId));
        animationTimers.clear();
        clearTimeout(finaleTimeoutRef.current);
        clearInterval(chargeIntervalRef.current);
        chargeLockRef.current = false;
        drawLockRef.current = false;
    };
  }, []);

  const currentTheme = themes[theme];
  const activePool = operationMode === 'standard' ? remainingEntries : initialEntries;
  const eligibleEntryCount = getEligibleEntries(activePool).length;
  const drawProgress = operationMode === 'standard' && prizes.length
    ? Math.min(100, Math.round((winnersHistory.length / prizes.length) * 100))
    : 0;
  const hasPrizeRemaining = operationMode !== 'standard' || winnersHistory.length < prizes.length;
  const canDraw = !drawing && eligibleEntryCount > 0 && hasPrizeRemaining;
  const quickStatus = drawing
    ? 'Drawing in progress...'
    : canDraw
      ? operationMode === 'standard' ? 'Ready for next draw' : 'Ready to run assignment'
      : eligibleEntryCount === 0 ? 'No eligible entries' : 'Draw completed';

  // Auto-expand display box for names in Standard Draw Mode
  const isStandardNames = operationMode === 'standard' && drawMode === 'names';
  const displayBoxComputedWidth = isStandardNames
    ? `min(${Math.max(displayBoxWidth, 640)}px, 95vw)`
    : `min(${displayBoxWidth}px, 95vw)`;
  const maxNameFontRem = Math.max(38, displayFontSize * 0.7) / 16;
  const nameLen = isStandardNames ? (displayValue || '').length : 0;
  const scaledNameFontRem = isStandardNames && nameLen > 0
    ? Math.min(maxNameFontRem, Math.max(1.5, 5 / Math.max(nameLen / 8, 1)))
    : maxNameFontRem;
  const displayNameFontSize = isStandardNames
    ? `clamp(1.5rem, ${scaledNameFontRem}rem, 6rem)`
    : `clamp(2rem, ${maxNameFontRem}rem, 6rem)`;
  const numberFontRem = Math.min(displayFontSize, Math.max(28, (displayBoxWidth - 48) / Math.max(maxDigits, 1))) / 16;
  const numberViewportMax = Math.min(24, 80 / Math.max(maxDigits, 1));
  const displayNumberFontSize = `clamp(1.75rem, ${numberFontRem}rem, ${numberViewportMax}vw)`;
  const assignmentResultMatchesMode = lastAssignmentResult?.mode === operationMode;
  const assignmentGroups = assignmentResultMatchesMode
    ? lastAssignmentResult.mode === 'team-divider'
      ? lastAssignmentResult.teams.map((team) => ({ label: team.teamName, members: team.members }))
      : lastAssignmentResult.assignments.map((assignment) => ({ label: assignment.role, members: assignment.participants }))
    : [];
  const mainDisplayValue = operationMode === 'standard' || drawing || assignmentResultMatchesMode
    ? displayValue
    : 'Ready';
  const titleTypography = getTypographyProps(title, titleFont, titleLetterSpacing);
  const subtitleTypography = getTypographyProps(subtitle, subtitleFont, subtitleLetterSpacing);
  const displayTypography = getTypographyProps(String(mainDisplayValue ?? ''), displayFont, displayLetterSpacing);
  const shapedTitle = (value) => getTypographyProps(String(value ?? ''), titleFont, 0);
  const shapedDisplay = (value) => getTypographyProps(String(value ?? ''), displayFont, 0);
  const mainStyle = {
    ...currentTheme,
    backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
  const showLetterGlitch = theme === 'Event Night' && !backgroundImage;
  const isGrandFinaleActive = grandFinalePhase !== 'idle';
  const isGrandFinaleReveal = grandFinalePhase === 'reveal';
  const activeSettingsSection = SETTINGS_SECTIONS.find((section) => section.id === settingsTab) || SETTINGS_SECTIONS[0];

  return (
    <div style={mainStyle} className="app-viewport relative flex flex-col items-center justify-center text-[var(--text-color)] p-4 pb-20 sm:pb-4 gap-3 sm:gap-6 font-sans overflow-hidden transition-all duration-500 bg-[var(--bg-color)]">
      {showLetterGlitch && (
        <div className="pointer-events-none fixed inset-0 z-0">
          <LetterGlitch
            glitchColors={LETTER_GLITCH_COLORS}
            glitchSpeed={50}
            centerVignette
            outerVignette={false}
            smooth
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>
      )}
      <AnimatePresence>
        {isGrandFinaleActive && (
          <motion.div key="grand-finale" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="contents">
            <GrandFinale phase={grandFinalePhase} />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {grandFinalePhase === 'carousel' && (
          <WinnerCarousel
            winnersHistory={winnersHistory}
            title={title}
            titleFont={titleFont}
            displayFont={displayFont}
            logo={logo}
            backgroundImage={backgroundImage}
            onClose={() => setGrandFinalePhase('idle')}
          />
        )}
      </AnimatePresence>
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
      {showConfetti && Array.from({ length: isGrandFinaleReveal ? 180 : 70 }).map((_, i) => <ConfettiParticle key={i} colors={currentTheme['--confetti-colors']} grand={isGrandFinaleReveal} />)}
      
       {logo && <img src={logo} alt="Event Logo" className="absolute top-4 left-4 h-16 w-auto z-30" />}
       
       {successMessage && (
        <div role="status" aria-live="polite" className="absolute top-0 left-0 right-0 bg-green-600 text-white p-2 flex justify-center items-center gap-4 z-50">
            <span>{successMessage}</span>
            <Button aria-label="Dismiss success message" onClick={() => setSuccessMessage('')} className="!bg-transparent !text-white text-lg !py-0 !px-2">&times;</Button>
        </div>
       )}
       {error && (
        <div role="alert" className="absolute top-0 left-0 right-0 bg-red-600 text-white p-2 flex justify-center items-center gap-4 z-50">
            <span>Error: {error}</span>
            <Button aria-label="Dismiss error message" onClick={() => setError('')} className="!bg-transparent !text-white text-lg !py-0 !px-2">&times;</Button>
        </div>
       )}

      <Button ref={settingsButtonRef} aria-label="Open settings" onClick={() => { setHistoryPanelOpen(false); setShowSettings(true); }} className="absolute top-3 right-3 sm:top-4 sm:right-4 z-30 !bg-gray-700 hover:!bg-gray-600 !p-2 sm:!p-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2.73l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2.73l.15-.08a2 2 0 0 0-.73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
      </Button>

      <div className="fixed bottom-2 right-2 sm:absolute sm:top-4 sm:left-1/2 sm:bottom-auto sm:right-auto sm:-translate-x-1/2 z-30 w-[min(78vw,320px)] sm:w-[min(900px,95vw)] rounded-xl sm:rounded-2xl border border-[var(--panel-border)] backdrop-blur-md px-3 sm:px-4 py-1 sm:py-3 shadow-xl" style={{ backgroundColor: 'var(--panel-bg)' }}>
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs sm:text-sm">
          <div>
            <p className="font-semibold">{quickStatus}</p>
            <p style={{ color: 'var(--text-muted)' }} className="text-[10px] sm:text-sm">
              {operationMode === 'standard' ? 'Current prize' : 'Mode'}:{' '}
              <span className="font-semibold" style={{ color: 'var(--title-color)' }}>
                {operationMode === 'team-divider' ? 'Team Divider' : operationMode === 'role-selector' ? 'Role Selector' : getPrizeName()}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm sm:text-lg font-semibold tabular-nums">{currentTime.toLocaleTimeString()}</p>
            <p style={{ color: 'var(--text-muted)' }} className="hidden sm:block">Shortcut: Space draw · S settings · F fullscreen</p>
          </div>
        </div>
        {operationMode === 'standard' && (
          <div className="mt-1 sm:mt-3 h-1.5 sm:h-2 rounded-full" style={{ backgroundColor: 'var(--panel-border)' }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${drawProgress}%`, backgroundColor: 'var(--button-action-bg)' }} />
          </div>
        )}
      </div>

      <AnimatePresence>
                {showSettings && (
            <>
            <motion.button
                type="button"
                aria-label="Close settings overlay"
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                exit={{opacity: 0}}
                onClick={() => setShowSettings(false)}
                className="fixed inset-0 z-40 bg-black/40 cursor-default"
            />
            <motion.div 
                ref={settingsDialogRef}
                initial={{x: '100%'}}
                animate={{x: 0}}
                exit={{x: '100%'}}
                transition={{type: 'spring', stiffness: 300, damping: 30}}
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-title"
                className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[var(--panel-border)] shadow-2xl sm:w-[min(920px,calc(100vw-2rem))]"
                style={{ backgroundColor: 'var(--bg-color)' }}
            >
                <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--panel-border)] px-4 py-4 sm:px-6">
                    <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[var(--text-muted)]">Control center</p>
                        <div className="mt-1 flex items-center gap-3">
                            <h2 id="settings-title" className="text-2xl font-black text-[var(--title-color)]">Settings</h2>
                            <span className={`hidden rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider sm:inline-flex ${drawing ? 'border-amber-400/40 bg-amber-400/10 text-amber-300' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'}`}>{drawing ? 'Draw in progress' : 'Changes save automatically'}</span>
                        </div>
                    </div>
                    <Button aria-label="Close settings" onClick={() => setShowSettings(false)} className="!rounded-full !bg-[var(--input-bg)] !p-2.5 !text-[var(--title-color)] ring-1 ring-[var(--panel-border)] hover:!opacity-80">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </Button>
                </header>

                <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
                    <nav aria-label="Settings sections" className="flex shrink-0 gap-2 overflow-x-auto border-b border-[var(--panel-border)] p-3 sm:w-52 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:p-4">
                        {SETTINGS_SECTIONS.map((section) => (
                            <button
                              key={section.id}
                              type="button"
                              aria-current={settingsTab === section.id ? 'page' : undefined}
                              className={`group flex min-w-[140px] items-center gap-3 rounded-xl border px-3 py-3 text-left transition-all sm:min-w-0 ${settingsTab === section.id ? 'border-[var(--button-action-bg)] bg-[var(--button-action-bg)]/15 text-[var(--title-color)] shadow-lg' : 'border-transparent text-[var(--text-muted)] hover:border-[var(--panel-border)] hover:bg-[var(--input-bg)]/40 hover:text-[var(--text-color)]'}`}
                              onClick={() => setSettingsTab(section.id)}
                            >
                                <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg font-black ${settingsTab === section.id ? 'bg-[var(--button-action-bg)] text-slate-950' : 'bg-[var(--input-bg)]'}`}>{section.icon}</span>
                                <span className="min-w-0"><span className="block text-sm font-bold">{section.label}</span><span className="hidden truncate text-[10px] opacity-70 sm:block">{section.description}</span></span>
                            </button>
                        ))}
                    </nav>

                    <div className="flex-grow overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
                        <div className="mb-6 rounded-2xl border border-[var(--panel-border)] bg-[var(--input-bg)]/30 p-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">{activeSettingsSection.label}</p>
                            <h3 className="mt-1 text-xl font-black text-[var(--text-color)]">{activeSettingsSection.description}</h3>
                        </div>
                    {settingsTab === 'event' && (
                        <div className="space-y-6">
                            <div>
                                <label className="font-semibold text-sm mb-1 block">Theme</label>
                                <select value={theme} onChange={(e) => setTheme(e.target.value)} className="w-full p-2 rounded-lg bg-[var(--input-bg)] border border-[var(--panel-border)]">
                                    {Object.keys(themes).map(themeName => (<option key={themeName} value={themeName}>{themeName}</option>))}
                                </select>
                            </div>
                            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)]/40 p-3 text-xs text-[var(--text-muted)]">
                                Burmese text uses native OpenType shaping with kerning and ligatures. Tracking is automatically disabled for Myanmar text, and Mon-specific characters use the complete Unicode-safe Noto Sans Myanmar face to prevent broken clusters.
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
                                        <label className="text-xs mt-1 block">Letter Spacing (Latin only)</label>
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
                                        <label className="text-xs mt-1 block">Letter Spacing (Latin only)</label>
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
                                        <label className="text-xs mt-1 block">Display Letter Spacing (Latin only)</label>
                                        <Input type="range" min="-2" max="16" step="0.1" value={displayLetterSpacing} onChange={e => setDisplayLetterSpacing(parseFloat(e.target.value))} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {settingsTab === 'draw' && (
                        <div className="space-y-6">
                            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--input-bg)]/25 p-4">
                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Participants & Draw Mode</p>
                                <p className="mt-1 text-xs text-[var(--text-muted)]">Build the eligible pool, choose how winners are selected, and configure fairness before going live.</p>
                            </div>
                            <div>
                                <label className="font-semibold text-sm mb-1 block">Participant Type</label>
                                <select value={drawMode} onChange={(e) => setDrawMode(e.target.value)} disabled={drawing} className="w-full p-2 rounded-lg bg-[var(--input-bg)] border border-[var(--panel-border)] text-sm mb-2 disabled:opacity-50">
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
                                <select value={operationMode} onChange={(e) => setOperationMode(e.target.value)} disabled={drawing} className="w-full p-2 rounded-lg bg-[var(--input-bg)] border border-[var(--panel-border)] text-sm disabled:opacity-50">
                                    <option value="standard">Standard Draw</option>
                                    <option value="team-divider">Team Divider</option>
                                    <option value="role-selector">Role Selector</option>
                                </select>
                                {operationMode === 'team-divider' && (
                                  <div>
                                    <label className="text-xs mt-1 block">Number of Teams</label>
                                    <Input type="number" min="2" max="100" value={teamCount} onChange={(e) => setTeamCount(Math.min(100, Math.max(2, parseInt(e.target.value, 10) || 2)))} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" disabled={drawing} />
                                  </div>
                                )}
                                {operationMode === 'role-selector' && (
                                  <div className="space-y-2">
                                    <label className="text-xs mt-1 block">Roles (one per line: Role:Count)</label>
                                    <textarea value={roleConfigText} onChange={(e) => setRoleConfigText(e.target.value)} rows={4} className="w-full p-2 rounded-lg bg-[var(--input-bg)] border border-[var(--panel-border)] text-sm disabled:opacity-50" disabled={drawing} />
                                    <label className="flex items-center gap-2 text-xs">
                                      <input type="checkbox" checked={allowMultipleRoles} onChange={(e) => setAllowMultipleRoles(e.target.checked)} disabled={drawing} />
                                      Allow same participant to receive multiple roles
                                    </label>
                                  </div>
                                )}
                                <div className="pt-2 border-t border-[var(--panel-border)] space-y-2">
                                  <p className="text-xs font-semibold">Fairness Controls</p>
                                  <label className="flex items-center gap-2 text-xs">
                                    <input type="radio" name="eligibility" checked={winnerEligibilityMode === 'remove'} onChange={() => setWinnerEligibilityMode('remove')} disabled={drawing} />
                                    Remove winner from future rounds
                                  </label>
                                  <label className="flex items-center gap-2 text-xs">
                                    <input type="radio" name="eligibility" checked={winnerEligibilityMode === 'keep'} onChange={() => setWinnerEligibilityMode('keep')} disabled={drawing} />
                                    Keep winner eligible
                                  </label>
                                  <label className="flex items-center gap-2 text-xs">
                                    <input type="checkbox" checked={noRepeatAcrossPrizes} onChange={(e) => setNoRepeatAcrossPrizes(e.target.checked)} disabled={drawing} />
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
                                        <Input type="text" value={prize.name} disabled={drawing} onChange={e => {
                                            const nextName = e.target.value;
                                            setPrizes((currentPrizes) => updatePrizeName(currentPrizes, index, nextName));
                                        }} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" />
                                        <Button aria-label={`Remove ${prize.name || 'prize'}`} disabled={drawing} onClick={() => setPrizes(prizes.filter(p => p.id !== prize.id))} className="!bg-red-600 text-xs !p-2">X</Button>
                                    </div>
                                ))}
                                <Button onClick={() => setPrizes([...prizes, {id: Date.now(), name: `New Prize`}])} disabled={drawing} className="w-full text-sm !bg-gray-600 hover:!bg-gray-700">Add Prize</Button>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="winners-per-prize" className="font-semibold text-sm mb-1 block">Winners per Prize</label>
                                    <Input id="winners-per-prize" type="number" value={winnersPerPrize} onChange={(e) => setWinnersPerPrize(Math.max(1, parseInt(e.target.value, 10) || 1))} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" disabled={drawing} min="1" />
                                </div>
                            </div>
                        </div>
                    )}
                    {settingsTab === 'event' && (
                        <div className="mt-6 space-y-6">
                            <div className="pt-2 border-t border-[var(--panel-border)]">
                                <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">Branding, Media & Session</p>
                            </div>
                            <div>
                                <label className="font-semibold text-sm mb-1 block">Custom Background</label>
                                <p className="text-xs text-[var(--text-muted)]">Overrides the animated default background for Event Night.</p>
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
                            <div className="flex items-center justify-between rounded-2xl border border-[var(--panel-border)] bg-[var(--input-bg)]/25 p-4">
                                <div><p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Volume Controls</p><p className="mt-1 text-xs text-[var(--text-muted)]">Balance the draw cues and celebration layers independently.</p></div>
                                <button onClick={resetAudioSettings} className="text-xs px-2 py-1 rounded bg-[var(--input-bg)] border border-[var(--panel-border)] hover:opacity-80">Reset defaults</button>
                            </div>
                            <div className="rounded-xl border border-[var(--panel-border)] bg-black/5 p-4">
                                <label className="font-semibold text-sm mb-1 block">Master Volume ({masterVolume} dB)</label>
                                <input type="range" min="-40" max="6" step="1" value={masterVolume} onChange={e => setMasterVolume(Number(e.target.value))} className="w-full" />
                            </div>
                            <div className="rounded-xl border border-[var(--panel-border)] bg-black/5 p-4">
                                <label className="font-semibold text-sm mb-1 block">Sound Effects Volume ({sfxVolume} dB)</label>
                                <input type="range" min="-40" max="6" step="1" value={sfxVolume} onChange={e => setSfxVolume(Number(e.target.value))} className="w-full" />
                            </div>
                            <div className="rounded-xl border border-[var(--panel-border)] bg-black/5 p-4">
                                <label className="font-semibold text-sm mb-1 block">Celebration Volume ({musicVolume} dB)</label>
                                <input type="range" min="-40" max="6" step="1" value={musicVolume} onChange={e => setMusicVolume(Number(e.target.value))} className="w-full" />
                            </div>
                            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--input-bg)]/25 p-4">
                                <h3 className="text-lg font-bold text-[var(--text-color)] mb-1">Cue Preview</h3>
                                <p className="mb-3 text-xs text-[var(--text-muted)]">Preview the regular-prize build and layered Magnific celebration.</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <Button onClick={playDrumroll} disabled={drawing} style={{backgroundColor: 'var(--button-primary-bg)'}}>Drumroll</Button>
                                    <Button onClick={playCelebration} disabled={drawing} style={{backgroundColor: 'var(--button-primary-bg)'}}>Prize Reveal</Button>
                                </div>
                            </div>
                        </div>
                    )}
                    {settingsTab === 'public' && (
                        <div className="space-y-5">
                            <div>
                                <h3 className="text-lg font-bold text-[var(--text-color)]">Audience Public View</h3>
                                <p className="text-sm text-[var(--text-muted)] mt-1">Start a secure live room, then open its public link on phones, tablets, projectors, or another computer. Only public draw results and display details are synchronized.</p>
                            </div>
                            {!isSupabaseConfigured ? (
                                <div role="alert" className="rounded-lg border border-amber-500/60 bg-amber-500/10 p-3 text-sm">
                                    <p className="font-semibold text-amber-300">Supabase setup required</p>
                                    <p className="mt-1 text-[var(--text-muted)]">Run <code>supabase/schema.sql</code>, add <code>REACT_APP_SUPABASE_URL</code> and <code>REACT_APP_SUPABASE_PUBLISHABLE_KEY</code> to Vercel, then redeploy.</p>
                                </div>
                            ) : liveRoom ? (
                                <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)]/40 p-3 space-y-2">
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="font-semibold text-sm">Cross-device room</span>
                                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${liveSync.status === 'live' ? 'bg-green-600 text-white' : liveSync.status === 'error' ? 'bg-red-600 text-white' : 'bg-amber-400 text-gray-900'}`}>{LIVE_SYNC_LABELS[liveSync.status] || liveSync.status}</span>
                                    </div>
                                    <p className="font-mono text-xs text-[var(--text-muted)] break-all">Room {liveRoom.roomId}</p>
                                    {liveSync.errorMessage && <p role="alert" className="text-xs text-red-400">{liveSync.errorMessage}</p>}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--input-bg)]/40 p-3">
                                    <p className="text-sm text-[var(--text-muted)] mb-3">Cross-device sharing is currently off. A room automatically expires after seven days.</p>
                                    <Button onClick={startLiveRoom} disabled={drawing || roomActionPending} className="w-full !bg-green-600 hover:!bg-green-700">Start Cross-Device Room</Button>
                                </div>
                            )}
                            <div>
                                <label htmlFor="public-view-url" className="font-semibold text-sm mb-1 block">Public view URL</label>
                                <Input id="public-view-url" type="text" readOnly value={publicViewUrl} onFocus={(event) => event.target.select()} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)] text-xs" />
                                {!liveRoom && <p className="mt-1.5 text-xs text-amber-400">Without a room, this fallback link only updates inside the same browser profile.</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Button onClick={handleCopyPublicViewUrl} className="w-full !bg-blue-600 hover:!bg-blue-700">Copy Link</Button>
                                <a href={publicViewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-lg px-4 py-2 font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors">Open View</a>
                            </div>
                            <section className="space-y-4 rounded-2xl border border-yellow-400/25 bg-yellow-400/[.06] p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div><p className="text-xs font-black uppercase tracking-[.18em] text-yellow-300">MC remote control</p><h4 className="mt-1 font-bold text-[var(--text-color)]">Start draws from a phone or tablet</h4></div>
                                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${remoteListener.status === 'listening' ? 'bg-emerald-500/20 text-emerald-300' : remoteListener.status === 'error' ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-[var(--text-muted)]'}`}>{REMOTE_LISTENER_LABELS[remoteListener.status] || remoteListener.status}</span>
                                </div>
                                <p className="text-xs leading-relaxed text-[var(--text-muted)]">This is a private bearer link for the MC. It can request the next draw but cannot see participant lists or choose a winner.</p>
                                {!liveRoom ? (
                                    <p className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-xs text-amber-200">Start a cross-device room before enabling remote control.</p>
                                ) : remoteControlUrl ? (
                                    <>
                                        <div>
                                            <label htmlFor="remote-control-url" className="mb-1 block text-xs font-semibold">Private remote link</label>
                                            <Input id="remote-control-url" type="password" readOnly autoComplete="off" value={remoteControlUrl} onFocus={(event) => event.target.select()} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)] text-xs" />
                                        </div>
                                        {remoteListener.errorMessage && <p role="alert" className="rounded-lg bg-red-500/10 p-2 text-xs text-red-300">{remoteListener.errorMessage}. Run the latest <code>supabase/schema.sql</code> if the remote functions are missing.</p>}
                                        <div className="grid grid-cols-2 gap-2">
                                            <Button onClick={handleCopyRemoteControlUrl} disabled={roomActionPending} className="!bg-yellow-500 !text-slate-950 hover:!bg-yellow-400">Copy Remote</Button>
                                            <a href={remoteControlUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-cyan-600">Open Remote</a>
                                            <Button onClick={() => enableRemoteControl({ rotated: true })} disabled={drawing || roomActionPending} className="!bg-indigo-600 hover:!bg-indigo-500">Rotate Link</Button>
                                            <Button onClick={disableRemoteControl} disabled={drawing || roomActionPending} className="!bg-red-700 hover:!bg-red-600">Disable</Button>
                                        </div>
                                        <p className="text-[11px] text-amber-200/80">If this link is exposed, rotate it immediately. The previous link will stop working.</p>
                                    </>
                                ) : (
                                    <Button onClick={() => enableRemoteControl()} disabled={drawing || roomActionPending} className="w-full !bg-yellow-500 !text-slate-950 hover:!bg-yellow-400">Enable Secure MC Remote</Button>
                                )}
                            </section>
                            {liveRoom && (
                                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[var(--panel-border)]">
                                    <Button onClick={() => stopLiveRoom({ startAnother: true })} disabled={drawing || roomActionPending} className="w-full !bg-amber-600 hover:!bg-amber-700">New Room</Button>
                                    <Button onClick={() => stopLiveRoom()} disabled={drawing || roomActionPending} className="w-full !bg-red-600 hover:!bg-red-700">Stop Sharing</Button>
                                </div>
                            )}
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
                        <AboutPanel />
                    )}
                </div>
                </div>
            </motion.div>
            </>
        )}
              </AnimatePresence>
      
      <div
        className="text-center z-10 w-full max-w-[min(1100px,calc(100vw-3rem))] pl-8 sm:pl-0"
        style={{ textShadow: theme === 'Corporate Blue' ? '0 2px 10px rgba(15,23,42,0.16)' : '0 2px 8px rgba(0,0,0,0.42)' }}
      >
        <h1 lang={titleTypography.lang} className="font-bold break-words" style={{...titleTypography.style, color: titleColor || 'var(--title-color)', lineHeight: titleLineSpacing, fontSize: `clamp(2rem, ${titleFontSize}px, min(10vw, 12vh))`}}>{title}</h1>
        <p lang={subtitleTypography.lang} className="mt-2 break-words" style={{...subtitleTypography.style, color: subtitleColor || 'var(--text-muted)', lineHeight: subtitleLineSpacing, fontSize: `clamp(0.875rem, ${subtitleFontSize}px, 6vw)`}}>{subtitle}</p>
      </div>

      <div className="flex flex-col items-center z-20">
        <AnimatePresence>
            {isGrandFinaleActive ? (
                <motion.div
                  key="grand-prize-heading"
                  initial={{ opacity: 0, scale: 0.7, y: -20 }}
                  animate={{ opacity: 1, scale: isGrandFinaleReveal ? [1, 1.08, 1] : 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ scale: { duration: 0.85, repeat: isGrandFinaleReveal ? Infinity : 0 } }}
                  className="mb-3 rounded-full border border-yellow-300/70 bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 px-5 py-2 text-sm sm:text-lg font-black uppercase tracking-[0.2em] text-slate-950 shadow-[0_0_30px_rgba(250,204,21,0.65)]"
                >
                  {isGrandFinaleReveal ? 'Grand Prize Winner' : `Grand Prize Finale · ${currentPrize}`}
                </motion.div>
            ) : drawing && (
                <motion.div key="standard-draw-heading" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="text-2xl font-bold mb-2" style={{color: 'var(--title-color)'}}>
                    Now Drawing: {currentPrize}
                </motion.div>
            )}
        </AnimatePresence>
        <motion.div
            ref={displayRef}
            className={`relative rounded-2xl shadow-inner flex items-center justify-center p-4 border-4 ${isGrandFinaleActive ? 'overflow-visible' : ''}`}
            style={{
                backgroundColor: 'var(--display-bg)',
                borderColor: isGrandFinaleActive ? '#fde047' : 'var(--display-border)',
                width: displayBoxComputedWidth,
                minHeight: `${displayBoxHeight}px`,
                height: 'auto',
                maxHeight: 'min(45vh, 360px)',
                overflowY: isGrandFinaleActive ? 'visible' : 'hidden',
            }}
            animate={isGrandFinaleReveal
              ? { scale: [1, 1.06, 1.02], boxShadow: ['0 0 25px rgba(250,204,21,0.4)', '0 0 100px rgba(250,204,21,0.95)', '0 0 55px rgba(250,204,21,0.72)'] }
              : isGrandFinaleActive
                ? { scale: [1, 1.015, 1], boxShadow: ['0 0 18px rgba(250,204,21,0.3)', '0 0 55px rgba(250,204,21,0.68)', '0 0 18px rgba(250,204,21,0.3)'] }
                : pulse ? {boxShadow: ['0 0 0px #fff', '0 0 40px #fff', '0 0 0px #fff']} : {}}
            transition={isGrandFinaleReveal
              ? { duration: 1.25, ease: 'easeOut' }
              : isGrandFinaleActive
                ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
                : pulse ? {duration: 0.8, ease: 'easeInOut'} : {}}
            onAnimationComplete={() => setPulse(false)}
        >
            {isGrandFinaleActive && (
              <motion.div
                className="pointer-events-none absolute -inset-3 rounded-[1.5rem] border border-yellow-200/60"
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.98, 1.03, 0.98] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            {assignmentResultMatchesMode && !drawing ? (
                <div className="grid max-h-[min(42vh,320px)] w-full grid-cols-1 gap-3 overflow-y-auto p-1 sm:grid-cols-2">
                  {assignmentGroups.map((group, groupIndex) => (
                    <section key={`${group.label}-${groupIndex}`} className="rounded-xl border border-[var(--display-border)] bg-white/5 p-3 text-left">
                      <h3 className="border-b border-[var(--display-border)] pb-2 text-base font-black" style={{ color: 'var(--display-text)' }}>{group.label}</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {group.members.map((member, memberIndex) => (
                          <span key={`${member}-${memberIndex}`} className="rounded-lg bg-black/15 px-2.5 py-1 text-sm font-semibold break-all" style={{ color: 'var(--display-text)' }}>{member}</span>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
            ) : operationMode === 'standard' && drawMode === 'numbers' ? (
                <div lang={displayTypography.lang} className="flex items-center font-bold max-w-full" style={{...displayTypography.style, color: 'var(--display-text)', textShadow: `0 0 20px ${currentTheme['--display-shadow']}`, fontSize: displayNumberFontSize, lineHeight: displayLineHeight, fontVariantNumeric: 'tabular-nums lining-nums'}}>
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
                 <div lang={displayTypography.lang} className="font-bold px-4 text-center w-full" style={{...displayTypography.style, color: 'var(--display-text)', textShadow: `0 0 20px ${currentTheme['--display-shadow']}`, fontSize: displayNameFontSize, lineHeight: displayLineHeight, wordBreak: 'break-word', overflowWrap: 'break-word'}}>
                    <AnimatePresence mode="popLayout">
                        <motion.span key={displayValue} initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} transition={{ duration: 0.2 }}>
                            {mainDisplayValue}
                        </motion.span>
                    </AnimatePresence>
                </div>
            )}
        </motion.div>
      </div>

      <div className="flex flex-col items-center gap-2 z-20">
        <div className="font-semibold">
          {operationMode === 'standard'
            ? `Prizes Drawn: ${winnersHistory.length} / ${prizes.length}`
            : assignmentResultMatchesMode ? 'Assignment complete' : 'Ready to assign'}
        </div>
        <div className="text-sm" style={{color: 'var(--text-muted)'}}>{eligibleEntryCount} / {initialEntries.length} Entries Eligible</div>
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
                disabled={!canDraw}
                className="w-full px-6 py-3 sm:px-10 sm:py-4 text-base sm:text-xl text-black" 
                style={{backgroundColor: 'var(--button-action-bg)', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none'}}
            >
              {operationMode === 'standard' ? (isCharging ? "Charging..." : "Hold to Draw") : 'Run Assignment'}
            </Button>
        </div>
      </div>
      
      {!historyPanelOpen && (
        <button
          onClick={() => { setShowSettings(false); setHistoryPanelOpen(true); }}
          className="fixed left-0 sm:left-3 top-28 z-20 flex flex-col items-center justify-center gap-1 w-8 sm:w-auto px-1 sm:px-2 py-3 rounded-r-lg sm:rounded-lg shadow-lg text-xs font-bold"
          style={{ backgroundColor: 'var(--panel-bg)', color: 'var(--title-color)', border: '1px solid var(--panel-border)' }}
          title="Show History & Audit"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', fontSize: '10px' }}>History</span>
        </button>
      )}

      <aside
        ref={historyPanelRef}
        aria-hidden={!historyPanelOpen}
        inert={!historyPanelOpen}
        className={`fixed left-2 sm:left-4 top-24 bottom-4 w-[min(360px,92vw)] backdrop-blur-md p-3 sm:p-4 rounded-xl shadow-2xl z-20 border border-[var(--panel-border)] flex flex-col transition-transform duration-300 ${historyPanelOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        style={{ backgroundColor: 'var(--panel-bg)', transform: historyPanelOpen ? 'translateX(0)' : 'translateX(calc(-100% - 1rem))' }}
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-lg sm:text-2xl font-bold" style={{color: 'var(--title-color)'}}>History & Audit</h2>
          <button
            onClick={() => setHistoryPanelOpen(false)}
            aria-label="Minimize history and audit panel"
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
          {assignmentResultMatchesMode && (
            <>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mt-1">
                Export {lastAssignmentResult.mode === 'team-divider' ? 'Teams' : 'Roles'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => setExportAssignmentTrigger(true)} disabled={drawing} className="!bg-green-600 hover:!bg-green-700 text-sm">Image (PNG)</Button>
                <Button onClick={handleExportAssignmentCsv} disabled={drawing} className="!bg-teal-600 hover:!bg-teal-700 text-sm">
                  {lastAssignmentResult.mode === 'team-divider' ? 'Teams CSV' : 'Roles CSV'}
                </Button>
              </div>
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

      <div style={{ position: 'fixed', top: '-9999px', left: '-9999px', pointerEvents: 'none' }}>
         <div ref={exportRef}>
            {winnerToExport && (
                 <div style={{width: 500, height: 300, ...themes[theme]}} className="flex flex-col items-center justify-center p-8 relative bg-[var(--display-bg)] text-[var(--text-color)]">
                     {logo && <img src={logo} alt="Logo" className="absolute top-4 left-4 h-12 w-auto" />}
                     <h3 lang={shapedTitle(winnerToExport.prize).lang} className="text-4xl font-bold" style={{...shapedTitle(winnerToExport.prize).style, color: 'var(--title-color)'}}>{winnerToExport.prize}</h3>
                     <div lang={shapedDisplay(winnerToExport.ticket).lang} className="text-8xl font-bold my-4" style={{...shapedDisplay(winnerToExport.ticket).style, color: 'var(--display-text)'}}>{winnerToExport.ticket}</div>
                     <p className="text-xl" style={{color: 'var(--text-muted)'}}>Congratulations!</p>
                 </div>
            )}
         </div>
         <div ref={exportAllRef}>
            {exportAllTrigger && (
                 <div style={{ width: 900, padding: 40, boxSizing: 'border-box', ...themes[theme] }}>
                     {logo && <img src={logo} alt="Logo" style={{ height: 80, width: 'auto', marginBottom: 24 }} />}
                     <h2 lang={shapedTitle(title).lang} style={{ ...shapedTitle(title).style, fontSize: 32, fontWeight: 'bold', marginBottom: 24, color: themes[theme]['--title-color'] }}>{title} - Winners</h2>
                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px 32px' }}>
                        {winnersHistory.map(group => (
                            <div key={group.prize}>
                                <h3 lang={shapedTitle(group.prize).lang} style={{ ...shapedTitle(group.prize).style, fontSize: 22, fontWeight: 'bold', borderBottom: `2px solid ${themes[theme]['--panel-border']}`, paddingBottom: 4, marginBottom: 8, color: themes[theme]['--title-color'] }}>{group.prize}</h3>
                                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                                    {group.tickets.map(ticket => (
                                      <li lang={shapedDisplay(ticket).lang} key={ticket} style={{ ...shapedDisplay(ticket).style, fontSize: 18, marginBottom: 4, color: themes[theme]['--display-text'] }}>{ticket}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                     </div>
                 </div>
            )}
         </div>
         <div ref={exportAssignmentRef}>
            {exportAssignmentTrigger && lastAssignmentResult && (
                <div style={{ width: 900, padding: 40, boxSizing: 'border-box', ...themes[theme] }}>
                    {logo && <img src={logo} alt="Logo" style={{ height: 80, width: 'auto', marginBottom: 24 }} />}
                    <h2 lang={shapedTitle(title).lang} style={{ ...shapedTitle(title).style, fontSize: 32, fontWeight: 'bold', marginBottom: 8, color: themes[theme]['--title-color'] }}>
                        {title} - {lastAssignmentResult.mode === 'team-divider' ? 'Team Assignment' : 'Role Assignment'}
                    </h2>
                    <p style={{ fontSize: 14, marginBottom: 24, color: themes[theme]['--text-muted'] }}>{new Date().toLocaleString()}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px 32px' }}>
                        {lastAssignmentResult.mode === 'team-divider'
                            ? lastAssignmentResult.teams.map(team => (
                                <div key={team.teamName}>
                                    <h3 lang={shapedTitle(team.teamName).lang} style={{ ...shapedTitle(team.teamName).style, fontSize: 22, fontWeight: 'bold', borderBottom: `2px solid ${themes[theme]['--panel-border']}`, paddingBottom: 4, marginBottom: 8, color: themes[theme]['--title-color'] }}>{team.teamName}</h3>
                                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                                        {team.members.map((member, i) => (
                                            <li lang={shapedDisplay(member).lang} key={i} style={{ ...shapedDisplay(member).style, fontSize: 16, marginBottom: 4, color: themes[theme]['--display-text'] }}>{member}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))
                            : lastAssignmentResult.assignments.map(assignment => (
                                <div key={assignment.role}>
                                    <h3 lang={shapedTitle(assignment.role).lang} style={{ ...shapedTitle(assignment.role).style, fontSize: 22, fontWeight: 'bold', borderBottom: `2px solid ${themes[theme]['--panel-border']}`, paddingBottom: 4, marginBottom: 8, color: themes[theme]['--title-color'] }}>{assignment.role}</h3>
                                    <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                                        {assignment.participants.map((p, i) => (
                                            <li lang={shapedDisplay(p).lang} key={i} style={{ ...shapedDisplay(p).style, fontSize: 16, marginBottom: 4, color: themes[theme]['--display-text'] }}>{p}</li>
                                        ))}
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

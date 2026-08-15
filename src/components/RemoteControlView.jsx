import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { usePublicSync } from '../hooks/usePublicSync';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { isValidRemoteControlCredentials } from '../utils/remoteControl';

function createCommandId() {
  if (typeof window.crypto?.randomUUID === 'function') return window.crypto.randomUUID();
  const bytes = window.crypto?.getRandomValues?.(new Uint8Array(16));
  if (!bytes) return '';
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export default function RemoteControlView({ credentials }) {
  const credentialsValid = isValidRemoteControlCredentials(credentials);
  const roomId = credentialsValid ? credentials.roomId : '00000000-0000-4000-8000-000000000000';
  const { drawState, syncStatus, errorMessage: syncError } = usePublicSync({ roomId });
  const [requestStatus, setRequestStatus] = useState('idle');
  const [requestMessage, setRequestMessage] = useState('');
  const responseTimeoutRef = useRef(null);
  const live = drawState?.live;
  const isStandardDraw = !drawState?.operationMode || drawState.operationMode === 'standard';
  const drawComplete = Boolean(
    isStandardDraw
    && live?.prizeCount > 0
    && live.completedPrizeCount >= live.prizeCount
  );
  const canDraw = Boolean(
    credentialsValid
    && isSupabaseConfigured
    && syncStatus === 'live'
    && live
    && live.remoteControlReady === true
    && !live.drawing
    && !drawComplete
    && live.remainingEntriesCount > 0
    && (requestStatus === 'idle' || requestStatus === 'error')
  );

  useEffect(() => {
    if (live?.drawing) {
      clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
      setRequestStatus('drawing');
      setRequestMessage('The host accepted the request. Drawing now…');
    } else if (requestStatus === 'drawing') {
      setRequestStatus('idle');
      setRequestMessage('Reveal complete. Ready for the next draw.');
    }
  }, [live?.drawing, requestStatus]);

  useEffect(() => () => {
    clearTimeout(responseTimeoutRef.current);
    responseTimeoutRef.current = null;
  }, []);

  const status = useMemo(() => {
    if (!credentialsValid) return { label: 'Invalid control link', color: 'bg-red-400' };
    if (!isSupabaseConfigured) return { label: 'Supabase not configured', color: 'bg-red-400' };
    if (syncStatus === 'connecting') return { label: 'Connecting to host', color: 'bg-amber-300' };
    if (syncStatus !== 'live') return { label: 'Host unavailable', color: 'bg-red-400' };
    if (live?.drawing) return { label: 'Draw in progress', color: 'bg-amber-300' };
    if (drawComplete) return { label: 'Event completed', color: 'bg-cyan-300' };
    if (live?.remainingEntriesCount <= 0) return { label: 'No eligible entries', color: 'bg-red-400' };
    if (live?.remoteControlReady !== true) return { label: 'Host not ready', color: 'bg-amber-300' };
    return { label: 'Secure control ready', color: 'bg-emerald-400' };
  }, [credentialsValid, drawComplete, live?.drawing, live?.remainingEntriesCount, live?.remoteControlReady, syncStatus]);

  const requestDraw = async () => {
    if (!canDraw) return;
    const commandId = createCommandId();
    if (!commandId) {
      setRequestStatus('error');
      setRequestMessage('This browser cannot create a secure draw request.');
      return;
    }

    setRequestStatus('sending');
    setRequestMessage('Sending secure draw request…');
    clearTimeout(responseTimeoutRef.current);
    responseTimeoutRef.current = null;
    const { data, error } = await supabase.rpc('request_remote_draw', {
      p_room_id: credentials.roomId,
      p_remote_key: credentials.remoteKey,
      p_command_id: commandId,
    });

    if (error) {
      setRequestStatus('error');
      setRequestMessage(error.message || 'The draw request was rejected.');
      return;
    }
    if (data && typeof data === 'object' && data.accepted === false) {
      setRequestStatus('error');
      setRequestMessage(data.message || 'The host is not ready for another draw.');
      return;
    }

    setRequestStatus('sent');
    setRequestMessage('Request sent. Waiting for the host computer…');
    responseTimeoutRef.current = setTimeout(() => {
      responseTimeoutRef.current = null;
      setRequestStatus((current) => {
        if (current !== 'sent') return current;
        setRequestMessage('The host did not respond. Check that its live tab is open, then try again.');
        return 'error';
      });
    }, 13000);
  };

  const currentPrize = drawState?.operationMode === 'team-divider'
    ? 'Team Divider'
    : drawState?.operationMode === 'role-selector'
      ? 'Role Selector'
      : live?.currentPrize || 'Waiting for host';
  const progressLabel = isStandardDraw && live?.prizeCount > 0
    ? `${live.completedPrizeCount} / ${live.prizeCount}`
    : isStandardDraw ? '—' : 'Assignment';

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-slate-950 p-4 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(250,204,21,.18),transparent_32%),radial-gradient(circle_at_50%_90%,rgba(6,182,212,.16),transparent_42%)]" />
      <div className="relative z-10 w-full max-w-md">
        <header className="mb-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-[10px] font-black uppercase tracking-[.28em] text-yellow-300">MC remote</p><h1 className="mt-1 text-2xl font-black">{drawState?.title || 'Lucky Draw Control'}</h1></div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-yellow-300/30 bg-yellow-300/10 text-2xl">⌁</span>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold uppercase tracking-wider"><span className={`h-2 w-2 rounded-full ${status.color}`} />{status.label}</div>
        </header>

        <section className="rounded-[2rem] border border-white/10 bg-white/[.07] p-5 shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Next prize</p><p className="mt-1 truncate text-lg font-black">{currentPrize}</p></div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Progress</p><p className="mt-1 text-lg font-black tabular-nums">{progressLabel}</p></div>
          </div>

          <motion.button
            type="button"
            whileTap={canDraw ? { scale: 0.96 } : undefined}
            onClick={requestDraw}
            disabled={!canDraw}
            className="relative mx-auto mt-5 flex h-[min(20rem,42vh)] w-[min(20rem,42vh)] items-center justify-center overflow-hidden rounded-full border-[10px] border-yellow-200/20 bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500 text-slate-950 shadow-[0_18px_70px_rgba(245,158,11,.38),inset_0_4px_12px_rgba(255,255,255,.6)] transition disabled:cursor-not-allowed disabled:grayscale disabled:opacity-45"
            aria-label="Request next draw"
          >
            {canDraw && <span className="absolute inset-5 animate-ping rounded-full border border-white/25" />}
            <span className="relative text-center"><span className="block text-xs font-black uppercase tracking-[.28em]">Secure remote</span><span className="mt-2 block text-5xl font-black">DRAW</span><span className="mt-2 block text-sm font-bold">Tap once</span></span>
          </motion.button>

          <div aria-live="polite" className={`mt-5 min-h-14 rounded-2xl border p-4 text-center text-sm font-semibold ${requestStatus === 'error' || syncError ? 'border-red-400/30 bg-red-500/10 text-red-200' : 'border-white/10 bg-black/20 text-slate-200'}`}>
            {requestMessage || syncError || (canDraw ? 'Ready. One tap starts the next draw on the host computer.' : status.label)}
          </div>
        </section>

        <p className="mt-4 px-4 text-center text-xs leading-relaxed text-slate-500">This private link can start draws. Do not share it with the audience. Winner selection remains on the host computer.</p>
      </div>
    </main>
  );
}

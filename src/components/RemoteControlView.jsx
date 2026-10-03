import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePublicSync } from '../hooks/usePublicSync';
import { isRoomServiceConfigured, roomRequest } from '../lib/roomApi';
import { isValidRemoteControlCredentials } from '../utils/remoteControl';
import './RemoteControlView.css';

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
  const { drawState, revision, syncStatus, errorMessage: syncError } = usePublicSync({ roomId });
  const [requestStatus, setRequestStatus] = useState('idle');
  const [requestMessage, setRequestMessage] = useState('');
  const [armed, setArmed] = useState(false);
  const responseTimeoutRef = useRef(null);
  const armTimeoutRef = useRef(null);
  const requestInFlightRef = useRef(false);
  const requestEpochRef = useRef(0);
  const requestBaselineRef = useRef(null);
  const requestObservedRef = useRef(false);
  const live = drawState?.live;
  const liveDrawingRef = useRef(false);
  liveDrawingRef.current = Boolean(live?.drawing);
  const isStandardDraw = !drawState?.operationMode || drawState.operationMode === 'standard';
  const drawComplete = Boolean(
    isStandardDraw
    && live?.prizeCount > 0
    && live.completedPrizeCount >= live.prizeCount
  );
  const canArm = Boolean(
    credentialsValid
    && isRoomServiceConfigured
    && syncStatus === 'live'
    && live
    && live.remoteControlReady === true
    && !live.drawing
    && !drawComplete
    && live.remainingEntriesCount > 0
    && (requestStatus === 'idle' || requestStatus === 'error')
  );

  useEffect(() => {
    const baseline = requestBaselineRef.current;
    const resultArrived = baseline && (
      live?.completedPrizeCount !== baseline.completedPrizeCount
      || JSON.stringify(drawState?.lastAssignmentResult) !== baseline.assignment
    );
    if (live?.drawing) {
      requestObservedRef.current = true;
      clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
      setArmed(false);
      setRequestStatus('drawing');
      setRequestMessage('The host accepted the request. Drawing now…');
    } else if (requestStatus === 'drawing' || resultArrived) {
      requestObservedRef.current = true;
      requestBaselineRef.current = null;
      clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
      setRequestStatus('idle');
      setRequestMessage('Reveal complete. Ready for the next draw.');
    }
  }, [live?.drawing, live?.completedPrizeCount, drawState?.lastAssignmentResult, requestStatus]);

  useEffect(() => {
    setArmed(false);
    setRequestStatus('idle');
    setRequestMessage('');
    requestInFlightRef.current = false;
    requestBaselineRef.current = null;
    return () => {
      requestEpochRef.current += 1;
      clearTimeout(responseTimeoutRef.current);
      clearTimeout(armTimeoutRef.current);
      responseTimeoutRef.current = null;
      armTimeoutRef.current = null;
    };
  }, [credentials?.roomId, credentials?.remoteKey]);

  useEffect(() => {
    if (!canArm) setArmed(false);
  }, [canArm]);

  useEffect(() => {
    if (!armed) {
      clearTimeout(armTimeoutRef.current);
      armTimeoutRef.current = null;
      return;
    }
    armTimeoutRef.current = setTimeout(() => setArmed(false), 10000);
    return () => {
      clearTimeout(armTimeoutRef.current);
      armTimeoutRef.current = null;
    };
  }, [armed]);

  const status = useMemo(() => {
    if (!credentialsValid) return { label: 'Invalid control link', color: 'bg-red-400' };
    if (!isRoomServiceConfigured) return { label: 'Room service unavailable', color: 'bg-red-400' };
    if (syncStatus === 'connecting') return { label: 'Connecting to host', color: 'bg-amber-300' };
    if (syncStatus === 'closed') return { label: 'Room closed', color: 'bg-red-400' };
    if (syncStatus === 'offline') return { label: 'Host offline', color: 'bg-red-400' };
    if (syncStatus === 'drawing') return { label: 'Draw in progress', color: 'bg-amber-300' };
    if (syncStatus !== 'live') return { label: 'Host unavailable', color: 'bg-red-400' };
    if (live?.drawing) return { label: 'Draw in progress', color: 'bg-amber-300' };
    if (drawComplete) return { label: 'Event completed', color: 'bg-cyan-300' };
    if (live?.remainingEntriesCount <= 0) return { label: 'No eligible entries', color: 'bg-red-400' };
    if (live?.remoteControlReady !== true) return { label: 'Host not ready', color: 'bg-amber-300' };
    return { label: 'Room connected', color: 'bg-emerald-400' };
  }, [credentialsValid, drawComplete, live?.drawing, live?.remainingEntriesCount, live?.remoteControlReady, syncStatus]);

  const requestDraw = async () => {
    if (!canArm || !armed || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    const requestEpoch = requestEpochRef.current;
    requestObservedRef.current = false;
    requestBaselineRef.current = {
      completedPrizeCount: live.completedPrizeCount,
      assignment: JSON.stringify(drawState?.lastAssignmentResult),
    };
    setArmed(false);
    const commandId = createCommandId();
    if (!commandId) {
      requestInFlightRef.current = false;
      setRequestStatus('error');
      setRequestMessage('This browser cannot create a secure draw request.');
      return;
    }

    setRequestStatus('sending');
    setRequestMessage('Sending secure draw request…');
    clearTimeout(responseTimeoutRef.current);
    responseTimeoutRef.current = null;
    let data;
    let error;
    try {
      data = await roomRequest(credentials.roomId, 'request', {
        method: 'POST', key: credentials.remoteKey, body: { commandId, revision },
      });
    } catch (requestError) {
      error = requestError;
    }
    if (requestEpoch !== requestEpochRef.current) return;
    requestInFlightRef.current = false;
    if (requestObservedRef.current) return;

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

    if (liveDrawingRef.current) {
      setRequestStatus('drawing');
      setRequestMessage('The host accepted the request. Drawing now…');
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
  useEffect(() => {
    setArmed(false);
  }, [currentPrize, live?.completedPrizeCount]);
  const progressLabel = isStandardDraw && live?.prizeCount > 0
    ? `${live.completedPrizeCount} / ${live.prizeCount}`
    : isStandardDraw ? '—' : 'Assignment';

  const actionLabel = armed ? 'Start draw' : 'Arm next draw';
  const actionHint = armed
    ? `Confirm to draw ${currentPrize}. This will start the host display.`
    : 'First tap arms the control. A second tap starts the draw.';
  const actionMessage = syncError || (armed
    ? `Armed for ${currentPrize}. Confirm within 10 seconds.`
    : !canArm && requestStatus === 'idle'
      ? status.label
      : requestMessage || (canArm ? 'Ready for the next draw.' : status.label));

  return (
    <main className="mc-remote">
      <div className="mc-remote__console">
        <header className="mc-remote__header">
          <div className="mc-remote__header-top"><span>MC control</span><span className="mc-remote__role">Private</span></div>
          <h1>{drawState?.title || 'Lucky Draw Control'}</h1>
          <p className="mc-remote__connection"><span className={`mc-remote__signal ${status.color}`} />{status.label}</p>
        </header>

        <section className="mc-remote__stage" aria-label="Next draw control">
          <div className="mc-remote__prize">
            <div><span className="mc-remote__label">Up next</span><h2>{currentPrize}</h2></div>
            <div className="mc-remote__progress"><span className="mc-remote__label">Draws</span><strong>{progressLabel}</strong></div>
          </div>

          <div className="mc-remote__action-area">
            <p className="mc-remote__instruction">{canArm ? actionHint : 'The draw control is unavailable. Check the room status below.'}</p>
            <button
              type="button"
              onClick={() => { if (armed) requestDraw(); else if (canArm) setArmed(true); }}
              disabled={!canArm}
              className={`mc-remote__action${armed ? ' mc-remote__action--armed' : ''}`}
              aria-label={actionLabel}
            >
              <span className="mc-remote__action-marker" aria-hidden="true" />
              <span>{actionLabel}</span>
              <span className="mc-remote__action-arrow" aria-hidden="true">→</span>
            </button>
            {armed && <button type="button" className="mc-remote__cancel" onClick={() => setArmed(false)}>Cancel</button>}
          </div>

          <p role={requestStatus === 'error' || syncError ? 'alert' : 'status'} aria-live="polite" className={`mc-remote__feedback${requestStatus === 'error' || syncError ? ' mc-remote__feedback--error' : ''}`}>
            {actionMessage}
          </p>
        </section>

        <p className="mc-remote__footer">Keep this control link with the MC. The host computer selects and displays the winner.</p>
      </div>
    </main>
  );
}

import { useEffect, useState } from 'react';
import { isRoomServiceConfigured, roomRequest, roomSocketUrl } from '../lib/roomApi';
import { isValidPublicDrawState } from '../utils/realtimeRoom';
import { isValidSessionData } from '../utils/validation';

export function usePublicSync({ roomId = '', storageKey = 'lucky-draw-autosave', intervalMs = 1000 } = {}) {
  const [drawState, setDrawState] = useState(null);
  const [revision, setRevision] = useState(0);
  const [syncStatus, setSyncStatus] = useState(roomId ? 'connecting' : 'local');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (roomId) return undefined;
    const updateState = () => {
      try {
        const savedState = localStorage.getItem(storageKey);
        if (!savedState) return;
        const parsedState = JSON.parse(savedState);
        if (isValidSessionData(parsedState)) {
          setDrawState((current) => isValidPublicDrawState(current) ? current : parsedState);
        }
      } catch { /* a damaged local save cannot update the public display */ }
    };
    updateState();
    window.addEventListener('storage', updateState);
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`${storageKey}-sync`) : null;
    const onMessage = (event) => {
      if (isValidPublicDrawState(event.data)) setDrawState(event.data);
      else if (isValidSessionData(event.data)) setDrawState((current) => isValidPublicDrawState(current) ? current : event.data);
    };
    channel?.addEventListener('message', onMessage);
    channel?.postMessage({ type: 'request-public-state' });
    const interval = setInterval(updateState, intervalMs);
    return () => { window.removeEventListener('storage', updateState); channel?.removeEventListener('message', onMessage); channel?.close(); clearInterval(interval); };
  }, [roomId, storageKey, intervalMs]);

  useEffect(() => {
    if (!roomId) { setSyncStatus('local'); setErrorMessage(''); return undefined; }
    if (!isRoomServiceConfigured) { setSyncStatus('unconfigured'); setErrorMessage('The room service is not configured.'); return undefined; }
    let stopped = false;
    let closed = false;
    let socket;
    let reconnectTimer;
    let presenceTimer;
    let attempt = 0;
    let lastRevision = -1;
    let hostSeen = 0;
    let hostOnline = false;
    let drawing = false;
    setDrawState(null); setRevision(0); setSyncStatus('connecting'); setErrorMessage('');
    const refreshPresence = () => {
      if (closed || stopped || socket?.readyState !== WebSocket.OPEN) return;
      const online = hostOnline && Date.now() - hostSeen < 15000;
      setSyncStatus(online ? (drawing ? 'drawing' : 'live') : 'offline');
      setErrorMessage(online ? '' : 'The host is offline. The latest result is still shown.');
    };
    const connect = () => {
      if (stopped || closed) return;
      setSyncStatus('connecting');
      socket = new WebSocket(roomSocketUrl(roomId));
      socket.onopen = () => { attempt = 0; clearInterval(presenceTimer); presenceTimer = setInterval(refreshPresence, 1000); };
      socket.onmessage = (event) => {
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'closed' || (message.type === 'state' && message.status === 'closed')) {
          closed = true; setDrawState(null); setSyncStatus('closed'); setErrorMessage('This room has closed. Ask for a new public link.');
          socket.close(); return;
        }
        if (message.type === 'state') {
          if (message.revision >= lastRevision && (!message.snapshot || isValidPublicDrawState(message.snapshot))) {
            lastRevision = message.revision;
            setRevision(message.revision);
            if (message.snapshot) { setDrawState(message.snapshot); drawing = Boolean(message.snapshot.live?.drawing); }
          }
          hostOnline = Boolean(message.hostOnline); hostSeen = message.hostSeen || 0;
          refreshPresence();
        } else if (message.type === 'presence') {
          hostOnline = Boolean(message.hostOnline); hostSeen = message.hostSeen || 0;
          refreshPresence();
        }
      };
      socket.onerror = () => { setSyncStatus('error'); setErrorMessage('The live room connection was interrupted.'); };
      socket.onclose = async () => {
        clearInterval(presenceTimer);
        if (stopped || closed) return;
        try { await roomRequest(roomId, 'snapshot'); }
        catch (error) {
          if (stopped || closed) return;
          if (/closed|expired/i.test(error.message)) {
            closed = true; setDrawState(null); setSyncStatus('closed'); setErrorMessage('This room has closed. Ask for a new public link.');
            return;
          }
          if (/not found/i.test(error.message)) {
            closed = true; setSyncStatus('error'); setErrorMessage('This room does not exist. Check the public link.');
            return;
          }
        }
        if (stopped || closed) return;
        setSyncStatus('connecting'); setErrorMessage('Reconnecting to the live room…');
        reconnectTimer = setTimeout(connect, Math.min(1000 * (2 ** attempt++), 10000));
      };
    };
    connect();
    return () => { stopped = true; clearTimeout(reconnectTimer); clearInterval(presenceTimer); socket?.close(); };
  }, [roomId]);

  return { drawState, revision, syncStatus, errorMessage };
}

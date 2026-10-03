import { useEffect, useRef, useState } from 'react';
import { isRoomServiceConfigured, roomRequest, roomSocketUrl } from '../lib/roomApi';
import { toPublicDrawState } from '../utils/realtimeRoom';

export function useRealtimePublisher({ roomId, writeKey, appState, enabled = true, onDraw, onUnavailable }) {
  const [status, setStatus] = useState(isRoomServiceConfigured ? 'idle' : 'unconfigured');
  const [errorMessage, setErrorMessage] = useState('');
  const [listenerStatus, setListenerStatus] = useState('idle');
  const socketRef = useRef(null);
  const onDrawRef = useRef(onDraw);
  const onUnavailableRef = useRef(onUnavailable);
  const stateRef = useRef(appState);
  const revisionRef = useRef(0);
  const sentRef = useRef('');
  const inFlightRef = useRef('');
  const queuedRef = useRef(false);
  const authorizedRef = useRef(false);
  const supportsWinnerIndexRef = useRef(false);
  const publishRef = useRef(() => {});
  onDrawRef.current = onDraw;
  onUnavailableRef.current = onUnavailable;
  stateRef.current = appState;

  publishRef.current = () => {
    const socket = socketRef.current;
    if (!enabled || !authorizedRef.current || socket?.readyState !== WebSocket.OPEN || queuedRef.current) return;
    let snapshot;
    try { snapshot = toPublicDrawState(stateRef.current); }
    catch (error) { setStatus('error'); setErrorMessage(error.message); return; }
    // Keep frontend deployments compatible until the Worker upgrade is live.
    if (!supportsWinnerIndexRef.current) delete snapshot.live.drawingWinnerIndex;
    const comparable = JSON.stringify({ ...snapshot, updatedAt: '' });
    if (comparable === sentRef.current) { setStatus('live'); return; }
    queuedRef.current = true;
    inFlightRef.current = comparable;
    setStatus('syncing');
    socket.send(JSON.stringify({ type: 'publish', baseRevision: revisionRef.current, snapshot }));
  };

  useEffect(() => { publishRef.current(); }, [appState]);

  useEffect(() => {
    if (!isRoomServiceConfigured) { setStatus('unconfigured'); return undefined; }
    if (!enabled || !roomId || !writeKey) {
      setStatus('idle'); setListenerStatus('idle'); setErrorMessage('');
      return undefined;
    }
    let stopped = false;
    let socket;
    let reconnectTimer;
    let heartbeatTimer;
    let attempt = 0;
    sentRef.current = '';
    const unavailable = () => {
      stopped = true;
      setStatus('idle'); setListenerStatus('idle'); setErrorMessage('');
      onUnavailableRef.current?.();
      socket?.close();
    };
    const retry = () => {
      if (stopped) return;
      setStatus('connecting'); setListenerStatus('connecting');
      reconnectTimer = setTimeout(connect, Math.min(1000 * (2 ** attempt++), 10000));
    };
    const connect = () => {
      if (stopped) return;
      setStatus('connecting'); setListenerStatus('connecting');
      roomRequest(roomId, 'snapshot').then(() => {
        if (stopped) return;
        socket = new WebSocket(roomSocketUrl(roomId));
        const connection = socket;
        const isCurrent = () => !stopped && socketRef.current === connection;
        socketRef.current = socket;
        authorizedRef.current = false;
        queuedRef.current = false;
      socket.onopen = () => { if (isCurrent()) connection.send(JSON.stringify({ type: 'auth', key: writeKey })); };
      socket.onmessage = (event) => {
        if (!isCurrent()) return;
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (!message || typeof message !== 'object') return;
        if (message.type === 'authorized') {
          supportsWinnerIndexRef.current = message.capabilities?.includes('winner-index') === true;
          let localSnapshot;
          try { localSnapshot = toPublicDrawState(stateRef.current); }
          catch (error) { stopped = true; setStatus('error'); setListenerStatus('error'); setErrorMessage(error.message); socket.close(); return; }
          const remoteWinners = message.snapshot?.winnersHistory || [];
          if (remoteWinners.some((winner, index) => JSON.stringify(winner) !== JSON.stringify(localSnapshot.winnersHistory[index]))) {
            stopped = true;
            setStatus('error'); setListenerStatus('error');
            setErrorMessage('This tab has an older draw history than the live room. Restore the current host session or start a new room.');
            socket.close();
            return;
          }
          revisionRef.current = message.revision;
          authorizedRef.current = true;
          attempt = 0;
          setListenerStatus('listening'); setErrorMessage('');
          publishRef.current();
          clearInterval(heartbeatTimer);
          heartbeatTimer = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'heartbeat' }));
          }, 5000);
        } else if (message.type === 'published') {
          revisionRef.current = message.revision;
          queuedRef.current = false;
          sentRef.current = inFlightRef.current;
          setStatus('live');
          publishRef.current();
        } else if (message.type === 'stale') {
          revisionRef.current = message.revision;
          queuedRef.current = false;
          sentRef.current = '';
          publishRef.current();
        } else if (message.type === 'draw-request') {
          Promise.resolve().then(() => { if (isCurrent()) return onDrawRef.current?.(); }).catch(() => {
            if (!isCurrent()) return;
            setListenerStatus('error'); setErrorMessage('The requested draw could not start.');
          });
        } else if (message.type === 'error') {
          queuedRef.current = false;
          setStatus('error'); setErrorMessage(message.message || 'The room rejected an update.');
          if (message.message === 'Unauthorized.') {
            unavailable();
          } else if (message.message === 'Another host tab is already connected.') {
            stopped = true;
            setStatus('elsewhere'); setListenerStatus('elsewhere');
            setErrorMessage('Another host tab is already connected to this room.');
            socket.close();
          }
        } else if (message.type === 'closed') {
          unavailable();
        }
      };
      socket.onerror = () => { if (!isCurrent()) return; setStatus('error'); setErrorMessage('Connection to the room service was interrupted.'); };
      socket.onclose = () => {
        if (!isCurrent()) return;
        clearInterval(heartbeatTimer);
        authorizedRef.current = false;
        queuedRef.current = false;
        retry();
      };
      }).catch((error) => {
        if (stopped) return;
        if (error.status === 404 || error.status === 410) { unavailable(); return; }
        setStatus('error'); setErrorMessage('Connection to the room service was interrupted.');
        retry();
      });
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(reconnectTimer); clearInterval(heartbeatTimer);
      socket?.close();
      if (socketRef.current === socket) {
        socketRef.current = null;
        authorizedRef.current = false;
        queuedRef.current = false;
      }
    };
  }, [enabled, roomId, writeKey]);

  return { status, errorMessage, listenerStatus };
}

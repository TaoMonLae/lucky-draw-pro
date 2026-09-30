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
  const publishRef = useRef(() => {});
  onDrawRef.current = onDraw;
  onUnavailableRef.current = onUnavailable;
  stateRef.current = appState;

  publishRef.current = () => {
    const socket = socketRef.current;
    if (!authorizedRef.current || socket?.readyState !== WebSocket.OPEN || queuedRef.current) return;
    let snapshot;
    try { snapshot = toPublicDrawState(stateRef.current); }
    catch (error) { setStatus('error'); setErrorMessage(error.message); return; }
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
        socketRef.current = socket;
        authorizedRef.current = false;
        queuedRef.current = false;
      socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', key: writeKey }));
      socket.onmessage = (event) => {
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'authorized') {
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
          Promise.resolve(onDrawRef.current?.()).catch(() => {
            setListenerStatus('error'); setErrorMessage('The requested draw could not start.');
          });
        } else if (message.type === 'error') {
          queuedRef.current = false;
          setStatus('error'); setErrorMessage(message.message || 'The room rejected an update.');
          if (message.message === 'Unauthorized.') {
            unavailable();
          }
        } else if (message.type === 'closed') {
          unavailable();
        }
      };
      socket.onerror = () => { setStatus('error'); setErrorMessage('Connection to the room service was interrupted.'); };
      socket.onclose = () => {
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
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [enabled, roomId, writeKey]);

  return { status, errorMessage, listenerStatus };
}

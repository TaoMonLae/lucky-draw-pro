import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { isValidPublicDrawState } from '../utils/realtimeRoom';
import { isValidSessionData } from '../utils/validation';

export function usePublicSync({ roomId = '', storageKey = 'lucky-draw-autosave', intervalMs = 1000 } = {}) {
  const [drawState, setDrawState] = useState(null);
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
          setDrawState((currentState) => isValidPublicDrawState(currentState) ? currentState : parsedState);
        }
      } catch (error) {
        console.error('Failed to parse public state', error);
      }
    };

    updateState();
    window.addEventListener('storage', updateState);
    const syncChannel = typeof BroadcastChannel !== 'undefined'
      ? new BroadcastChannel(`${storageKey}-sync`)
      : null;
    const handleChannelMessage = (event) => {
      if (isValidPublicDrawState(event.data)) {
        setDrawState(event.data);
      } else if (isValidSessionData(event.data)) {
        setDrawState((currentState) => isValidPublicDrawState(currentState) ? currentState : event.data);
      }
    };
    syncChannel?.addEventListener('message', handleChannelMessage);
    syncChannel?.postMessage({ type: 'request-public-state' });
    const refreshInterval = setInterval(updateState, intervalMs);
    return () => {
      window.removeEventListener('storage', updateState);
      syncChannel?.removeEventListener('message', handleChannelMessage);
      syncChannel?.close();
      clearInterval(refreshInterval);
    };
  }, [roomId, storageKey, intervalMs]);

  useEffect(() => {
    if (!roomId) {
      setSyncStatus('local');
      setErrorMessage('');
      return undefined;
    }
    if (!isSupabaseConfigured) {
      setSyncStatus('unconfigured');
      setErrorMessage('Supabase environment variables are missing from this deployment.');
      return undefined;
    }

    let cancelled = false;
    setDrawState(null);
    setSyncStatus('connecting');
    setErrorMessage('');

    const acceptRemoteState = (state) => {
      if (!cancelled && isValidPublicDrawState(state)) setDrawState(state);
    };

    const handleRoomClosed = (payload) => {
      if (!cancelled && payload.old?.room_id === roomId) {
        setDrawState(null);
        setSyncStatus('closed');
        setErrorMessage('The host stopped sharing this room. Ask for a new public link.');
      }
    };

    const fetchLatestState = async () => {
      const { data, error } = await supabase
        .from('draw_public_states')
        .select('state')
        .eq('room_id', roomId)
        .maybeSingle();
      if (error) throw error;
      if (data?.state) acceptRemoteState(data.state);
    };

    const channel = supabase
      .channel(`draw-room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'draw_public_states',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => acceptRemoteState(payload.new?.state)
      )
      // Supabase does not support filters on DELETE events, so match the old
      // primary key in the client to clear a display as soon as its host closes it.
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'draw_public_states',
        },
        handleRoomClosed
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          setSyncStatus('live');
          fetchLatestState().catch((error) => {
            console.error('Failed to load live draw state', error);
            setSyncStatus('error');
            setErrorMessage(error.message || 'Could not load live draw state.');
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setSyncStatus('error');
          setErrorMessage('The realtime connection was interrupted. Reload to reconnect.');
        }
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  return { drawState, syncStatus, errorMessage };
}

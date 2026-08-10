import { useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { toPublicDrawState } from '../utils/realtimeRoom';

const INITIAL_STATUS = isSupabaseConfigured ? 'idle' : 'unconfigured';

export function useRealtimePublisher({ roomId, writeKey, appState, enabled = true }) {
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [errorMessage, setErrorMessage] = useState('');
  const readyRoomRef = useRef('');
  const lastPublishedRef = useRef('');
  const publishQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setStatus('unconfigured');
      return undefined;
    }
    if (!enabled || !roomId || !writeKey) {
      setStatus('idle');
      setErrorMessage('');
      readyRoomRef.current = '';
      lastPublishedRef.current = '';
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      publishQueueRef.current = publishQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (cancelled) return;
          try {
            setStatus(readyRoomRef.current === roomId ? 'syncing' : 'connecting');
            setErrorMessage('');

            if (readyRoomRef.current !== roomId) {
              const { error: roomError } = await supabase.rpc('create_draw_room', {
                p_room_id: roomId,
                p_write_key: writeKey,
              });
              if (roomError) throw roomError;
              readyRoomRef.current = roomId;
            }

            const publicState = toPublicDrawState(appState);
            const serializedState = JSON.stringify(publicState);
            if (serializedState === lastPublishedRef.current) {
              if (!cancelled) setStatus('live');
              return;
            }

            const { error: publishError } = await supabase.rpc('publish_draw_state', {
              p_room_id: roomId,
              p_write_key: writeKey,
              p_state: publicState,
            });
            if (publishError) throw publishError;

            lastPublishedRef.current = serializedState;
            if (!cancelled) setStatus('live');
          } catch (error) {
            if (!cancelled) {
              console.error('Failed to publish live draw state', error);
              setStatus('error');
              setErrorMessage(error.message || 'Could not publish live draw state.');
            }
          }
        });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [appState, enabled, roomId, writeKey]);

  return { status, errorMessage };
}

import { useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

export function useRemoteDrawController({ roomId = '', writeKey = '', enabled = true, onDraw }) {
  const [status, setStatus] = useState(isSupabaseConfigured ? 'idle' : 'unconfigured');
  const [errorMessage, setErrorMessage] = useState('');
  const callbackRef = useRef(onDraw);
  const requestPendingRef = useRef(false);
  callbackRef.current = onDraw;

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setStatus('unconfigured');
      return undefined;
    }
    if (!enabled || !roomId || !writeKey) {
      setStatus('idle');
      setErrorMessage('');
      return undefined;
    }

    let cancelled = false;
    let errorReported = false;

    const claimNextCommand = async () => {
      if (cancelled || requestPendingRef.current) return;
      requestPendingRef.current = true;
      try {
        const { data, error } = await supabase.rpc('claim_remote_draw_command', {
          p_room_id: roomId,
          p_write_key: writeKey,
        });
        if (error) throw error;
        if (cancelled) return;
        setStatus('listening');
        setErrorMessage('');
        errorReported = false;
        if (data) {
          Promise.resolve(callbackRef.current?.()).catch((drawError) => {
            console.error('Remote draw command failed', drawError);
          });
        }
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          setErrorMessage(error.message || 'Remote control listener is unavailable.');
          if (!errorReported) console.error('Failed to claim remote draw command', error);
          errorReported = true;
        }
      } finally {
        requestPendingRef.current = false;
      }
    };

    setStatus('connecting');
    claimNextCommand();
    const interval = setInterval(claimNextCommand, 700);
    return () => {
      cancelled = true;
      clearInterval(interval);
      requestPendingRef.current = false;
    };
  }, [enabled, roomId, writeKey]);

  return { status, errorMessage };
}

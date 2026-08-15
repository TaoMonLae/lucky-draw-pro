import { useEffect } from 'react';

export function useFinaleModeReset({
  operationMode,
  finaleTimeoutRef,
  setGrandFinalePhase,
  setShowConfetti,
}) {
  useEffect(() => {
    if (operationMode === 'standard') return;
    clearTimeout(finaleTimeoutRef.current);
    finaleTimeoutRef.current = null;
    setGrandFinalePhase('idle');
    setShowConfetti(false);
  }, [finaleTimeoutRef, operationMode, setGrandFinalePhase, setShowConfetti]);
}

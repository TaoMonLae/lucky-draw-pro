export const GRAND_FINALE_DRAW_DURATION_MS = 15000;
export const REGULAR_NAME_DRAW_DURATION_MS = 4000;

export function getPaddedDigits(value, maxDigits) {
  return String(value).padStart(maxDigits, '0').split('');
}

export function isGrandPrizeDraw(completedPrizeCount, prizeCount) {
  return prizeCount > 0 && completedPrizeCount === prizeCount - 1;
}

export function getNumericReelConfigs(digitCount, isGrandFinal = false) {
  const count = Math.max(1, Math.floor(Number(digitCount) || 1));

  if (!isGrandFinal) {
    return Array.from({ length: count }, (_, index) => ({
      start: index * 550,
      duration: 1300 + index * 350,
    }));
  }

  const finalIndex = count - 1;
  const startStep = finalIndex > 0 ? Math.min(800, 4800 / finalIndex) : 0;
  const settleStep = finalIndex > 0 ? Math.min(900, 5600 / finalIndex) : 0;

  return Array.from({ length: count }, (_, index) => {
    const start = index * startStep;
    const end = GRAND_FINALE_DRAW_DURATION_MS - ((finalIndex - index) * settleStep);
    return { start, duration: end - start };
  });
}

export function getLockedDigitCount(reels, elapsed) {
  return reels.filter(({ start, duration }) => elapsed >= start + duration).length;
}

export function getSpinningDigit(winnerDigit, elapsed, duration, isGrandFinal = false) {
  const finalDigit = Number(winnerDigit);
  if (!Number.isInteger(finalDigit) || finalDigit < 0 || finalDigit > 9) return winnerDigit;
  if (elapsed >= duration) return finalDigit;

  // Keep an unlocked reel moving and reserve the winning digit for its actual lock.
  const stepDuration = isGrandFinal ? 260 : 120;
  const remainingSteps = Math.ceil((duration - Math.max(0, elapsed)) / stepDuration);
  const offset = ((remainingSteps - 1) % 9) + 1;
  return (finalDigit + offset) % 10;
}

export function getWinnerAnimationDurationMs({ drawMode, digitCount, isGrandFinal = false }) {
  if (drawMode === 'names') {
    return isGrandFinal ? GRAND_FINALE_DRAW_DURATION_MS : REGULAR_NAME_DRAW_DURATION_MS;
  }

  const reelConfigs = getNumericReelConfigs(digitCount, isGrandFinal);
  const reelDuration = reelConfigs.reduce(
    (longest, reel) => Math.max(longest, reel.start + reel.duration),
    0,
  );
  return reelDuration + (isGrandFinal ? 700 : 300);
}

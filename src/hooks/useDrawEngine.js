export function getPaddedDigits(value, maxDigits) {
  return String(value).padStart(maxDigits, '0').split('');
}

export function isGrandPrizeDraw(completedPrizeCount, prizeCount) {
  return prizeCount > 0 && completedPrizeCount === prizeCount - 1;
}

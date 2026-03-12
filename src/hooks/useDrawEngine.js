export function getPaddedDigits(value, maxDigits) {
  return String(value).padStart(maxDigits, '0').split('');
}

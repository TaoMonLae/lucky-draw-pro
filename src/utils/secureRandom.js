const UINT32_RANGE = 0x100000000;

/**
 * Return an unbiased random integer from 0 (inclusive) to length (exclusive).
 * Rejection sampling avoids the modulo bias that would otherwise occur when
 * the requested range does not divide evenly into the 32-bit random range.
 */
export function secureRandomIndex(length, cryptoApi = window.crypto) {
  if (!Number.isSafeInteger(length) || length < 1 || length > UINT32_RANGE) {
    throw new RangeError('Random selection length must be an integer between 1 and 2^32.');
  }
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error('Secure random number generation is not available in this browser.');
  }

  const rejectionLimit = UINT32_RANGE - (UINT32_RANGE % length);
  const randomValue = new Uint32Array(1);

  do {
    cryptoApi.getRandomValues(randomValue);
  } while (randomValue[0] >= rejectionLimit);

  return randomValue[0] % length;
}

export function selectRandomEntries(entries = [], count = 1, randomIndex = secureRandomIndex) {
  const pool = [...entries];
  const requestedCount = Math.max(0, Math.floor(Number(count) || 0));
  const selected = [];

  while (selected.length < requestedCount && pool.length > 0) {
    selected.push(pool.splice(randomIndex(pool.length), 1)[0]);
  }

  return selected;
}

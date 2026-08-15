import { secureRandomIndex, selectRandomEntries } from './secureRandom';

function sequenceCrypto(values) {
  const remaining = [...values];
  return {
    getRandomValues(array) {
      array[0] = remaining.shift();
      return array;
    },
  };
}

describe('secureRandomIndex', () => {
  test('maps the full accepted 32-bit range into valid indexes', () => {
    expect(secureRandomIndex(10, sequenceCrypto([0]))).toBe(0);
    expect(secureRandomIndex(10, sequenceCrypto([4294967289]))).toBe(9);
  });

  test('rejects the uneven tail instead of introducing modulo bias', () => {
    // For length 3, 2^32 leaves a remainder of 1. The last uint32 value
    // must be discarded before the next random value is mapped.
    const cryptoApi = sequenceCrypto([4294967295, 8]);
    expect(secureRandomIndex(3, cryptoApi)).toBe(2);
  });

  test('fails closed when secure randomness is unavailable', () => {
    expect(() => secureRandomIndex(10, {})).toThrow(/not available/);
  });

  test('rejects invalid pool lengths', () => {
    expect(() => secureRandomIndex(0, sequenceCrypto([0]))).toThrow(RangeError);
    expect(() => secureRandomIndex(1.5, sequenceCrypto([0]))).toThrow(RangeError);
  });
});

describe('selectRandomEntries', () => {
  test('selects without replacement and leaves the source unchanged', () => {
    const entries = ['20061', '30000', '40000', '50060'];
    const selected = selectRandomEntries(entries, 3, (length) => length - 1);

    expect(selected).toEqual(['50060', '40000', '30000']);
    expect(entries).toEqual(['20061', '30000', '40000', '50060']);
  });

  test('caps the requested count at the available pool size', () => {
    expect(selectRandomEntries(['A', 'B'], 5, () => 0)).toEqual(['A', 'B']);
  });
});

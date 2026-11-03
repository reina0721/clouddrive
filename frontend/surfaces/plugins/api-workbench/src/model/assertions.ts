export function createExpectation(actual: unknown) {
  const isDeepEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!isDeepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
        return false;
      }
    }
    return true;
  };

  return {
    toBe(expected: unknown) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
      }
    },
    toEqual(expected: unknown) {
      if (!isDeepEqual(actual, expected)) {
        throw new Error(
          `Expected deep equal ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
        );
      }
    },
    toContain(item: unknown) {
      if (typeof actual === 'string' && typeof item === 'string') {
        if (!actual.includes(item)) {
          throw new Error(`Expected string "${actual}" to contain "${item}"`);
        }
        return;
      }
      if (Array.isArray(actual)) {
        if (!actual.includes(item)) {
          throw new Error(
            `Expected array ${JSON.stringify(actual)} to contain ${JSON.stringify(item)}`,
          );
        }
        return;
      }
      throw new Error(`toContain cannot be used on type ${typeof actual}`);
    },
    toBeGreaterThan(n: number) {
      if (typeof actual !== 'number' || actual <= n) {
        throw new Error(`Expected ${String(actual)} to be greater than ${n}`);
      }
    },
    toBeLessThan(n: number) {
      if (typeof actual !== 'number' || actual >= n) {
        throw new Error(`Expected ${String(actual)} to be less than ${n}`);
      }
    },
    toBeTruthy() {
      if (!actual) {
        throw new Error(`Expected truthy value but got ${JSON.stringify(actual)}`);
      }
    },
    toBeFalsy() {
      if (actual) {
        throw new Error(`Expected falsy value but got ${JSON.stringify(actual)}`);
      }
    },
    toBeNull() {
      if (actual !== null) {
        throw new Error(`Expected null but got ${JSON.stringify(actual)}`);
      }
    },
    not: {
      toBe(expected: unknown) {
        if (actual === expected) {
          throw new Error(`Expected value not to be ${JSON.stringify(expected)}`);
        }
      },
      toEqual(expected: unknown) {
        if (isDeepEqual(actual, expected)) {
          throw new Error(`Expected value not to deep equal ${JSON.stringify(expected)}`);
        }
      },
      toContain(item: unknown) {
        if (typeof actual === 'string' && typeof item === 'string' && actual.includes(item)) {
          throw new Error(`Expected string "${actual}" not to contain "${item}"`);
        }
        if (Array.isArray(actual) && actual.includes(item)) {
          throw new Error(`Expected array not to contain ${JSON.stringify(item)}`);
        }
      },
      toBeTruthy() {
        if (actual) {
          throw new Error(`Expected value not to be truthy`);
        }
      },
      toBeFalsy() {
        if (!actual) {
          throw new Error(`Expected value not to be falsy`);
        }
      },
    },
  };
}

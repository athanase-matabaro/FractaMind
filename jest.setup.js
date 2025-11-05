import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';
import 'fake-indexeddb/auto';

// Polyfill TextEncoder/TextDecoder for Node.js test environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill structuredClone for Node.js < 17
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => {
    return JSON.parse(JSON.stringify(obj));
  };
}

// Mock crypto.subtle for SHA-256 hashing in tests
if (!global.crypto) {
  global.crypto = {};
}
if (!global.crypto.subtle) {
  global.crypto.subtle = {
    digest: async (algorithm, data) => {
      // Simple deterministic mock hash for testing
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        hash = ((hash << 5) - hash) + data[i];
        hash = hash & hash; // Convert to 32bit integer
      }
      // Return 32 bytes (256 bits) with deterministic content
      const buffer = new ArrayBuffer(32);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < 32; i++) {
        view[i] = (hash + i) & 0xFF;
      }
      return buffer;
    }
  };
}

// Mock IDBKeyRange for tests that need it
if (!global.IDBKeyRange) {
  global.IDBKeyRange = {
    bound: (lower, upper, lowerOpen, upperOpen) => ({
      lower,
      upper,
      lowerOpen: lowerOpen || false,
      upperOpen: upperOpen || false
    }),
    only: (value) => ({ lower: value, upper: value }),
    lowerBound: (lower, open) => ({ lower, lowerOpen: open || false }),
    upperBound: (upper, open) => ({ upper, upperOpen: open || false })
  };
}

// Mock window.matchMedia for responsive components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

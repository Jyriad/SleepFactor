/**
 * Minimal Web Crypto polyfill for Supabase PKCE on React Native (no crypto.subtle in Hermes).
 * Must load before any @supabase/supabase-js import.
 */
import * as ExpoCrypto from 'expo-crypto';

const hasSubtle =
  typeof globalThis.crypto !== 'undefined' &&
  globalThis.crypto.subtle &&
  typeof globalThis.crypto.subtle.digest === 'function';

if (!hasSubtle) {
  const getRandomValues = (typedArray) => {
    ExpoCrypto.getRandomValues(typedArray);
    return typedArray;
  };

  const subtle = {
    async digest(algorithm, data) {
      const name = typeof algorithm === 'string' ? algorithm : algorithm?.name;
      if (name !== 'SHA-256' && name !== 'SHA-1') {
        throw new Error(`polyfill: unsupported digest ${name}`);
      }
      const buf = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer);
      const str = new TextDecoder('utf-8', { fatal: false }).decode(buf);
      const algo =
        name === 'SHA-256'
          ? ExpoCrypto.CryptoDigestAlgorithm.SHA256
          : ExpoCrypto.CryptoDigestAlgorithm.SHA1;
      const hex = await ExpoCrypto.digestStringAsync(algo, str, {
        encoding: ExpoCrypto.CryptoEncoding.HEX,
      });
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      }
      return out.buffer;
    },
  };

  globalThis.crypto = Object.assign(globalThis.crypto || {}, {
    getRandomValues,
    subtle,
  });
}

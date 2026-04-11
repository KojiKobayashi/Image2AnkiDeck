/**
 * src/utils/idGenerator.ts
 * ユニークIDを生成するユーティリティ。
 */

function generateUuidV4Fallback(): string {
  const cryptoObject = globalThis.crypto;

  if (!cryptoObject?.getRandomValues) {
    throw new Error('Secure random number generation is not supported in this environment.');
  }

  const bytes = cryptoObject.getRandomValues(new Uint8Array(16));

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

/**
 * ユニークIDを生成する。
 */
export function generateId(): string {
  const cryptoObject = globalThis.crypto;

  if (cryptoObject?.randomUUID) {
    return cryptoObject.randomUUID();
  }

  return generateUuidV4Fallback();
}

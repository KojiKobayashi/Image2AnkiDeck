/**
 * src/utils/idGenerator.ts
 * ユニークIDを生成するユーティリティ。
 */

/**
 * ユニークIDを生成する。
 */
export function generateId(): string {
  return crypto.randomUUID();
}

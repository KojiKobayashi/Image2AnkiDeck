/**
 * src/utils/idGenerator.ts
 * ユニークIDを生成するユーティリティ。
 */

let counter = 0;

/**
 * 簡易的なユニークIDを生成する。
 */
export function generateId(): string {
  counter += 1;
  return `card_${Date.now()}_${counter}`;
}

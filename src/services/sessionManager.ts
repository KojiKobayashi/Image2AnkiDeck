/**
 * src/services/sessionManager.ts
 * セッションJSONの保存・読み込みを扱う。
 */

import type { Session } from "../types";

const MAX_RECT_SIDE_LENGTH = 50000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidRectSize(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0 && value <= MAX_RECT_SIDE_LENGTH;
}

function isValidRect(value: unknown): boolean {
  if (value === null) {
    return true;
  }
  if (!isRecord(value)) {
    return false;
  }
  return (
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isValidRectSize(value.w) &&
    isValidRectSize(value.h)
  );
}

function assertValidSession(value: unknown): asserts value is Session {
  if (!isRecord(value)) {
    throw new Error("セッション形式が不正です");
  }
  if (typeof value.deckName !== "string") {
    throw new Error("deckName が不正です");
  }
  if (!Array.isArray(value.cards)) {
    throw new Error("cards が不正です");
  }

  for (const card of value.cards) {
    if (!isRecord(card)) {
      throw new Error("カード形式が不正です");
    }
    if (
      typeof card.id !== "string" ||
      (card.questionImageSrc !== null && typeof card.questionImageSrc !== "string") ||
      (card.answerImageSrc !== null && typeof card.answerImageSrc !== "string") ||
      typeof card.questionText !== "string" ||
      typeof card.answerText !== "string"
    ) {
      throw new Error("カードの必須項目が不足しています");
    }
    if (!isValidRect(card.questionRect) || !isValidRect(card.answerRect)) {
      throw new Error("矩形情報が不正です");
    }
    if (
      card.questionImageSrc !== null &&
      card.questionRect === null
    ) {
      throw new Error("問題画像の矩形情報が不足しています");
    }
    if (
      card.answerImageSrc !== null &&
      card.answerRect === null
    ) {
      throw new Error("解答画像の矩形情報が不足しています");
    }
    if (
      card.questionImageSrc === null &&
      card.questionText.trim().length === 0
    ) {
      throw new Error("問題は画像またはテキストのいずれかが必要です");
    }
    if (
      card.answerImageSrc === null &&
      card.answerText.trim().length === 0
    ) {
      throw new Error("解答は画像またはテキストのいずれかが必要です");
    }
  }
}

export function serializeSession(session: Session): string {
  return JSON.stringify(session, null, 2);
}

export function downloadSession(session: Session, fileName = "session.json"): void {
  const blob = new Blob([serializeSession(session)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

export async function loadSession(file: File): Promise<Session> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("JSONの構文が不正です");
  }
  assertValidSession(parsed);
  return parsed;
}

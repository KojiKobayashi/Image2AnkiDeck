/**
 * src/services/sessionManager.ts
 * セッションJSONの保存・読み込みを扱う。
 */

import type { Session } from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
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
      typeof card.questionImageSrc !== "string" ||
      typeof card.answerImageSrc !== "string"
    ) {
      throw new Error("カードの必須項目が不足しています");
    }
    if (!isRecord(card.questionRect) || !isRecord(card.answerRect)) {
      throw new Error("矩形情報が不正です");
    }
    if (
      !isFiniteNumber(card.questionRect.x) ||
      !isFiniteNumber(card.questionRect.y) ||
      !isFiniteNumber(card.questionRect.w) ||
      !isFiniteNumber(card.questionRect.h) ||
      !isFiniteNumber(card.answerRect.x) ||
      !isFiniteNumber(card.answerRect.y) ||
      !isFiniteNumber(card.answerRect.w) ||
      !isFiniteNumber(card.answerRect.h)
    ) {
      throw new Error("矩形情報が不正です");
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

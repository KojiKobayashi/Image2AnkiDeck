/**
 * src/services/csvExporter.ts
 * Ankiインポート用CSV（Front,Back）を生成する。
 */

import type { Card } from "../types";

const DEFAULT_PADDING = 3;

export type CsvExportOptions = {
  /** 連番の開始番号（既定: 1） */
  startIndex?: number;
  /** ゼロパディング桁数（既定: 3） */
  padding?: number;
};

function escapeCsvField(value: string): string {
  const escaped = value.replaceAll('"', '""');
  const requiresQuotes = /[",\r\n]/.test(escaped);
  return requiresQuotes ? `"${escaped}"` : escaped;
}

function toImageTag(fileName: string): string {
  return `<img src="${fileName}">`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toTextHtml(text: string): string {
  return escapeHtml(text).replaceAll("\n", "<br>");
}

function toMediaFileName(prefix: "q" | "a", index: number, padding: number): string {
  return `${prefix}_${String(index).padStart(padding, "0")}.png`;
}

/**
 * カード配列からAnkiインポート用CSV文字列を生成する。
 * 出力形式:
 * "<img src=""q_001.png"">","<img src=""a_001.png"">"
 */
export function createDeckCsv(cards: Card[], options: CsvExportOptions = {}): string {
  const startIndex = options.startIndex ?? 1;
  const padding = options.padding ?? DEFAULT_PADDING;

  if (!Number.isInteger(startIndex) || startIndex < 1) {
    throw new Error(`startIndex (${startIndex}) は 1 以上の整数である必要があります`);
  }
  if (!Number.isInteger(padding) || padding < 1) {
    throw new Error(`padding (${padding}) は 1 以上の整数である必要があります`);
  }

  const rows = cards.map((card, offset) => {
    const hasQuestionImage =
      typeof card.questionImage === "string" && card.questionImage.trim().length > 0;
    const hasQuestionText = card.questionText.trim().length > 0;
    const hasAnswerImage =
      typeof card.answerImage === "string" && card.answerImage.trim().length > 0;
    const hasAnswerText = card.answerText.trim().length > 0;

    if ((!hasQuestionImage && !hasQuestionText) || (!hasAnswerImage && !hasAnswerText)) {
      const missing = [
        !hasQuestionImage && !hasQuestionText ? "問題（画像またはテキスト）" : null,
        !hasAnswerImage && !hasAnswerText ? "解答（画像またはテキスト）" : null,
      ]
        .filter((value): value is string => value !== null)
        .join("・");
      throw new Error(`カード（配列内位置 ${offset} / id: ${card.id}）の${missing}が不足しています`);
    }

    const sequence = startIndex + offset;
    const front = [
      hasQuestionImage ? toImageTag(toMediaFileName("q", sequence, padding)) : null,
      hasQuestionText ? toTextHtml(card.questionText) : null,
    ]
      .filter((value): value is string => value !== null)
      .join("<br>");
    const back = [
      hasAnswerImage ? toImageTag(toMediaFileName("a", sequence, padding)) : null,
      hasAnswerText ? toTextHtml(card.answerText) : null,
    ]
      .filter((value): value is string => value !== null)
      .join("<br>");
    return `${escapeCsvField(front)},${escapeCsvField(back)}`;
  });

  return `${rows.join("\n")}\n`;
}

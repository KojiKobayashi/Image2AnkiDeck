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
  return `"${value.replaceAll('"', '""')}"`;
}

function toImageTag(fileName: string): string {
  return `<img src="${fileName}">`;
}

function toMediaFileName(prefix: "q" | "a", index: number, padding: number): string {
  return `${prefix}_${String(index).padStart(padding, "0")}.png`;
}

/**
 * カード配列からAnkiインポート用CSV文字列を生成する。
 * 出力形式:
 * Front,Back
 * "<img src=""q_001.png"">","<img src=""a_001.png"">"
 */
export function createDeckCsv(cards: Card[], options: CsvExportOptions = {}): string {
  const startIndex = options.startIndex ?? 1;
  const padding = options.padding ?? DEFAULT_PADDING;

  if (!Number.isInteger(startIndex) || startIndex < 1) {
    throw new Error("startIndex must be an integer greater than or equal to 1");
  }
  if (!Number.isInteger(padding) || padding < 1) {
    throw new Error("padding must be an integer greater than or equal to 1");
  }

  const rows = cards.map((card, offset) => {
    if (!card.questionImage || !card.answerImage) {
      throw new Error(`Card ${card.id} does not have questionImage/answerImage`);
    }

    const sequence = startIndex + offset;
    const front = toImageTag(toMediaFileName("q", sequence, padding));
    const back = toImageTag(toMediaFileName("a", sequence, padding));
    return `${escapeCsvField(front)},${escapeCsvField(back)}`;
  });

  return ["Front,Back", ...rows].join("\n");
}

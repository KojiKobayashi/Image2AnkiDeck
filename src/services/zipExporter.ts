/**
 * src/services/zipExporter.ts
 * CSVと画像をまとめたAnki用ZIPファイルの生成・保存を扱う。
 */

import JSZip from "jszip";
import type { Card } from "../types";
import { createDeckCsv } from "./csvExporter";

const DEFAULT_PADDING = 3;
const URL_REVOCATION_DELAY_MS = 300;

export type ZipExportOptions = {
  /** 連番の開始番号（既定: 1） */
  startIndex?: number;
  /** ゼロパディング桁数（既定: 3） */
  padding?: number;
};

function toMediaFileName(prefix: "q" | "a", index: number, padding: number): string {
  return `${prefix}_${String(index).padStart(padding, "0")}.png`;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  if (!response.ok) {
    throw new Error("画像データの変換に失敗しました");
  }
  return response.blob();
}

export async function createDeckZip(cards: Card[], options: ZipExportOptions = {}): Promise<Blob> {
  const startIndex = options.startIndex ?? 1;
  const padding = options.padding ?? DEFAULT_PADDING;
  const zip = new JSZip();

  zip.file("deck.csv", createDeckCsv(cards, { startIndex, padding }));

  await Promise.all(
    cards.map(async (card, offset) => {
      const sequence = startIndex + offset;
      const questionFileName = toMediaFileName("q", sequence, padding);
      const answerFileName = toMediaFileName("a", sequence, padding);
      const [questionBlob, answerBlob] = await Promise.all([
        dataUrlToBlob(card.questionImage),
        dataUrlToBlob(card.answerImage),
      ]);
      zip.file(questionFileName, questionBlob);
      zip.file(answerFileName, answerBlob);
    })
  );

  return zip.generateAsync({ type: "blob" });
}

export async function downloadDeckZip(cards: Card[], deckName: string): Promise<void> {
  const zipBlob = await createDeckZip(cards);
  const url = URL.createObjectURL(zipBlob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${deckName || "deck"}.zip`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), URL_REVOCATION_DELAY_MS);
}

/**
 * src/services/zipExporter.ts
 * CSVと画像をまとめたAnki用ZIPファイルの生成・保存を扱う。
 */

import JSZip from "jszip";
import type { Card } from "../types";
import { createDeckCsv } from "./csvExporter";

const DEFAULT_PADDING = 3;
const URL_REVOCATION_DELAY_MS = 300;
const MAX_DOWNLOAD_NAME_LENGTH = 100;
const DEFAULT_DECK_NAME = "deck";
const WINDOWS_RESERVED_NAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);

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

function sanitizeFileBaseName(name: string): string {
  // C0 (0-31), DEL (127), C1 (128-159) control characters
  const withoutControlChars = Array.from(name)
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127 || (code >= 128 && code <= 159) ? "_" : char;
    })
    .join("");

  const sanitized = withoutControlChars
    .replace(/[<>:"/\\|?*]/g, "_")
    .trim()
    .replace(/[. ]+$/, "")
    .slice(0, MAX_DOWNLOAD_NAME_LENGTH);

  if (!sanitized) {
    return DEFAULT_DECK_NAME;
  }

  const reservedNameCandidate = sanitized.split(".")[0]?.toUpperCase() ?? sanitized.toUpperCase();
  return WINDOWS_RESERVED_NAMES.has(reservedNameCandidate)
    ? `${sanitized}_`
    : sanitized;
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
  anchor.download = `${sanitizeFileBaseName(deckName)}.zip`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), URL_REVOCATION_DELAY_MS);
}

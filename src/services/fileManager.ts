import JSZip from "jszip";
import type { Session, SessionCard } from "../types";
import { normalizeDeckUuid } from "../utils/deckUuid";
import { generateId } from "../utils/idGenerator";

const DEFAULT_DECK_NAME = "deck";
const ZIP_CARD_ID_PREFIX = "zip-";
const ZIP_CARD_ID_PADDING = 6;
const DEFAULT_CARD_NUMBER_PADDING = 4;
const MAX_CARD_NUMBER_PADDING = 12;
const CSV_HEADER_PATTERN = /^front,back$/i;

export type AppendCardInput = {
  questionImage: Blob;
  answerImage: Blob;
};

type ImageSize = {
  width: number;
  height: number;
};

function extractMaxIndexFromCsvText(text: string): number {
  let max = 0;
  for (const match of text.matchAll(/(?:q|a)_(\d+)\.png/g)) {
    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isNaN(parsed)) {
      max = Math.max(max, parsed);
    }
  }
  return max;
}

function extractPaddingFromCsvText(text: string): number {
  let maxPadding = 0;
  for (const match of text.matchAll(/(?:q|a)_(\d+)\.png/g)) {
    maxPadding = Math.max(maxPadding, match[1].length);
  }
  return maxPadding;
}

function parseCardImageFilename(filename: string): {
  matched: boolean;
  deckUuid: string | null;
  prefix: "q" | "a" | "";
  index: number;
  padding: number;
} {
  const match = /^(?:([A-Za-z0-9-]+)_)?([QqAa])_(\d+)\.png$/.exec(filename);
  if (!match) {
    return { matched: false, deckUuid: null, prefix: "", index: 0, padding: 0 };
  }

  const parsed = Number.parseInt(match[3], 10);
  return Number.isNaN(parsed)
    ? { matched: false, deckUuid: null, prefix: "", index: 0, padding: 0 }
    : {
        matched: true,
        deckUuid: match[1] ?? null,
        prefix: match[2].toLowerCase() as "q" | "a",
        index: parsed,
        padding: match[3].length,
      };
}

function isValidCardNumberPadding(padding: number): boolean {
  return Number.isInteger(padding) && padding >= 1 && padding <= MAX_CARD_NUMBER_PADDING;
}

function formatCardNumber(num: number, padding: number): string {
  return String(num).padStart(padding, "0");
}

function escapeCsvField(value: string): string {
  return `"${value.replace(/"/g, `""`)}"`;
}

function buildCsvRow(deckUuid: string, cardNumber: number, padding: number): string {
  const safeDeckUuid = normalizeDeckUuid(deckUuid);
  const n = formatCardNumber(cardNumber, padding);
  const front = escapeCsvField(`<img src="${safeDeckUuid}_q_${n}.png">`);
  const back = escapeCsvField(`<img src="${safeDeckUuid}_a_${n}.png">`);
  return `${front},${back}`;
}

function normalizeCsv(existingCsv: string): string[] {
  const lines = existingCsv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.filter((line) => !CSV_HEADER_PATTERN.test(line));
}

function resolveCardNumberPadding(detectedPadding: number): number {
  if (isValidCardNumberPadding(detectedPadding)) {
    return detectedPadding;
  }
  return DEFAULT_CARD_NUMBER_PADDING;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("画像の読み込みに失敗しました"));
    };
    reader.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    reader.readAsDataURL(blob);
  });
}

function readImageSize(imageSrc: string): Promise<ImageSize> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("画像サイズの取得に失敗しました"));
    image.src = imageSrc;
  });
}

function toDeckName(fileName: string): string {
  return fileName.replace(/\.zip$/i, "").trim() || DEFAULT_DECK_NAME;
}

export async function loadDeckZipAsSession(deckZipFile: File): Promise<Session> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await deckZipFile.arrayBuffer());
  } catch {
    throw new Error("ZIPの読み込みに失敗しました。ファイル形式を確認してください");
  }
  const questionFiles = new Map<number, string>();
  const answerFiles = new Map<number, string>();
  let deckUuid: string | null = null;

  for (const name of Object.keys(zip.files)) {
    const { matched, deckUuid: parsedDeckUuid, prefix, index } = parseCardImageFilename(name);
    if (!matched) {
      continue;
    }

    if (deckUuid === null && parsedDeckUuid) {
      deckUuid = parsedDeckUuid;
    }

    if (prefix === "q") {
      questionFiles.set(index, name);
      continue;
    }

    answerFiles.set(index, name);
  }

  const sortedIndices = [...questionFiles.keys()]
    .filter((index) => answerFiles.has(index))
    .sort((a, b) => a - b);
  const cards: SessionCard[] = [];

  for (const index of sortedIndices) {
    const questionName = questionFiles.get(index);
    const answerName = answerFiles.get(index);
    if (!questionName || !answerName) {
      continue;
    }
    const questionFile = zip.file(questionName);
    const answerFile = zip.file(answerName);
    if (questionFile == null || answerFile == null) {
      continue;
    }

    const [questionBlob, answerBlob] = await Promise.all([
      questionFile.async("blob"),
      answerFile.async("blob"),
    ]);
    const [questionImageSrc, answerImageSrc] = await Promise.all([
      blobToDataUrl(questionBlob),
      blobToDataUrl(answerBlob),
    ]);
    const [questionSize, answerSize] = await Promise.all([
      readImageSize(questionImageSrc),
      readImageSize(answerImageSrc),
    ]);

    cards.push({
      id: `${ZIP_CARD_ID_PREFIX}${String(index).padStart(ZIP_CARD_ID_PADDING, "0")}`,
      questionRect: { x: 0, y: 0, w: questionSize.width, h: questionSize.height },
      answerRect: { x: 0, y: 0, w: answerSize.width, h: answerSize.height },
      questionImageSrc,
      questionText: "",
      answerImageSrc,
      answerText: "",
    });
  }

  if (cards.length === 0) {
    throw new Error(`${deckZipFile.name} からカード画像を読み込めませんでした`);
  }

  return {
    deckName: toDeckName(deckZipFile.name),
    deckUuid: normalizeDeckUuid(deckUuid ?? generateId()),
    cards,
  };
}

export async function appendCardsToExistingDeck(
  deckZipFile: Blob,
  newCards: AppendCardInput[]
): Promise<Blob> {
  const zip = await JSZip.loadAsync(await deckZipFile.arrayBuffer());
  const existingCsv = await zip.file("deck.csv")?.async("text");
  const csvLines = normalizeCsv(existingCsv ?? "");
  const csvText = csvLines.join("\n");

  let maxIndex = extractMaxIndexFromCsvText(csvText);
  let detectedPadding = extractPaddingFromCsvText(csvText);
  let deckUuid: string | null = null;

  Object.keys(zip.files).forEach((filename) => {
    const { matched, deckUuid: parsedDeckUuid, index, padding } = parseCardImageFilename(filename);
    if (!matched) {
      return;
    }
    if (deckUuid === null && parsedDeckUuid) {
      deckUuid = parsedDeckUuid;
    }
    maxIndex = Math.max(maxIndex, index);
    detectedPadding = Math.max(detectedPadding, padding);
  });

  const cardNumberPadding = resolveCardNumberPadding(detectedPadding);
  const resolvedDeckUuid = normalizeDeckUuid(deckUuid ?? generateId());

  for (const card of newCards) {
    maxIndex += 1;
    const n = formatCardNumber(maxIndex, cardNumberPadding);
    zip.file(`${resolvedDeckUuid}_q_${n}.png`, await card.questionImage.arrayBuffer());
    zip.file(`${resolvedDeckUuid}_a_${n}.png`, await card.answerImage.arrayBuffer());
    csvLines.push(buildCsvRow(resolvedDeckUuid, maxIndex, cardNumberPadding));
  }

  zip.file("deck.csv", `${csvLines.join("\n")}\n`);
  return zip.generateAsync({ type: "blob" });
}

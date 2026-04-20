import JSZip from "jszip";
import initSqlJs from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { Session, SessionCard } from "../types";

const DEFAULT_DECK_NAME = "deck";
const APKG_CARD_ID_PREFIX = "apkg-";
const APKG_CARD_ID_PADDING = 6;
const DEFAULT_CARD_NUMBER_PADDING = 4;
const MAX_CARD_NUMBER_PADDING = 12;
const CSV_HEADER_PATTERN = /^front,back$/i;
const FIELD_SEPARATOR = "\x1f";

let sqlJsPromise: ReturnType<typeof initSqlJs> | null = null;

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
  index: number;
  padding: number;
} {
  const match = /^(?:q|a)_(\d+)\.png$/i.exec(filename);
  if (!match) {
    return { matched: false, index: 0, padding: 0 };
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed)
    ? { matched: false, index: 0, padding: 0 }
    : { matched: true, index: parsed, padding: match[1].length };
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

function buildCsvRow(cardNumber: number, padding: number): string {
  const n = formatCardNumber(cardNumber, padding);
  const front = escapeCsvField(`<img src="q_${n}.png">`);
  const back = escapeCsvField(`<img src="a_${n}.png">`);
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
  return fileName.replace(/\.apkg$/i, "").trim() || DEFAULT_DECK_NAME;
}

function extractImageNameFromHtml(html: string): string | null {
  const match = /<img\b[^>]*\bsrc=(['"]?)([^"'>\s]+)\1[^>]*>/i.exec(html);
  return match?.[2] ?? null;
}

function htmlToText(html: string): string {
  const withoutImages = html.replace(/<img\b[^>]*>/gi, "");
  const withLineBreaks = withoutImages.replace(/<br\s*\/?>/gi, "\n");
  const container = document.createElement("div");
  container.innerHTML = withLineBreaks;
  return container.textContent ?? "";
}

function parseDeckId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

async function getSqlJs() {
  if (sqlJsPromise === null) {
    sqlJsPromise = initSqlJs({
      locateFile: () => sqlWasmUrl,
    }).catch((error) => {
      sqlJsPromise = null;
      throw error;
    });
  }
  return sqlJsPromise;
}

export async function loadDeckApkgAsSession(deckZipFile: File): Promise<Session> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await deckZipFile.arrayBuffer());
  } catch {
    throw new Error("APKGの読み込みに失敗しました。ファイル形式を確認してください");
  }

  const collectionFile = zip.file("collection.anki2");
  const mediaFile = zip.file("media");
  if (collectionFile == null || mediaFile == null) {
    throw new Error("APKGに必要なデータが含まれていません");
  }

  const [collectionBinary, mediaText, SQL] = await Promise.all([
    collectionFile.async("uint8array"),
    mediaFile.async("text"),
    getSqlJs(),
  ]);
  let mediaMap: Record<string, string>;
  try {
    mediaMap = JSON.parse(mediaText) as Record<string, string>;
  } catch {
    throw new Error("APKGのmedia情報が不正です");
  }
  const mediaIdByName = new Map<string, string>();
  Object.entries(mediaMap).forEach(([mediaId, fileName]) => {
    mediaIdByName.set(fileName, mediaId);
  });

  let db: InstanceType<typeof SQL.Database> | null = null;
  const cards: SessionCard[] = [];
  let parsedDeckId: number | null = null;
  let parsedDeckName: string | null = null;

  try {
    db = new SQL.Database(collectionBinary);
    const didRow = db.exec("SELECT did FROM cards ORDER BY id LIMIT 1");
    parsedDeckId = parseDeckId(didRow[0]?.values?.[0]?.[0] ?? null);

    const colRow = db.exec("SELECT decks FROM col LIMIT 1");
    if (colRow.length > 0 && colRow[0].values.length > 0) {
      let decks: Record<string, { name?: string }>;
      try {
        decks = JSON.parse(String(colRow[0].values[0][0])) as Record<string, { name?: string }>;
      } catch {
        throw new Error("APKGのデッキ情報が不正です");
      }
      if (parsedDeckId !== null) {
        parsedDeckName = decks[String(parsedDeckId)]?.name ?? null;
      }
      if (parsedDeckName == null) {
        parsedDeckName = Object.values(decks)[0]?.name ?? null;
      }
    }

    const rows = db.exec(
      "SELECT cards.id, notes.flds FROM cards JOIN notes ON notes.id = cards.nid ORDER BY cards.due ASC, cards.id ASC"
    );
    if (rows.length > 0) {
      for (const row of rows[0].values) {
        const [, fieldsRaw] = row;
        const [frontRaw, backRaw] = String(fieldsRaw).split(FIELD_SEPARATOR);
        const front = frontRaw ?? "";
        const back = backRaw ?? "";
        const questionText = htmlToText(front);
        const answerText = htmlToText(back);
        const questionImageName = extractImageNameFromHtml(front);
        const answerImageName = extractImageNameFromHtml(back);

        const questionMediaId = questionImageName ? mediaIdByName.get(questionImageName) : undefined;
        const answerMediaId = answerImageName ? mediaIdByName.get(answerImageName) : undefined;
        const questionBlobPromise = questionMediaId ? zip.file(questionMediaId)?.async("blob") : undefined;
        const answerBlobPromise = answerMediaId ? zip.file(answerMediaId)?.async("blob") : undefined;
        const [questionBlob, answerBlob] = await Promise.all([
          questionBlobPromise ?? Promise.resolve(undefined),
          answerBlobPromise ?? Promise.resolve(undefined),
        ]);

        const [questionImageSrc, answerImageSrc] = await Promise.all([
          questionBlob ? blobToDataUrl(questionBlob) : Promise.resolve(null),
          answerBlob ? blobToDataUrl(answerBlob) : Promise.resolve(null),
        ]);
        const [questionSize, answerSize] = await Promise.all([
          questionImageSrc ? readImageSize(questionImageSrc) : Promise.resolve(null),
          answerImageSrc ? readImageSize(answerImageSrc) : Promise.resolve(null),
        ]);

        if (questionImageSrc === null && questionText.trim().length === 0) {
          continue;
        }
        if (answerImageSrc === null && answerText.trim().length === 0) {
          continue;
        }

        cards.push({
          id: `${APKG_CARD_ID_PREFIX}${String(cards.length + 1).padStart(APKG_CARD_ID_PADDING, "0")}`,
          questionRect: questionSize ? { x: 0, y: 0, w: questionSize.width, h: questionSize.height } : null,
          answerRect: answerSize ? { x: 0, y: 0, w: answerSize.width, h: answerSize.height } : null,
          questionImageSrc,
          questionText,
          answerImageSrc,
          answerText,
        });
      }
    }
  } finally {
    db?.close();
  }

  if (cards.length === 0) {
    throw new Error(`${deckZipFile.name} からカードを読み込めませんでした`);
  }

  return {
    deckName: parsedDeckName ?? toDeckName(deckZipFile.name),
    deckId: parsedDeckId ?? undefined,
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

  Object.keys(zip.files).forEach((filename) => {
    const { matched, index, padding } = parseCardImageFilename(filename);
    if (!matched) {
      return;
    }
    maxIndex = Math.max(maxIndex, index);
    detectedPadding = Math.max(detectedPadding, padding);
  });

  const cardNumberPadding = resolveCardNumberPadding(detectedPadding);

  for (const card of newCards) {
    maxIndex += 1;
    const n = formatCardNumber(maxIndex, cardNumberPadding);
    zip.file(`q_${n}.png`, await card.questionImage.arrayBuffer());
    zip.file(`a_${n}.png`, await card.answerImage.arrayBuffer());
    csvLines.push(buildCsvRow(maxIndex, cardNumberPadding));
  }

  zip.file("deck.csv", `${csvLines.join("\n")}\n`);
  return zip.generateAsync({ type: "blob" });
}

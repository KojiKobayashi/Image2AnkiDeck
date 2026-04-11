import JSZip from "jszip";
import type { Session, SessionCard } from "../types";

const CSV_HEADER = "Front,Back";

export type AppendCardInput = {
  questionImage: Blob;
  answerImage: Blob;
};

type ImageSize = {
  width: number;
  height: number;
};

function extractMaxIndexFromCsvText(text: string): number {
  const imageFilePattern = /(?:q|a)_(\d+)\.png/g;
  let max = 0;
  let match = imageFilePattern.exec(text);
  while (match) {
    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isNaN(parsed)) {
      max = Math.max(max, parsed);
    }
    match = imageFilePattern.exec(text);
  }
  return max;
}

function extractIndexFromFilename(filename: string): number {
  const match = /^(?:q|a)_(\d+)\.png$/i.exec(filename);
  if (!match) {
    return 0;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatCardNumber(num: number): string {
  return String(num).padStart(3, "0");
}

function buildCsvRow(cardNumber: number): string {
  const n = formatCardNumber(cardNumber);
  return `<img src="q_${n}.png">,<img src="a_${n}.png">`;
}

function normalizeCsv(existingCsv: string): string[] {
  const lines = existingCsv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [CSV_HEADER];
  }

  if (lines[0] !== CSV_HEADER) {
    return [CSV_HEADER, ...lines];
  }

  return lines;
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
  return fileName.replace(/\.zip$/i, "").trim() || "deck";
}

export async function loadDeckZipAsSession(deckZipFile: File): Promise<Session> {
  const zip = await JSZip.loadAsync(await deckZipFile.arrayBuffer());
  const questionFiles = new Map<number, string>();
  const answerFiles = new Map<number, string>();

  Object.keys(zip.files).forEach((name) => {
    const match = /^(q|a)_(\d+)\.png$/i.exec(name);
    if (!match) {
      return;
    }

    const prefix = match[1].toLowerCase();
    const index = Number.parseInt(match[2], 10);
    if (Number.isNaN(index)) {
      return;
    }

    if (prefix === "q") {
      questionFiles.set(index, name);
      return;
    }

    answerFiles.set(index, name);
  });

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
      id: `zip-${String(index).padStart(6, "0")}`,
      questionRect: { x: 0, y: 0, w: questionSize.width, h: questionSize.height },
      answerRect: { x: 0, y: 0, w: answerSize.width, h: answerSize.height },
      questionImageSrc,
      answerImageSrc,
    });
  }

  if (cards.length === 0) {
    throw new Error("deck.zip からカード画像を読み込めませんでした");
  }

  return {
    deckName: toDeckName(deckZipFile.name),
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

  let maxIndex = extractMaxIndexFromCsvText(csvLines.join("\n"));

  Object.keys(zip.files).forEach((filename) => {
    maxIndex = Math.max(maxIndex, extractIndexFromFilename(filename));
  });

  for (const card of newCards) {
    maxIndex += 1;
    const n = formatCardNumber(maxIndex);
    zip.file(`q_${n}.png`, await card.questionImage.arrayBuffer());
    zip.file(`a_${n}.png`, await card.answerImage.arrayBuffer());
    csvLines.push(buildCsvRow(maxIndex));
  }

  zip.file("deck.csv", `${csvLines.join("\n")}\n`);
  return zip.generateAsync({ type: "blob" });
}

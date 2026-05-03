/**
 * src/services/zipExporter.ts
 * Anki用APKGファイルの生成・保存を扱う。
 */

import JSZip from "jszip";
import initSqlJs from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { Card } from "../types";

const DEFAULT_PADDING = 3;
const URL_REVOCATION_DELAY_MS = 300;
const MAX_DOWNLOAD_NAME_LENGTH = 100;
const DEFAULT_DECK_NAME = "deck";
const TEMPLATE_ZIP_NAME = "template.zip";
const FIELD_SEPARATOR = "\x1f";
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

let sqlJsPromise: ReturnType<typeof initSqlJs> | null = null;

export type ZipExportOptions = {
  /** 連番の開始番号（既定: 1） */
  startIndex?: number;
  /** ゼロパディング桁数（既定: 3） */
  padding?: number;
  /** Ankiデッキ名（既定: Default） */
  deckName?: string;
  /** 既存APKGのデッキID（指定時はそのまま使用） */
  deckId?: number;
};

function toMediaFileName(prefix: "q" | "a", index: number, padding: number, deckPrefix: string): string {
  return `${deckPrefix}_${prefix}_${String(index).padStart(padding, "0")}.png`;
}

function dataUrlToPngBlob(dataUrl: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (context == null) {
        reject(new Error("画像データの変換に失敗しました"));
        return;
      }
      context.drawImage(image, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (blob == null) {
            reject(new Error("画像データの変換に失敗しました"));
            return;
          }
          resolve(blob);
        },
        "image/png",
        1
      );
    };
    image.onerror = () => reject(new Error("画像データの変換に失敗しました"));
    image.src = dataUrl;
  });
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

function toImageTag(fileName: string): string {
  return `<img src="${fileName}">`;
}

function hash32(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createDeckPrefix(): string {
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === "function") {
    return webCrypto.randomUUID().replaceAll("-", "").slice(0, 6);
  }

  if (webCrypto && typeof webCrypto.getRandomValues === "function") {
    const bytes = new Uint8Array(3);
    webCrypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return Date.now().toString(16).slice(-6).padStart(6, "0");
}

function createDeckIdFromUuid(): number {
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === "function") {
    const uuidHex = webCrypto.randomUUID().replaceAll("-", "");
    const safeRange = BigInt(Number.MAX_SAFE_INTEGER - 1);
    return Number((BigInt(`0x${uuidHex}`) % safeRange) + 1n);
  }
  return Date.now();
}

function buildCardHtml(card: Card, mediaNames: { question?: string; answer?: string }): { front: string; back: string } {
  const hasQuestionImage = typeof card.questionImage === "string" && card.questionImage.trim().length > 0;
  const hasQuestionText = card.questionText.trim().length > 0;
  const hasAnswerImage = typeof card.answerImage === "string" && card.answerImage.trim().length > 0;
  const hasAnswerText = card.answerText.trim().length > 0;

  if ((!hasQuestionImage && !hasQuestionText) || (!hasAnswerImage && !hasAnswerText)) {
    const missing = [
      !hasQuestionImage && !hasQuestionText ? "問題（画像またはテキスト）" : null,
      !hasAnswerImage && !hasAnswerText ? "解答（画像またはテキスト）" : null,
    ]
      .filter((value): value is string => value !== null)
      .join("・");
    throw new Error(`カード（id: ${card.id}）の${missing}が不足しています`);
  }

  const front = [
    hasQuestionImage && mediaNames.question ? toImageTag(mediaNames.question) : null,
    hasQuestionText ? toTextHtml(card.questionText) : null,
  ]
    .filter((value): value is string => value !== null)
    .join("<br>");
  const back = [
    hasAnswerImage && mediaNames.answer ? toImageTag(mediaNames.answer) : null,
    hasAnswerText ? toTextHtml(card.answerText) : null,
  ]
    .filter((value): value is string => value !== null)
    .join("<br>");

  return { front, back };
}

function resolveTemplateZipUrl(): string {
  const basePath = import.meta.env.BASE_URL || "/";
  return new URL(`${basePath}${TEMPLATE_ZIP_NAME}`, window.location.origin).toString();
}

async function loadTemplateZip(): Promise<JSZip> {
  const response = await fetch(resolveTemplateZipUrl());
  if (!response.ok) {
    throw new Error("template.zip の取得に失敗しました");
  }
  return JSZip.loadAsync(await response.arrayBuffer());
}

async function getSqlJs() {
  if (sqlJsPromise === null) {
    sqlJsPromise = initSqlJs({
      locateFile: () => sqlWasmUrl,
    });
  }
  return sqlJsPromise;
}

function sanitizeDeckNameForAnki(deckName: string): string {
  const trimmed = deckName.trim();
  return trimmed.length > 0 ? trimmed : "Default";
}

function sanitizeForIdentifier(value: string): string {
  return value.replaceAll(/[^A-Za-z0-9]/g, "").slice(0, 16) || "guid";
}

export function sanitizeFileBaseName(name: string): string {
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

  const reservedNameCandidate = sanitized.split(".")[0].toUpperCase();
  return WINDOWS_RESERVED_NAMES.has(reservedNameCandidate) ? `${sanitized}_` : sanitized;
}

export async function createDeckZip(cards: Card[], options: ZipExportOptions = {}): Promise<Blob> {
  const startIndex = options.startIndex ?? 1;
  const padding = options.padding ?? DEFAULT_PADDING;
  const deckName = options.deckName ?? "";
  const requestedDeckId = options.deckId;

  if (!Number.isInteger(startIndex) || startIndex < 1) {
    throw new Error(`startIndex (${startIndex}) は 1 以上の整数である必要があります`);
  }
  if (!Number.isInteger(padding) || padding < 1) {
    throw new Error(`padding (${padding}) は 1 以上の整数である必要があります`);
  }
  if (
    requestedDeckId !== undefined &&
    (!Number.isInteger(requestedDeckId) || requestedDeckId <= 0)
  ) {
    throw new Error(`deckId (${requestedDeckId}) は 1 以上の整数である必要があります`);
  }

  const deckPrefix = createDeckPrefix();
  const templateZip = await loadTemplateZip();
  templateZip.remove("collection.anki21");
  templateZip.remove("collection.anki21b");
  templateZip.remove("meta");
  const collectionFile = templateZip.file("collection.anki2");
  if (collectionFile == null) {
    throw new Error("template.zip に collection.anki2 が含まれていません");
  }

  const SQL = await getSqlJs();
  const db = new SQL.Database(await collectionFile.async("uint8array"));

  try {
    const nowMs = Date.now();
    const noteIdBase = nowMs * 1000;
    const nowSec = Math.floor(nowMs / 1000);
    const colRow = db.exec("SELECT id, models, decks FROM col LIMIT 1");
    if (colRow.length === 0 || colRow[0].values.length === 0) {
      throw new Error("template collection の読み込みに失敗しました");
    }

    const [colIdRaw, modelsRaw, decksRaw] = colRow[0].values[0];
    const colId = Number(colIdRaw);
    const models = JSON.parse(String(modelsRaw)) as Record<string, { id?: number; name?: string }>;
    const decks = JSON.parse(String(decksRaw)) as Record<string, { id?: number; name?: string; mod?: number }>;

    const basicModel =
      Object.values(models).find((model) => model.name === "Basic") ?? Object.values(models)[0];
    const modelId = Number(basicModel?.id ?? Object.keys(models)[0]);

    const templateDeckKey = decks["1"] ? "1" : Object.keys(decks)[0];
    const templateDeckEntry = templateDeckKey ? decks[templateDeckKey] : undefined;
    if (templateDeckEntry == null) {
      throw new Error("template collection のデッキ情報が不正です");
    }
    const deckId = requestedDeckId ?? createDeckIdFromUuid();
    const updatedDeckEntry = {
      ...templateDeckEntry,
      id: deckId,
      name: sanitizeDeckNameForAnki(deckName),
      mod: nowSec,
    };
    const updatedDecks = { ...decks };
    if (templateDeckKey) {
      delete updatedDecks[templateDeckKey];
    }
    updatedDecks[String(deckId)] = updatedDeckEntry;

    db.run("UPDATE col SET mod = ?, scm = ?, decks = ? WHERE id = ?", [
      nowSec,
      nowMs,
      JSON.stringify(updatedDecks),
      colId,
    ]);

    db.run("DELETE FROM cards");
    db.run("DELETE FROM notes");
    db.run("DELETE FROM revlog");
    db.run("DELETE FROM graves");

    const mediaMap: Record<string, string> = {};
    let mediaIndex = 0;

    const noteInsert = db.prepare(
      "INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const cardInsert = db.prepare(
      "INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );

    try {
      for (const [offset, card] of cards.entries()) {
        const sequence = startIndex + offset;
        const mediaNames: { question?: string; answer?: string } = {};

        if (card.questionImage) {
          const questionName = toMediaFileName("q", sequence, padding, deckPrefix);
          const questionBlob = await dataUrlToPngBlob(card.questionImage);
          const mediaId = String(mediaIndex);
          templateZip.file(mediaId, questionBlob);
          mediaMap[mediaId] = questionName;
          mediaNames.question = questionName;
          mediaIndex += 1;
        }

        if (card.answerImage) {
          const answerName = toMediaFileName("a", sequence, padding, deckPrefix);
          const answerBlob = await dataUrlToPngBlob(card.answerImage);
          const mediaId = String(mediaIndex);
          templateZip.file(mediaId, answerBlob);
          mediaMap[mediaId] = answerName;
          mediaNames.answer = answerName;
          mediaIndex += 1;
        }

        const { front, back } = buildCardHtml(card, mediaNames);
        const noteId = noteIdBase + offset;
        const guid = sanitizeForIdentifier(`${deckPrefix}-${sequence}-${noteId.toString(36)}`);
        const fields = `${front}${FIELD_SEPARATOR}${back}`;
        const checksum = hash32(front);

        noteInsert.run([
          noteId,
          guid,
          modelId,
          nowSec,
          -1,
          "",
          fields,
          front,
          checksum,
          0,
          "",
        ]);

        cardInsert.run([
          noteId,
          noteId,
          deckId,
          0,
          nowSec,
          -1,
          0,
          0,
          sequence,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          "{}",
        ]);
      }
    } finally {
      noteInsert.free();
      cardInsert.free();
    }

    const updatedCollection = db.export();
    templateZip.file("collection.anki2", updatedCollection);
    templateZip.file("media", JSON.stringify(mediaMap));

    return templateZip.generateAsync({ type: "blob", mimeType: "application/octet-stream" });
  } finally {
    db.close();
  }
}

export async function downloadDeckZip(cards: Card[], deckName: string, deckId?: number): Promise<void> {
  const apkgBlob = await createDeckZip(cards, { deckName, deckId });
  const safeBlob = new Blob([apkgBlob], { type: "application/octet-stream" });
  const url = URL.createObjectURL(safeBlob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sanitizeFileBaseName(deckName)}.apkg`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), URL_REVOCATION_DELAY_MS);
}

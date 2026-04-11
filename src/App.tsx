/**
 * src/App.tsx
 * アプリケーションのルートコンポーネント。
 * 画像アップロードと CanvasSelector を組み合わせて
 * 矩形選択のデモを提供する。
 */

import { useCallback, useState } from "react";
import { CanvasSelector } from "./components/CanvasSelector";
import { appendCardsToExistingDeck } from "./services/fileManager";
import type { Rect } from "./types";
import "./App.css";

function App() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [selection, setSelection] = useState<Rect | null>(null);
  const [deckZipFile, setDeckZipFile] = useState<File | null>(null);
  const [questionPng, setQuestionPng] = useState<File | null>(null);
  const [answerPng, setAnswerPng] = useState<File | null>(null);
  const [appendStatus, setAppendStatus] = useState<string>("");

  /** ファイル選択時に Data URL へ変換して表示 */
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      setImageSrc(url);
      setSelection(null);
    },
    []
  );

  const handleSelect = useCallback((rect: Rect) => {
    setSelection(rect);
  }, []);

  const handleDeckZipChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setDeckZipFile(e.target.files?.[0] ?? null);
      setAppendStatus("");
    },
    []
  );

  const handleQuestionPngChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuestionPng(e.target.files?.[0] ?? null);
      setAppendStatus("");
    },
    []
  );

  const handleAnswerPngChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setAnswerPng(e.target.files?.[0] ?? null);
      setAppendStatus("");
    },
    []
  );

  const handleAppendToDeck = useCallback(async () => {
    if (!deckZipFile || !questionPng || !answerPng) {
      setAppendStatus("deck.zip / 問題PNG / 解答PNG をすべて指定してください。");
      return;
    }

    if (questionPng.type !== "image/png" || answerPng.type !== "image/png") {
      setAppendStatus("問題・解答画像は PNG のみ対応です。");
      return;
    }

    try {
      const mergedZip = await appendCardsToExistingDeck(deckZipFile, [
        { questionImage: questionPng, answerImage: answerPng },
      ]);

      const mergedName = deckZipFile.name.replace(/\.zip$/i, "") || deckZipFile.name || "deck";
      const downloadUrl = URL.createObjectURL(mergedZip);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${mergedName}_appended.zip`;
      a.click();
      URL.revokeObjectURL(downloadUrl);
      setAppendStatus("既存デッキへ追記した ZIP を出力しました。");
    } catch {
      setAppendStatus("追記処理に失敗しました。deck.zip の内容を確認してください。");
    }
  }, [answerPng, deckZipFile, questionPng]);

  return (
    <div className="app-container">
      <h1>Image2AnkiDeck — 矩形選択デモ</h1>

      <div className="upload-area">
        <label htmlFor="image-upload">画像を選択（PNG推奨）：</label>
        <input
          id="image-upload"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
        />
      </div>

      {imageSrc && (
        <div className="canvas-wrapper">
          <CanvasSelector
            imageSrc={imageSrc}
            onSelect={handleSelect}
            selection={selection}
          />
        </div>
      )}

      {selection && (
        <div className="selection-info">
          <h2>選択結果</h2>
          <table>
            <tbody>
              <tr>
                <th>x</th>
                <td>{Math.round(selection.x)} px</td>
              </tr>
              <tr>
                <th>y</th>
                <td>{Math.round(selection.y)} px</td>
              </tr>
              <tr>
                <th>width</th>
                <td>{Math.round(selection.width)} px</td>
              </tr>
              <tr>
                <th>height</th>
                <td>{Math.round(selection.height)} px</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {!imageSrc && (
        <p className="hint">← 画像をアップロードするとここにCanvasが表示されます</p>
      )}

      <section className="append-area">
        <h2>既存デッキへの追記</h2>
        <label htmlFor="deck-zip-upload">既存 deck.zip：</label>
        <input id="deck-zip-upload" type="file" accept=".zip" onChange={handleDeckZipChange} />

        <label htmlFor="question-png-upload">追記する問題画像（PNG）：</label>
        <input
          id="question-png-upload"
          type="file"
          accept=".png,image/png"
          onChange={handleQuestionPngChange}
        />

        <label htmlFor="answer-png-upload">追記する解答画像（PNG）：</label>
        <input
          id="answer-png-upload"
          type="file"
          accept=".png,image/png"
          onChange={handleAnswerPngChange}
        />

        <button type="button" onClick={handleAppendToDeck}>
          1件追記してZIP出力
        </button>

        {appendStatus && <p className="append-status">{appendStatus}</p>}
      </section>
    </div>
  );
}

export default App;

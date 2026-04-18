/**
 * src/App.tsx
 * アプリケーションのルートコンポーネント。
 * 問題・解答の矩形選択と登録フローを提供する。
 */

import { useCallback, useState } from "react";
import { CanvasSelector } from "./components/CanvasSelector";
import { PreviewList } from "./components/PreviewList";
import { useCardRegistration } from "./hooks/useCardRegistration";
import { loadDeckZipAsSession } from "./services/fileManager";
import { downloadSession, loadSession } from "./services/sessionManager";
import { downloadDeckZip, sanitizeFileBaseName } from "./services/zipExporter";
import type { Rect, Session } from "./types";
import "./App.css";

function readFileAsDataUrl(file: File): Promise<string> {
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
    reader.readAsDataURL(file);
  });
}

function App() {
  const [deckName, setDeckName] = useState<string>("");
  const [questionImageSrc, setQuestionImageSrc] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState<string>("");
  const [answerImageSrc, setAnswerImageSrc] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState<string>("");
  const [questionSelection, setQuestionSelection] = useState<Rect | null>(null);
  const [answerSelection, setAnswerSelection] = useState<Rect | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);

  const { step, cards, sessionCards, registerQuestion, registerAnswer, restoreFromSession, removeCard } =
    useCardRegistration();

  /** ファイル選択時に Data URL へ変換して状態を更新 */
  const handleQuestionFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setQuestionImageSrc(dataUrl);
        setQuestionSelection(null);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "不明なエラー";
        setSessionError(`問題画像の読み込みに失敗しました: ${detail}`);
      }
    },
    []
  );

  const handleAnswerFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        setAnswerImageSrc(dataUrl);
        setAnswerSelection(null);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "不明なエラー";
        setSessionError(`解答画像の読み込みに失敗しました: ${detail}`);
      }
    },
    []
  );

  /** 問題領域を登録してステップを「解答選択」へ */
  const handleRegisterQuestion = useCallback(() => {
    const hasQuestionImage = questionImageSrc !== null && questionSelection !== null;
    const hasQuestionText = questionText.trim().length > 0;
    if (!hasQuestionImage && !hasQuestionText) return;
    registerQuestion(questionImageSrc, questionSelection, questionText);
    setQuestionSelection(null);
  }, [questionImageSrc, questionSelection, questionText, registerQuestion]);

  /** 解答領域を登録してカードを生成する */
  const handleRegisterAnswer = useCallback(async () => {
    const hasAnswerImage = answerImageSrc !== null && answerSelection !== null;
    const hasAnswerText = answerText.trim().length > 0;
    if (!hasAnswerImage && !hasAnswerText) return;
    try {
      await registerAnswer(answerImageSrc, answerSelection, answerText);
      setQuestionText("");
      setAnswerSelection(null);
      setAnswerText("");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "不明なエラー";
      setSessionError(`解答の登録に失敗しました: ${detail}`);
    }
  }, [answerImageSrc, answerSelection, answerText, registerAnswer]);

  const handleSaveSession = useCallback(() => {
    const session: Session = {
      deckName,
      cards: sessionCards,
    };
    downloadSession(session, `${sanitizeFileBaseName(deckName)}-session.json`);
  }, [deckName, sessionCards]);

  const handleLoadSession = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const session = await loadSession(file);
        setDeckName(session.deckName);
        await restoreFromSession(session.cards);
        const lastCard = session.cards[session.cards.length - 1];
        setQuestionImageSrc(lastCard?.questionImageSrc ?? null);
        setQuestionText(lastCard?.questionText ?? "");
        setAnswerImageSrc(lastCard?.answerImageSrc ?? null);
        setAnswerText(lastCard?.answerText ?? "");
        setQuestionSelection(null);
        setAnswerSelection(null);
        setSessionError(null);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "不明なエラー";
        setSessionError(`セッションの読み込みに失敗しました: ${detail}`);
      } finally {
        e.target.value = "";
      }
    },
    [restoreFromSession]
  );

  const handleSaveZip = useCallback(async () => {
    try {
      await downloadDeckZip(cards, deckName);
      setZipError(null);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "ZIP生成中に不明なエラーが発生しました";
      setZipError(`ZIPの保存に失敗しました: ${detail}`);
    }
  }, [cards, deckName]);

  const handleLoadDeckZip = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const session = await loadDeckZipAsSession(file);
        setDeckName(session.deckName);
        await restoreFromSession(session.cards);
        setQuestionImageSrc(null);
        setQuestionText("");
        setAnswerImageSrc(null);
        setAnswerText("");
        setQuestionSelection(null);
        setAnswerSelection(null);
        setSessionError(null);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "不明なエラー";
        setSessionError(`ZIPの読み込みに失敗しました: ${detail}`);
      } finally {
        e.target.value = "";
      }
    },
    [restoreFromSession]
  );

  const isQuestionStep = step === "question";
  const canRegisterQuestion =
    isQuestionStep &&
    (questionText.trim().length > 0 || (questionImageSrc !== null && questionSelection !== null));
  const canRegisterAnswer =
    !isQuestionStep &&
    (answerText.trim().length > 0 || (answerImageSrc !== null && answerSelection !== null));

  return (
    <div className="app-container">
      <h1>Image2AnkiDeck</h1>

      <div className="field-row">
        <label htmlFor="deck-name" className="field-label">
          デッキ名：
        </label>
        <input
          id="deck-name"
          type="text"
          className="field-input"
          placeholder="例：英単語テスト"
          value={deckName}
          onChange={(e) => setDeckName(e.target.value)}
        />
      </div>

      <div className="session-actions">
        <button className="btn btn--secondary" onClick={handleSaveSession}>
          セッションを保存
        </button>
        <label className="btn btn--secondary btn--file">
          セッションを読み込む
          <input type="file" accept=".json,application/json" onChange={handleLoadSession} />
        </label>
        <label className="btn btn--secondary btn--file">
          ZIPを読み込む
          <input type="file" accept=".zip,application/zip" onChange={handleLoadDeckZip} />
        </label>
        <button className="btn btn--secondary" onClick={handleSaveZip} disabled={cards.length === 0}>
          ZIPを保存
        </button>
      </div>
      {sessionError && <p className="error-text">{sessionError}</p>}
      {zipError && <p className="error-text">{zipError}</p>}

      <div className="step-indicator">
        <span className={`step-badge ${isQuestionStep ? "step-badge--active" : "step-badge--done"}`}>
          1. 問題を選択
        </span>
        <span className="step-arrow">→</span>
        <span className={`step-badge ${!isQuestionStep ? "step-badge--active" : ""}`}>
          2. 解答を選択
        </span>
        <span className="step-arrow">→</span>
        <span className="step-badge">繰り返す</span>
      </div>

      <div className="columns">
        <div className={`column ${isQuestionStep ? "column--active" : "column--inactive"}`}>
          <h2 className="column__title">問題（画像 / テキスト）</h2>
          <div className="upload-area">
            <p className="upload-area__label">画像を選択（PNG推奨）：</p>
            <div className="upload-area__buttons">
              <label className="btn btn--secondary btn--file">
                ファイルから選ぶ
                <input
                  id="question-upload"
                  type="file"
                  accept="image/*"
                  onClick={(e) => {
                    e.currentTarget.value = "";
                  }}
                  onChange={handleQuestionFileChange}
                />
              </label>
              <label className="btn btn--secondary btn--file">
                📷 カメラで撮影
                <input
                  id="question-camera-upload"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onClick={(e) => {
                    e.currentTarget.value = "";
                  }}
                  onChange={handleQuestionFileChange}
                />
              </label>
            </div>
          </div>
          <div className="upload-area">
            <label htmlFor="question-text" className="upload-area__label">
              テキスト入力：
            </label>
            <textarea
              id="question-text"
              className="text-input-area"
              rows={4}
              placeholder="問題テキストを入力（画像と併用可）"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
            />
          </div>

          {questionImageSrc ? (
            <>
              <div className="canvas-wrapper">
                <CanvasSelector
                  imageSrc={questionImageSrc}
                  onSelect={setQuestionSelection}
                  selection={questionSelection}
                />
              </div>
              <button
                className="btn btn--primary"
                disabled={!canRegisterQuestion}
                onClick={handleRegisterQuestion}
              >
                問題を登録
              </button>
            </>
          ) : (
            <>
              <p className="hint">画像を使う場合は問題画像をアップロードしてください</p>
              <button className="btn btn--primary" disabled={!canRegisterQuestion} onClick={handleRegisterQuestion}>
                問題を登録
              </button>
            </>
          )}
        </div>

        <div className={`column ${!isQuestionStep ? "column--active" : "column--inactive"}`}>
          <h2 className="column__title">解答（画像 / テキスト）</h2>
          <div className="upload-area">
            <p className="upload-area__label">画像を選択（PNG推奨）：</p>
            <div className="upload-area__buttons">
              <label className="btn btn--secondary btn--file">
                ファイルから選ぶ
                <input
                  id="answer-upload"
                  type="file"
                  accept="image/*"
                  onClick={(e) => {
                    e.currentTarget.value = "";
                  }}
                  onChange={handleAnswerFileChange}
                />
              </label>
              <label className="btn btn--secondary btn--file">
                📷 カメラで撮影
                <input
                  id="answer-camera-upload"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onClick={(e) => {
                    e.currentTarget.value = "";
                  }}
                  onChange={handleAnswerFileChange}
                />
              </label>
            </div>
          </div>
          <div className="upload-area">
            <label htmlFor="answer-text" className="upload-area__label">
              テキスト入力：
            </label>
            <textarea
              id="answer-text"
              className="text-input-area"
              rows={4}
              placeholder="解答テキストを入力（画像と併用可）"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
            />
          </div>

          {answerImageSrc ? (
            <>
              <div className="canvas-wrapper">
                <CanvasSelector
                  imageSrc={answerImageSrc}
                  onSelect={setAnswerSelection}
                  selection={answerSelection}
                />
              </div>
              <button
                className="btn btn--primary"
                disabled={!canRegisterAnswer}
                onClick={handleRegisterAnswer}
              >
                解答を登録
              </button>
            </>
          ) : (
            <>
              <p className="hint">画像を使う場合は解答画像をアップロードしてください</p>
              <button className="btn btn--primary" disabled={!canRegisterAnswer} onClick={handleRegisterAnswer}>
                解答を登録
              </button>
            </>
          )}
        </div>
      </div>

      <section className="card-section">
        <PreviewList cards={cards} onRemove={removeCard} />
      </section>
    </div>
  );
}

export default App;

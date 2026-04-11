/**
 * src/App.tsx
 * アプリケーションのルートコンポーネント。
 * 問題・解答の矩形選択と登録フローを提供する。
 */

import { useCallback, useState } from "react";
import { CanvasSelector } from "./components/CanvasSelector";
import { PreviewList } from "./components/PreviewList";
import { useCardRegistration } from "./hooks/useCardRegistration";
import { downloadSession, loadSession } from "./services/sessionManager";
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
  const [answerImageSrc, setAnswerImageSrc] = useState<string | null>(null);
  const [questionSelection, setQuestionSelection] = useState<Rect | null>(null);
  const [answerSelection, setAnswerSelection] = useState<Rect | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const { step, cards, sessionCards, registerQuestion, registerAnswer, restoreFromSession, removeCard } =
    useCardRegistration();

  /** ファイル選択時に Data URL へ変換して状態を更新 */
  const handleQuestionFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const dataUrl = await readFileAsDataUrl(file);
      setQuestionImageSrc(dataUrl);
      setQuestionSelection(null);
    },
    []
  );

  const handleAnswerFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const dataUrl = await readFileAsDataUrl(file);
      setAnswerImageSrc(dataUrl);
      setAnswerSelection(null);
    },
    []
  );

  /** 問題領域を登録してステップを「解答選択」へ */
  const handleRegisterQuestion = useCallback(() => {
    if (!questionImageSrc || !questionSelection) return;
    registerQuestion(questionImageSrc, questionSelection);
    setQuestionSelection(null);
  }, [questionImageSrc, questionSelection, registerQuestion]);

  /** 解答領域を登録してカードを生成する */
  const handleRegisterAnswer = useCallback(async () => {
    if (!answerImageSrc || !answerSelection) return;
    await registerAnswer(answerImageSrc, answerSelection);
    setAnswerSelection(null);
  }, [answerImageSrc, answerSelection, registerAnswer]);

  const handleSaveSession = useCallback(() => {
    const session: Session = {
      deckName,
      cards: sessionCards,
    };
    downloadSession(session, `${deckName || "deck"}-session.json`);
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
        setAnswerImageSrc(lastCard?.answerImageSrc ?? null);
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

  const isQuestionStep = step === "question";

  return (
    <div className="app-container">
      <h1>Image2AnkiDeck</h1>

      {/* デッキ名入力 */}
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
      </div>
      {sessionError && <p className="error-text">{sessionError}</p>}

      {/* ステップインジケーター */}
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

      {/* 2カラム：問題画像 ／ 解答画像 */}
      <div className="columns">
        {/* 問題側 */}
        <div className={`column ${isQuestionStep ? "column--active" : "column--inactive"}`}>
          <h2 className="column__title">問題画像</h2>
          <div className="upload-area">
            <label htmlFor="question-upload" className="upload-area__label">
              画像を選択（PNG推奨）：
            </label>
            <input
              id="question-upload"
              type="file"
              accept="image/*"
              onChange={handleQuestionFileChange}
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
                disabled={!questionSelection || !isQuestionStep}
                onClick={handleRegisterQuestion}
              >
                問題を登録
              </button>
            </>
          ) : (
            <p className="hint">← 問題画像をアップロードしてください</p>
          )}
        </div>

        {/* 解答側 */}
        <div className={`column ${!isQuestionStep ? "column--active" : "column--inactive"}`}>
          <h2 className="column__title">解答画像</h2>
          <div className="upload-area">
            <label htmlFor="answer-upload" className="upload-area__label">
              画像を選択（PNG推奨）：
            </label>
            <input
              id="answer-upload"
              type="file"
              accept="image/*"
              onChange={handleAnswerFileChange}
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
                disabled={!answerSelection || isQuestionStep}
                onClick={handleRegisterAnswer}
              >
                解答を登録
              </button>
            </>
          ) : (
            <p className="hint">← 解答画像をアップロードしてください</p>
          )}
        </div>
      </div>

      {/* 登録済みカードプレビュー */}
      <section className="card-section">
        <PreviewList cards={cards} onRemove={removeCard} />
      </section>
    </div>
  );
}

export default App;

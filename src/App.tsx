/**
 * src/App.tsx
 * アプリケーションのルートコンポーネント。
 * 問題・解答の矩形選択と登録フローを提供する。
 */

import { useCallback, useState } from "react";
import { CanvasSelector } from "./components/CanvasSelector";
import { PreviewList } from "./components/PreviewList";
import { useCardRegistration } from "./hooks/useCardRegistration";
import { cropImage } from "./services/imageCropper";
import { loadDeckApkgAsSession } from "./services/fileManager";
import { downloadSession, loadSession } from "./services/sessionManager";
import { downloadDeckZip, sanitizeFileBaseName } from "./services/zipExporter";
import type { Rect, Session, ZoomLevel } from "./types";
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
  const [deckId, setDeckId] = useState<number | null>(null);
  const [questionImageSrc, setQuestionImageSrc] = useState<string | null>(null);
  const [questionText, setQuestionText] = useState<string>("");
  const [answerImageSrc, setAnswerImageSrc] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState<string>("");
  const [questionSelection, setQuestionSelection] = useState<Rect | null>(null);
  const [answerSelection, setAnswerSelection] = useState<Rect | null>(null);
  const [questionZoom, setQuestionZoom] = useState<ZoomLevel>("fit");
  const [answerZoom, setAnswerZoom] = useState<ZoomLevel>("fit");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);

  // 画像全体選択用の寸法・チェックボックス状態
  const [questionImageDims, setQuestionImageDims] = useState<{ width: number; height: number } | null>(null);
  const [answerImageDims, setAnswerImageDims] = useState<{ width: number; height: number } | null>(null);
  const [questionSelectAll, setQuestionSelectAll] = useState(false);
  const [answerSelectAll, setAnswerSelectAll] = useState(false);

  // 問題プレビュー（解答ステップ用）
  const [questionPreviewImage, setQuestionPreviewImage] = useState<string | null>(null);
  const [questionPreviewText, setQuestionPreviewText] = useState<string>("");

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
        setQuestionImageDims(null);
        setQuestionSelectAll(false);
        setQuestionZoom("fit");
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
        setAnswerImageDims(null);
        setAnswerSelectAll(false);
        setAnswerZoom("fit");
      } catch (error) {
        const detail = error instanceof Error ? error.message : "不明なエラー";
        setSessionError(`解答画像の読み込みに失敗しました: ${detail}`);
      }
    },
    []
  );

  /** 問題領域を登録してステップを「解答選択」へ */
  const handleRegisterQuestion = useCallback(async () => {
    const hasQuestionImage = questionImageSrc !== null && questionSelection !== null;
    const hasQuestionText = questionText.trim().length > 0;
    if (!hasQuestionImage && !hasQuestionText) return;
    registerQuestion(questionImageSrc, questionSelection, questionText);

    // 解答ステップ用のプレビューを生成
    let previewImg: string | null = null;
    if (questionImageSrc && questionSelection) {
      try {
        previewImg = await cropImage(questionImageSrc, questionSelection);
      } catch {
        previewImg = null;
      }
    }
    setQuestionPreviewImage(previewImg);
    setQuestionPreviewText(questionText);
    setQuestionSelection(null);
    setQuestionSelectAll(false);
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
      setAnswerSelectAll(false);
      setQuestionPreviewImage(null);
      setQuestionPreviewText("");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "不明なエラー";
      setSessionError(`解答の登録に失敗しました: ${detail}`);
    }
  }, [answerImageSrc, answerSelection, answerText, registerAnswer]);

  // 画像読み込み完了時に寸法を保存
  const handleQuestionImageLoad = useCallback((width: number, height: number) => {
    setQuestionImageDims({ width, height });
  }, []);

  const handleAnswerImageLoad = useCallback((width: number, height: number) => {
    setAnswerImageDims({ width, height });
  }, []);

  // 「画像全体を選択」チェックボックス
  const handleQuestionSelectAllChange = useCallback(
    (checked: boolean) => {
      setQuestionSelectAll(checked);
      if (checked && questionImageDims) {
        const rect: Rect = { x: 0, y: 0, width: questionImageDims.width, height: questionImageDims.height };
        setQuestionSelection(rect);
      } else {
        setQuestionSelection(null);
      }
    },
    [questionImageDims]
  );

  const handleAnswerSelectAllChange = useCallback(
    (checked: boolean) => {
      setAnswerSelectAll(checked);
      if (checked && answerImageDims) {
        const rect: Rect = { x: 0, y: 0, width: answerImageDims.width, height: answerImageDims.height };
        setAnswerSelection(rect);
      } else {
        setAnswerSelection(null);
      }
    },
    [answerImageDims]
  );

  // 手動ドラッグ選択時はチェックボックスを解除
  const handleQuestionSelect = useCallback((rect: Rect) => {
    setQuestionSelection(rect);
    setQuestionSelectAll(false);
  }, []);

  const handleAnswerSelect = useCallback((rect: Rect) => {
    setAnswerSelection(rect);
    setAnswerSelectAll(false);
  }, []);

  const handleSaveSession = useCallback(() => {
    const session: Session = {
      deckName,
      deckId: deckId ?? undefined,
      cards: sessionCards,
    };
    downloadSession(session, `${sanitizeFileBaseName(deckName)}-session.json`);
  }, [deckId, deckName, sessionCards]);

  const handleLoadSession = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const session = await loadSession(file);
        setDeckName(session.deckName);
        setDeckId(session.deckId ?? null);
        await restoreFromSession(session.cards);
        const lastCard = session.cards[session.cards.length - 1];
        setQuestionImageSrc(lastCard?.questionImageSrc ?? null);
        setQuestionText(lastCard?.questionText ?? "");
        setAnswerImageSrc(lastCard?.answerImageSrc ?? null);
        setAnswerText(lastCard?.answerText ?? "");
        setQuestionSelection(null);
        setAnswerSelection(null);
        setQuestionImageDims(null);
        setAnswerImageDims(null);
        setQuestionSelectAll(false);
        setAnswerSelectAll(false);
        setQuestionZoom("fit");
        setAnswerZoom("fit");
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

  const handleSaveApkg = useCallback(async () => {
    try {
      await downloadDeckZip(cards, deckName, deckId ?? undefined);
      setZipError(null);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "APKG生成中に不明なエラーが発生しました";
      setZipError(`APKGの保存に失敗しました: ${detail}`);
    }
  }, [cards, deckId, deckName]);

  const handleLoadDeckApkg = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const session = await loadDeckApkgAsSession(file);
        setDeckName(session.deckName);
        setDeckId(session.deckId ?? null);
        await restoreFromSession(session.cards);
        setQuestionImageSrc(null);
        setQuestionText("");
        setAnswerImageSrc(null);
        setAnswerText("");
        setQuestionSelection(null);
        setAnswerSelection(null);
        setQuestionImageDims(null);
        setAnswerImageDims(null);
        setQuestionSelectAll(false);
        setAnswerSelectAll(false);
        setQuestionZoom("fit");
        setAnswerZoom("fit");
        setSessionError(null);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "不明なエラー";
        setSessionError(`APKGの読み込みに失敗しました: ${detail}`);
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
      <header className="app-header">
        <h1 className="app-header__title">SnapDeck</h1>
        <p className="app-header__description">
          画像から範囲を選択するだけで、Anki フラッシュカードデッキを作成できます。
        </p>
      </header>

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
          APKGを読み込む
          <input type="file" accept=".apkg,application/zip" onChange={handleLoadDeckApkg} />
        </label>
        <button className="btn btn--secondary" onClick={handleSaveApkg} disabled={cards.length === 0}>
          APKGを保存
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
              <CanvasSelector
                imageSrc={questionImageSrc}
                onSelect={handleQuestionSelect}
                selection={questionSelection}
                onImageLoad={handleQuestionImageLoad}
                zoom={questionZoom}
                onZoomChange={setQuestionZoom}
              />
              <label className="select-all-label">
                <input
                  type="checkbox"
                  checked={questionSelectAll}
                  disabled={!questionImageDims}
                  onChange={(e) => handleQuestionSelectAllChange(e.target.checked)}
                />
                画像全体を選択
              </label>
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

          {!isQuestionStep && (questionPreviewImage || questionPreviewText.trim().length > 0) && (
            <div className="question-preview">
              <p className="question-preview__label">登録された問題：</p>
              {questionPreviewImage && (
                <img
                  src={questionPreviewImage}
                  alt="登録済み問題プレビュー"
                  className="question-preview__img"
                />
              )}
              {questionPreviewText.trim().length > 0 && (
                <p className="question-preview__text">{questionPreviewText}</p>
              )}
            </div>
          )}

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
              <CanvasSelector
                imageSrc={answerImageSrc}
                onSelect={handleAnswerSelect}
                selection={answerSelection}
                onImageLoad={handleAnswerImageLoad}
                zoom={answerZoom}
                onZoomChange={setAnswerZoom}
              />
              <label className="select-all-label">
                <input
                  type="checkbox"
                  checked={answerSelectAll}
                  disabled={!answerImageDims}
                  onChange={(e) => handleAnswerSelectAllChange(e.target.checked)}
                />
                画像全体を選択
              </label>
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

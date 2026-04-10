/**
 * src/App.tsx
 * アプリケーションのルートコンポーネント。
 * 画像アップロード、矩形選択、画像切り出し（PNG保存）のデモを提供する。
 */

import { useCallback, useState } from "react";
import { CanvasSelector } from "./components/CanvasSelector";
import { cropImage } from "./services/imageCropper";
import type { Rect } from "./types";
import "./App.css";

function App() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [selection, setSelection] = useState<Rect | null>(null);
  const [croppedSrc, setCroppedSrc] = useState<string | null>(null);
  const [cropError, setCropError] = useState<string | null>(null);

  /** ファイル選択時に Data URL へ変換して表示 */
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      setImageSrc(url);
      setSelection(null);
      setCroppedSrc(null);
      setCropError(null);
    },
    []
  );

  const handleSelect = useCallback((rect: Rect) => {
    setSelection(rect);
    setCroppedSrc(null);
    setCropError(null);
  }, []);

  /** 選択領域を切り出してプレビューに表示 */
  const handleCrop = useCallback(async () => {
    if (!imageSrc || !selection) return;
    setCropError(null);
    try {
      const dataUrl = await cropImage(imageSrc, selection);
      setCroppedSrc(dataUrl);
    } catch (err) {
      setCropError(err instanceof Error ? err.message : "切り出しに失敗しました");
    }
  }, [imageSrc, selection]);

  /** 切り出し画像をダウンロード */
  const handleDownload = useCallback(() => {
    if (!croppedSrc) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const a = document.createElement("a");
    a.href = croppedSrc;
    a.download = `cropped_${timestamp}.png`;
    a.click();
  }, [croppedSrc]);

  return (
    <div className="app-container">
      <h1>Image2AnkiDeck — 画像切り出しデモ</h1>

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
          <h2>選択領域</h2>
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
          <button className="crop-button" onClick={handleCrop}>
            切り出し
          </button>
        </div>
      )}

      {cropError && <p className="crop-error">{cropError}</p>}

      {croppedSrc && (
        <div className="cropped-preview">
          <h2>切り出し結果</h2>
          <img src={croppedSrc} alt="切り出し結果" className="cropped-image" />
          <button className="download-button" onClick={handleDownload}>
            PNG としてダウンロード
          </button>
        </div>
      )}

      {!imageSrc && (
        <p className="hint">← 画像をアップロードするとここにCanvasが表示されます</p>
      )}
    </div>
  );
}

export default App;


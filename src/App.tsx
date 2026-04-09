/**
 * src/App.tsx
 * アプリケーションのルートコンポーネント。
 * 画像アップロードと CanvasSelector を組み合わせて
 * 矩形選択のデモを提供する。
 */

import { useCallback, useState } from "react";
import { CanvasSelector } from "./components/CanvasSelector";
import type { Rect } from "./types";
import "./App.css";

function App() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [selection, setSelection] = useState<Rect | null>(null);

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
    </div>
  );
}

export default App;

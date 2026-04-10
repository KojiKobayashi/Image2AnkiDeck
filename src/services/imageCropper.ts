/**
 * src/services/imageCropper.ts
 * Canvas APIを使って画像の矩形領域を切り出し、PNG形式のデータURLを返すサービス。
 */

import type { Rect } from "../types";

/**
 * 画像URLと矩形領域を受け取り、切り出したPNG画像のデータURLを返す。
 *
 * @param imageSrc   - 切り出し元画像のURL（dataURL または objectURL）
 * @param rect       - 切り出す矩形領域（Canvasの描画座標系）
 * @param canvasWidth  - CanvasSelectorに設定されたCanvas幅（省略時は画像自然サイズと同じとみなす）
 * @param canvasHeight - CanvasSelectorに設定されたCanvas高さ（省略時は画像自然サイズと同じとみなす）
 * @returns PNG形式のデータURL
 */
export function cropImage(
  imageSrc: string,
  rect: Rect,
  canvasWidth?: number,
  canvasHeight?: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      // Canvas座標系から元画像のピクセル座標系へのスケール係数
      const scaleX = canvasWidth ? img.naturalWidth / canvasWidth : 1;
      const scaleY = canvasHeight ? img.naturalHeight / canvasHeight : 1;

      const srcX = rect.x * scaleX;
      const srcY = rect.y * scaleY;
      const srcW = rect.width * scaleX;
      const srcH = rect.height * scaleY;

      const offscreen = document.createElement("canvas");
      offscreen.width = Math.round(srcW);
      offscreen.height = Math.round(srcH);

      const ctx = offscreen.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D コンテキストを取得できませんでした"));
        return;
      }

      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, offscreen.width, offscreen.height);
      resolve(offscreen.toDataURL("image/png"));
    };

    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    img.src = imageSrc;
  });
}

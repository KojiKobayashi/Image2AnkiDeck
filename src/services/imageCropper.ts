/**
 * src/services/imageCropper.ts
 * 指定した矩形領域を画像から切り出してPNG Data URLを返す。
 */

import type { Rect } from "../types";

/**
 * 画像URLと矩形領域からPNG Data URLを生成する。
 */
export function cropImage(imageSrc: string, rect: Rect): Promise<string> {
  return new Promise((resolve, reject) => {
    const x = Math.round(rect.x);
    const y = Math.round(rect.y);
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w <= 0 || h <= 0) {
      reject(new Error("切り出し範囲の幅と高さは1以上である必要があります"));
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("キャンバスのコンテキストを取得できませんでした"));
        return;
      }
      ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    img.src = imageSrc;
  });
}

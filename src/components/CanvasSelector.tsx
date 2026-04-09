/**
 * src/components/CanvasSelector.tsx
 * 画像をCanvas上に表示し、マウスドラッグで矩形選択を行うコンポーネント。
 * useSelectionフックでロジックを管理し、UIはCanvasへの描画のみを担う。
 */

import { useEffect, useRef } from "react";
import { useSelection } from "../hooks/useSelection";
import type { CanvasSelectorProps, Rect } from "../types";

/** 選択枠の描画スタイル */
const SELECTION_STYLE = {
  strokeColor: "rgba(0, 120, 255, 0.9)",
  fillColor: "rgba(0, 120, 255, 0.15)",
  lineWidth: 2,
  draftStrokeColor: "rgba(0, 120, 255, 0.6)",
  draftFillColor: "rgba(0, 120, 255, 0.08)",
} as const;

/**
 * Canvasに矩形を描画する補助関数。
 */
function drawRect(
  ctx: CanvasRenderingContext2D,
  rect: Rect,
  strokeColor: string,
  fillColor: string,
  lineWidth: number
): void {
  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = fillColor;
  ctx.lineWidth = lineWidth;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

/**
 * CanvasSelectorコンポーネント
 *
 * imageSrcに指定した画像をCanvasに描画し、ドラッグ操作で矩形選択を行う。
 * 選択が確定するとonSelectコールバックが {x, y, width, height} を返す。
 * 再ドラッグすると選択を上書きできる。
 */
export function CanvasSelector({
  imageSrc,
  onSelect,
  selection: externalSelection,
  width,
  height,
}: CanvasSelectorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const { draft, selection: internalSelection, onMouseDown, onMouseMove, onMouseUp } =
    useSelection(onSelect);

  // 外部から制御する場合は外部の値、なければ内部状態を使う
  const activeSelection = externalSelection !== undefined ? externalSelection : internalSelection;

  // 画像の読み込みとCanvasサイズ設定
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      imageRef.current = img;
      canvas.width = width ?? img.naturalWidth;
      canvas.height = height ?? img.naturalHeight;
      renderCanvas();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrc, width, height]);

  // 選択状態が変わるたびに再描画
  useEffect(() => {
    renderCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, activeSelection]);

  function renderCanvas() {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 背景クリア → 画像描画
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // ドラッグ中のドラフト矩形
    if (draft) {
      drawRect(
        ctx,
        draft,
        SELECTION_STYLE.draftStrokeColor,
        SELECTION_STYLE.draftFillColor,
        SELECTION_STYLE.lineWidth
      );
    }

    // 確定済みの選択矩形
    if (activeSelection) {
      drawRect(
        ctx,
        activeSelection,
        SELECTION_STYLE.strokeColor,
        SELECTION_STYLE.fillColor,
        SELECTION_STYLE.lineWidth
      );
    }
  }

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      style={{ cursor: "crosshair", maxWidth: "100%", display: "block" }}
    />
  );
}

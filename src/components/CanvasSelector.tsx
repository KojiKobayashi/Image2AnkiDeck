/**
 * src/components/CanvasSelector.tsx
 * 画像をCanvas上に表示し、マウスドラッグで矩形選択を行うコンポーネント。
 * useSelectionフックでロジックを管理し、UIはCanvasへの描画のみを担う。
 */

import { useEffect, useMemo, useRef, useState } from "react";
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

const ZOOM_STEP = 1.25;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;

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
  onImageLoad,
  zoom,
  onZoomChange,
}: CanvasSelectorProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number } | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  const {
    draft,
    selection: internalSelection,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  } = useSelection(onSelect);

  // 外部から制御する場合は外部の値、なければ内部状態を使う
  const activeSelection = externalSelection !== undefined ? externalSelection : internalSelection;

  useEffect(() => {
    const element = canvasWrapRef.current;
    if (!element) return;

    const updateSize = () => {
      setContainerSize({ width: element.clientWidth, height: element.clientHeight });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const fitScale = useMemo(() => {
    if (!containerSize || !imageSize) return 1;
    const scaleX = containerSize.width / imageSize.width;
    const scaleY = containerSize.height / imageSize.height;
    return Math.min(scaleX, scaleY);
  }, [containerSize, imageSize]);

  const displayScale = zoom === "fit" ? fitScale : zoom;
  const canvasWidth = imageSize?.width ?? 0;
  const canvasHeight = imageSize?.height ?? 0;
  const canvasStyle = useMemo(
    () => ({
      cursor: "crosshair",
      display: "block",
      touchAction: "none",
      width: `${canvasWidth * displayScale}px`,
      height: `${canvasHeight * displayScale}px`,
    }),
    [canvasHeight, canvasWidth, displayScale]
  );

  const displayedZoomText = `${Math.round(displayScale * 100)}%`;

  const handleZoomIn = () => {
    const currentScale = zoom === "fit" ? fitScale : zoom;
    onZoomChange(Math.min(currentScale * ZOOM_STEP, MAX_ZOOM));
  };

  const handleZoomOut = () => {
    const currentScale = zoom === "fit" ? fitScale : zoom;
    onZoomChange(Math.max(currentScale / ZOOM_STEP, MIN_ZOOM));
  };

  const handleZoom100 = () => {
    onZoomChange(1);
  };

  const handleZoomFit = () => {
    onZoomChange("fit");
  };

  // 画像の読み込みとCanvasサイズ設定
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      imageRef.current = img;
      const nextWidth = width ?? img.naturalWidth;
      const nextHeight = height ?? img.naturalHeight;
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      setImageSize({ width: nextWidth, height: nextHeight });
      onImageLoad?.(canvas.width, canvas.height);
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
    <div className="canvas-panel" ref={panelRef}>
      <div className="canvas-toolbar" aria-label="画像表示倍率の操作">
        <span className="canvas-toolbar__label">表示倍率</span>
        <span className="canvas-toolbar__value">{displayedZoomText}</span>
        <button type="button" className="btn btn--secondary canvas-toolbar__button" onClick={handleZoomOut}>
          -
        </button>
        <button type="button" className="btn btn--secondary canvas-toolbar__button" onClick={handleZoomIn}>
          +
        </button>
        <button type="button" className="btn btn--secondary canvas-toolbar__button" onClick={handleZoom100}>
          100%
        </button>
        <button type="button" className="btn btn--secondary canvas-toolbar__button" onClick={handleZoomFit}>
          Fit
        </button>
      </div>
      <div className="canvas-wrapper" ref={canvasWrapRef}>
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={canvasStyle}
        />
      </div>
    </div>
  );
}

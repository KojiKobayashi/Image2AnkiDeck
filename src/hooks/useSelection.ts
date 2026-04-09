/**
 * src/hooks/useSelection.ts
 * Canvas上のマウスドラッグによる矩形選択ロジック。
 * UIから分離されており、任意のCanvasコンポーネントに組み込める。
 */

import { useCallback, useRef, useState } from "react";
import type { Rect, UseSelectionReturn } from "../types";

/**
 * マウス座標をCanvas要素の座標系に変換する。
 * CSSスケーリングを考慮する。
 */
function getCanvasPoint(
  e: React.MouseEvent<HTMLCanvasElement>
): { x: number; y: number } {
  const canvas = e.currentTarget;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

/**
 * 2点から正規化された矩形（x, y は常に左上）を作成する。
 */
function normalizeRect(
  start: { x: number; y: number },
  end: { x: number; y: number }
): Rect {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

/**
 * Canvas上でのマウスドラッグ矩形選択を管理するフック。
 *
 * @param onSelect 選択確定時に呼ばれるコールバック
 * @returns マウスイベントハンドラと選択状態
 */
export function useSelection(onSelect: (rect: Rect) => void): UseSelectionReturn {
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Rect | null>(null);
  const [selection, setSelection] = useState<Rect | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const point = getCanvasPoint(e);
    startPoint.current = point;
    setDraft(null);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!startPoint.current) return;
    const point = getCanvasPoint(e);
    setDraft(normalizeRect(startPoint.current, point));
  }, []);

  const onMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!startPoint.current) return;
      const point = getCanvasPoint(e);
      const rect = normalizeRect(startPoint.current, point);
      startPoint.current = null;
      setDraft(null);

      // 面積が0の選択は無視する
      if (rect.width === 0 || rect.height === 0) return;

      setSelection(rect);
      onSelect(rect);
    },
    [onSelect]
  );

  const reset = useCallback(() => {
    startPoint.current = null;
    setDraft(null);
    setSelection(null);
  }, []);

  return { draft, selection, onMouseDown, onMouseMove, onMouseUp, reset };
}
